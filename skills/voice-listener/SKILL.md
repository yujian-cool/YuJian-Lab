---
name: voice-listener
description: Control the background voice wake-up service (Yu Jian/Xiao Ai).
metadata: {"openclaw":{"emoji":"👂","os":["darwin"],"service":"ai.openclaw.voice-listener"}}
---

# Voice Listener Skill

This skill manages the local wake-word listener (Sherpa ONNX) that triggers the agent via voice.

## Service Management

The listener runs as a macOS Launch Agent: `ai.openclaw.voice-listener`.

- **Status**: `launchctl list | grep voice-listener`
- **Start**: `launchctl load ~/Library/LaunchAgents/ai.openclaw.voice-listener.plist`
- **Stop**: `launchctl unload ~/Library/LaunchAgents/ai.openclaw.voice-listener.plist`
- **Logs**: `tail -f ~/.openclaw/logs/voice-listener.log`

## Configuration

Located in `~/openclaw/skills/voice-listener/`:
- `index.py`: Main logic (Wake word -> STT -> Agent API).
- `my_keywords.txt`: Wake words configuration.

## Dependencies

Requires `python3` (Homebrew) with:
- `sherpa-onnx`
- `sounddevice`
- `numpy`
- `requests`
