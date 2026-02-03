import sys
import os
import time
import queue
import argparse
import numpy as np
import sounddevice as sd
import sherpa_onnx
import subprocess
import threading
import requests
import re
import wave

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

class SmartAssistant:
    def __init__(self):
        self.sample_rate = 16000
        self.samples_per_read = int(0.1 * self.sample_rate)
        self.audio_queue = queue.Queue()
        self.is_running = False
        self.is_listening = False # Active interaction mode
        
        # Paths
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.models_dir = os.path.join(self.base_dir, "local_sherpa_onnx_models")
        self.temp_audio_path = "/tmp/voice_cmd.wav"
        
        # Models
        self.vad = None
        self.kws = None
        self.kws_stream = None
        
        # State
        self.last_speech_time = 0
        self.speech_start_time = 0
        self.silence_threshold = 1.8 # Slightly longer for natural pauses
        self.max_interaction_time = 12.0
        self.recorded_samples = []
        self.wake_words = []
        self.speech_lock = threading.Lock() # Prevent overlapping speech
        
    def init_models(self):
        print(">>> Loading models...")
        # VAD (Silero)
        vad_model = os.path.join(self.models_dir, "silero_vad.onnx")
        vad_config = sherpa_onnx.VadModelConfig()
        vad_config.silero_vad.model = vad_model
        vad_config.sample_rate = self.sample_rate
        self.vad = sherpa_onnx.VoiceActivityDetector(vad_config, buffer_size_in_seconds=100)
        
        # KWS (Wake Word)
        kws_dir = os.path.join(self.models_dir, "sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01")
        tokens = os.path.join(kws_dir, "tokens.txt")
        encoder = os.path.join(kws_dir, "encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx")
        decoder = os.path.join(kws_dir, "decoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx")
        joiner = os.path.join(kws_dir, "joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx")
        keywords_tokens_file = os.path.join(self.base_dir, "keywords_tokens.txt")
        
        self.kws = sherpa_onnx.KeywordSpotter(
            tokens=tokens, encoder=encoder, decoder=decoder, joiner=joiner,
            keywords_file=keywords_tokens_file, keywords_score=1.0, keywords_threshold=0.15, num_trailing_blanks=1,
        )
        self.kws_stream = self.kws.create_stream()
        
        # Load wake words
        keywords_src = os.path.join(self.base_dir, "my_keywords.txt")
        with open(keywords_src, "r") as f:
            for line in f:
                parts = line.strip().split()
                if parts: self.wake_words.append(parts[0])

        print("✅ Models loaded. Brain connected.")
        return True

    def audio_callback(self, indata, frames, time_info, status):
        self.audio_queue.put(indata.copy())

    def speak(self, text):
        """TTS using Mac 'say' command with locking and specific voice"""
        # Remove emojis for cleaner TTS, keep basic punctuation
        text = re.sub(r'[^\w\s,.?!]', '', text)
        print(f"🤖 Assistant: {text}")
        
        # Run in a separate thread to avoid blocking the main loop, 
        # BUT acquire lock to ensure sequential playback.
        def _speak_thread():
            with self.speech_lock:
                if self.stream_obj: self.stream_obj.stop()
                # Clear queue to prevent recording self
                with self.audio_queue.mutex: self.audio_queue.queue.clear()
                
                # Use 'Tingting' for consistent CN/EN handling
                subprocess.run(["say", "-v", "Tingting", text])
                
                if self.stream_obj: self.stream_obj.start()

        threading.Thread(target=_speak_thread).start()

    def call_openclaw_with_audio(self, audio_path):
        """Background thread to send audio path to Yu Jian Agent"""
        # DIRECT EXECUTION MODE (No HTTP/Gateway)
        print("⚡ Executing stt-whisper locally...")
        
        try:
            # 1. Transcribe using openai-whisper CLI
            print("⚡ Executing whisper locally...")
            result = subprocess.run(
                ["whisper", audio_path, "--model", "small", "--output_format", "txt", "--output_dir", "/tmp"],
                capture_output=True, text=True
            )
            
            # Read the transcript from the output file
            txt_file = audio_path.replace(".wav", ".txt")
            if os.path.exists(txt_file):
                with open(txt_file, "r") as f:
                    transcript = f.read().strip()
            else:
                transcript = result.stdout.strip()
            print(f"📝 Transcript: {transcript}")
            
            if not transcript:
                self.speak("没听清")
                return

            # 3. Synchronous Execution (Reliable)
            # We MUST wait for the server to process the request, otherwise the Agent might be killed.
            print("🚀 Sending command to Agent...")
            proxies = {"http": None, "https": None}
            
            url = "http://127.0.0.1:9527/v1/chat/completions"
            headers = {
                "Authorization": "Bearer yujian", "Content-Type": "application/json",
                "x-openclaw-agent-id": "main", "x-openclaw-session-key": "agent:main:voice"
            }
            
            # Update prompt: Execute -> Speak Result
            system_prompt = (
                "You are Yu Jian. User spoke a command via voice. "
                "1. Execute the command immediately. "
                "2. When finished, reply with the spoken result text directly. "
                "3. Keep it brief. No emojis.\n\n"
                "IMPORTANT: For screenshots, use ~/openclaw/skills/screenshot-mac/snap.sh "
                "or /usr/sbin/screencapture -x to take a NEW screenshot. "
                "Never send existing/old screenshots unless explicitly requested."
            )
            
            data = {
                "model": "openclaw",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": transcript}
                ]
            }
            
            try:
                # Give it enough time to actually do the work (screenshot, upload, etc.)
                response = requests.post(url, headers=headers, json=data, timeout=300, proxies=proxies)
                
                if response.status_code == 200:
                    res_json = response.json()
                    reply = res_json['choices'][0]['message']['content']
                    # Clean up
                    reply = re.sub(r'<think>.*?</think>', '', reply, flags=re.DOTALL).strip()
                    reply = re.sub(r'<final>(.*?)</final>', r'\1', reply, flags=re.DOTALL).strip()
                    
                    if reply:
                        self.speak(reply)
                else:
                    print(f"⚠️ Gateway Error: {response.status_code}")
                    self.speak("出错了")

            except requests.exceptions.Timeout:
                print("❌ Request timed out")
                self.speak("处理超时")
            except Exception as e:
                print(f"⚠️ Network error: {e}")
                self.speak("网络错误") 

        except Exception as e:
            print(f"❌ Execution failed: {e}")
            self.speak("执行出错")

        except Exception as e:
            print(f"❌ Execution failed: {e}")

    def save_audio(self):
        """Save recorded samples to WAV file"""
        samples = np.concatenate(self.recorded_samples)
        samples = (samples * 32767).astype(np.int16)
        with wave.open(self.temp_audio_path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(self.sample_rate)
            wf.writeframes(samples.tobytes())
        print(f"\n💾 Audio saved to {self.temp_audio_path}")

    def run(self):
        if not self.init_models(): return
        print("\n✅ System Ready. Say 'Yu Jian' or 'Xiao Ai'...")
        self.is_running = True
        
        with sd.InputStream(channels=1, dtype="float32", samplerate=self.sample_rate, 
                            callback=self.audio_callback, blocksize=self.samples_per_read) as stream:
            self.stream_obj = stream
            while self.is_running:
                try:
                    samples = self.audio_queue.get(timeout=0.1).reshape(-1)
                    self.vad.accept_waveform(samples)
                    is_speech = self.vad.is_speech_detected()
                    
                    if not self.is_listening:
                        # Standby Mode (Wake Word Search)
                        self.kws_stream.accept_waveform(self.sample_rate, samples)
                        while self.kws.is_ready(self.kws_stream):
                            self.kws.decode_stream(self.kws_stream)
                            if self.kws.get_result(self.kws_stream):
                                print("\n✨ Wake Word Detected")
                                self.speak("在的") 
                                self.is_listening = True
                                self.last_speech_time = time.time()
                                self.speech_start_time = time.time()
                                self.recorded_samples = []
                                self.kws_stream = self.kws.create_stream()
                    else:
                        # Interaction Mode (Recording Raw Audio)
                        self.recorded_samples.append(samples.copy())
                        if is_speech:
                            self.last_speech_time = time.time()
                            print(".", end="", flush=True)
                        
                        current_time = time.time()
                        # Stop recording if silence for threshold OR max time reached
                        if (current_time - self.last_speech_time > self.silence_threshold) or \
                           (current_time - self.speech_start_time > self.max_interaction_time):
                            
                            print("\n🎙️ Processing audio command...")
                            self.speak("收到") 
                            self.save_audio()
                            
                            # Background process the audio file
                            thread = threading.Thread(target=self.call_openclaw_with_audio, args=(self.temp_audio_path,))
                            thread.daemon = True
                            thread.start()
                            
                            self.is_listening = False
                except queue.Empty: pass
                except KeyboardInterrupt: self.is_running = False

if __name__ == "__main__":
    assistant = SmartAssistant()
    assistant.run()
