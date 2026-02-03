# Email Agent Skill

This skill allows the agent to check multiple email inboxes (Gmail, Exmail) for new messages.
It maintains state (last checked UID) to only return *new* messages since the last run.

## Usage

```bash
node /Users/yujian/openclaw/skills/email-agent/fetch.js
```

## Output

Returns a JSON array of new email objects:
```json
[
  {
    "account": "Gmail",
    "uid": 12345,
    "from": "Sender Name <sender@example.com>",
    "subject": "Hello",
    "date": "2026-01-30T...",
    "snippet": "Email body content..."
  }
]
```

## Configuration

Credentials are loaded from `~/.openclaw/.env`.
State is stored in `~/.openclaw/email-agent-state.json`.
