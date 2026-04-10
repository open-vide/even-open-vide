# @openvide/daemon

Background session manager for AI CLI tools (Claude Code, Codex, Gemini) with HTTP bridge, WebSocket streaming, and TLS support.

## What it does

Runs as a background service on your local machine or VPS. Manages persistent sessions with AI coding tools and streams their output to the OpenVide G2 glasses app in real-time.

```
Glasses App ←→ HTTP Bridge (TLS) ←→ Daemon ←→ Claude / Codex / Gemini
```

## Install

```bash
npm install -g @openvide/daemon
```

**Requirements:** Node.js 18+ and at least one AI CLI tool:

```bash
npm install -g @anthropic-ai/claude-code   # Claude Code
# or set OPENAI_API_KEY for Codex
# or set GOOGLE_API_KEY for Gemini
```

## Quick Start

```bash
# Verify daemon is running
openvide-daemon health

# Create a session
openvide-daemon session create --tool claude --cwd ~/my-project

# Send a prompt
openvide-daemon session send --id ses_abc123 --prompt "Fix the login bug"

# Stream live output
openvide-daemon session stream --id ses_abc123 --follow
```

The daemon auto-starts on first command. No manual setup needed for local use.

## Connect Your Glasses

1. Install the **OpenVide** app on Even Hub
2. Run `openvide-daemon health` on your machine
3. The bridge starts on port **7842** with a self-signed TLS cert
4. Scan the QR code from the OpenVide app to connect
5. Your glasses now show live AI output

## CLI Commands

### Session Management

```bash
openvide-daemon session create --tool <claude|codex|gemini> --cwd <path> [--model <id>]
openvide-daemon session send --id <id> --prompt <text> [--mode <code|chat|plan>]
openvide-daemon session stream --id <id> [--follow] [--offset <line>]
openvide-daemon session cancel --id <id>
openvide-daemon session list
openvide-daemon session get --id <id>
openvide-daemon session history --id <id>
openvide-daemon session remove --id <id>
openvide-daemon session wait-idle --id <id> [--timeout-ms <ms>]
```

### Native Sessions

Discover Claude/Codex sessions already on your filesystem:

```bash
openvide-daemon session list-native --cwd ~/project [--tool claude]
openvide-daemon session list-workspace --cwd ~/project
```

### File System

```bash
openvide-daemon fs list --path ~/project
openvide-daemon fs read --path ~/project/main.ts [--offset 0] [--limit 100]
openvide-daemon fs stat --path ~/project
```

### Other

```bash
openvide-daemon version
openvide-daemon health
openvide-daemon stop
openvide-daemon model list --tool codex
openvide-daemon keygen [--host remote.example.com] [--username ubuntu]
```

## Architecture

```
~/.openvide-daemon/
├── daemon.sock         # IPC Unix socket
├── daemon.pid          # Process ID
├── daemon.log          # Logs
├── bridge/
│   ├── cert.pem        # Auto-generated TLS cert
│   ├── key.pem         # ECDSA private key
│   └── token.txt       # Auth token
└── sessions/
    └── ses_abc123/
        └── output.jsonl
```

The daemon listens on a Unix socket for IPC. The HTTP bridge wraps it with HTTPS + WebSocket for remote access (phone/glasses).

## HTTP Bridge API

The bridge runs on port **7842** (configurable via `BRIDGE_PORT`).

**Authentication:** Every request needs `Authorization: Bearer <token>` where the token is in `~/.openvide-daemon/bridge/token.txt`.

### REST

```bash
TOKEN=$(cat ~/.openvide-daemon/bridge/token.txt)

# Health check
curl -H "Authorization: Bearer $TOKEN" https://localhost:7842/api/host

# RPC command
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cmd": "session.list"}' \
  https://localhost:7842/api/rpc
```

### WebSocket

```javascript
const ws = new WebSocket('wss://localhost:7842/ws?token=<token>');

// Send command
ws.send(JSON.stringify({ id: 1, cmd: 'session.list' }));

// Subscribe to live output
ws.send(JSON.stringify({ id: 2, cmd: 'subscribe', sessionId: 'ses_abc123' }));

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // msg.type === 'output' for live stream lines
  // msg.type === 'rpc' for command responses
};
```

## TLS

The bridge auto-generates a self-signed ECDSA certificate on first run. This works for local connections and the glasses app (which trusts self-signed certs).

For production/VPS deployments, use a reverse proxy with a real certificate:

**Caddy (recommended):**

```caddyfile
openvide.example.com {
  reverse_proxy localhost:7842
}
```

Caddy auto-provisions Let's Encrypt certificates.

**Rotate certificates:**

```bash
rm ~/.openvide-daemon/bridge/cert.pem ~/.openvide-daemon/bridge/key.pem
openvide-daemon health  # Regenerates
```

## Deploy on a VPS

### 1. Install

```bash
ssh ubuntu@your-vps.example.com

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install daemon + AI tool
sudo npm install -g @openvide/daemon
sudo npm install -g @anthropic-ai/claude-code

# Set API key
echo 'export ANTHROPIC_API_KEY=sk-ant-...' >> ~/.bashrc
source ~/.bashrc
```

### 2. Start

```bash
openvide-daemon health
cat ~/.openvide-daemon/bridge/token.txt  # Save this token
```

### 3. Keep it running (systemd)

Create `/etc/systemd/system/openvide.service`:

```ini
[Unit]
Description=OpenVide Daemon
After=network.target

[Service]
Type=simple
User=ubuntu
Environment=ANTHROPIC_API_KEY=sk-ant-...
ExecStart=/usr/local/bin/openvide-daemon health
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable openvide
sudo systemctl start openvide
```

### 4. TLS with a real domain

Install Caddy:

```bash
sudo apt install -y caddy
```

Edit `/etc/caddy/Caddyfile`:

```caddyfile
openvide.example.com {
  reverse_proxy localhost:7842
}
```

```bash
sudo systemctl restart caddy
```

Now connect your glasses to `https://openvide.example.com` with the token.

### 5. Firewall

```bash
sudo ufw allow 443    # HTTPS (Caddy)
sudo ufw allow 22     # SSH
sudo ufw enable
```

Don't expose port 7842 directly — let Caddy handle TLS termination.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BRIDGE_PORT` | 7842 | HTTP bridge port |
| `BRIDGE_TOKEN` | auto-generated | Override auth token |
| `ANTHROPIC_API_KEY` | — | Required for Claude Code |
| `OPENAI_API_KEY` | — | Required for Codex |
| `GOOGLE_API_KEY` | — | Required for Gemini |

## Troubleshooting

**Daemon won't start:**
```bash
tail -f ~/.openvide-daemon/daemon.log
rm ~/.openvide-daemon/daemon.sock  # Remove stale socket
```

**"Invalid API key" in chat:**
Set the API key for your AI tool in the daemon's environment, not the glasses app.

**Can't connect from glasses:**
```bash
openvide-daemon health              # Is daemon running?
lsof -i :7842                       # Is bridge listening?
cat ~/.openvide-daemon/bridge/token.txt  # Correct token?
```

**Session shows no output:**
Verify the AI tool works standalone: `claude --version` or `codex --version`.

## License

MIT
