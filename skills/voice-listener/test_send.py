import requests
import json

url = "http://127.0.0.1:9527/v1/chat/completions"
headers = {
    "Authorization": "Bearer yujian", 
    "Content-Type": "application/json",
    "x-openclaw-agent-id": "main", 
    "x-openclaw-session-key": "agent:main:voice"
}

system_prompt = (
    "You are Yu Jian. User spoke a command via background voice listener. "
    "1. Execute the command immediately. "
    "2. When done, report the result verbally. "
    "3. USE YOUR SKILLS: Call 'tts' to generate audio, then 'exec' to play it (afplay path). "
    "4. Fallback: If tts fails, use 'exec' to run: say \"Report\""
)

transcript = "给我的message发消息测试123"

data = {
    "model": "openclaw",
    "messages": [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": transcript}
    ]
}

print(f"🚀 Sending test command to {url}...")
print(f"Target Session: {headers['x-openclaw-session-key']}")

proxies = {"http": None, "https": None}

try:
    response = requests.post(url, headers=headers, json=data, timeout=30, proxies=proxies)
    print(f"✅ Response Status: {response.status_code}")
    print(f"📄 Response Body: {response.text[:200]}...") 
except requests.exceptions.Timeout:
    print("❌ Timeout (expected if async logic is slow but server should respond)")
except Exception as e:
    print(f"❌ Error: {e}")
