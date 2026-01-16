# AI Code Remote

Control your AI coding agent remotely via multiple messaging platforms. Start tasks locally, receive notifications when the AI completes them, and send new commands by simply replying to messages.

This project is based on and inspired by [Claude-Code-Remote](https://github.com/JessyTsui/Claude-Code-Remote).

**Supported Platforms:**
- 📧 **Email** - Traditional SMTP/IMAP integration with execution trace
- 📱 **Telegram** - Interactive bot with smart buttons ✅ **NEW**
- 💬 **LINE** - Rich messaging with token-based commands
- 🖥️ **Desktop** - Sound alerts and system notifications

<div align="center">
  
  ### 🎥 Watch Demo Video
  
  <a href="https://youtu.be/_yrNlDYOJhw">
    <img src="./assets/CCRemote_demo.png" alt="Claude Code Remote Demo" width="100%">
    <br>
    <img src="https://img.shields.io/badge/▶-Watch%20on%20YouTube-red?style=for-the-badge&logo=youtube" alt="Watch on YouTube">
  </a>
  
</div>

> 📣 Follow [@oliverhuynh](https://www.facebook.com/oliverhuynh) for updates and AI development insights

## ✨ Features

- **📧 Multiple Messaging Platforms**: 
  - Email notifications with full execution trace and reply-to-send commands ![](./assets/email_demo.png)
  - Telegram Bot with interactive buttons and slash commands ![](./assets/telegram_demo.png)
  - LINE messaging with token-based commands
  - Desktop notifications with sound alerts
- **🔄 Two-way Control**: Reply to messages or emails to send new commands
- **📱 Remote Access**: Control your AI from anywhere
- **🔒 Secure**: ID-based whitelist verification for all platforms
- **🔐 Webhook Hardening**: APP_SECRET + Telegram secret header verification
- **🧪 Email Sender Verification**: SPF/DKIM/DMARC enforcement with strict/relaxed modes
- **🧹 Redaction**: Secrets automatically redacted in replies and notifications
- **👥 Group Support**: Use in LINE groups or Telegram groups for team collaboration
- **🤖 Smart Commands**: Intuitive command formats for each platform
- **📋 Multi-line Support**: Send complex commands with formatting
- **⚡ Smart Monitoring**: Intelligent detection of AI responses with historical tracking
- **🔄 tmux Integration**: Seamless command injection into active tmux sessions
- **📊 Execution Trace**: Full terminal output capture in email notifications

## 📅 Changelog

See `changes.md`.

## 📋 TODO List

### Notification Channels
- ~~**📱 Telegram Integration**~~ ✅ **COMPLETED** - Bot integration with interactive buttons and real-time commands
- **💬 Discord Integration** - Bot integration for messaging platforms
- **⚡ Slack Workflow** - Native Slack app with slash commands

### Developer Tools
- **🤖 AI Tools Support** - Integration with Gemini CLI, Cursor, and other AI development tools
- **🔀 Git Automation** - Auto-commit functionality, PR creation, branch management

### Usage Analytics
- **💰 Cost Tracking** - Token usage monitoring and estimated costs
- **⚡ Performance Metrics** - Execution time tracking and resource usage analysis
- **📧 Scheduled Reports** - Daily/weekly usage summaries delivered via email

### Native Apps
- **📱 Mobile Apps** - iOS and Android applications for remote AI control
- **🖥️ Desktop Apps** - macOS and Windows native clients with system integration

## 🚀 Quick Start

### 1. Prerequisites

**System Requirements:**
- Node.js >= 14.0.0
- For default PTY mode: no tmux required (recommended for本地直接用)
- For tmux mode: tmux + an active session with Claude Code running

### 2. Install

```bash
git clone https://github.com/oliverhuynh/ultimate-code-remote.git
cd ultimate-code-remote
npm install
```

### 3. Interactive Setup (Recommended)

```bash
npm run setup
```

- 引导式填写 Email / Telegram / LINE 配置，生成 `.env`
- 自动把 Claude hooks 合并进 `~/.claude/settings.json`
- 可随时重跑更新密钥/切换渠道
- 如需手动配置或离线编辑 `.env`，见下方“手动配置”

### 4. 手动配置（可选，跳过如果已运行 `npm run setup`）

#### Option A: Configure Email (Recommended for Beginners)

```bash
# Copy example config
cp .env.example .env

# Edit with your email credentials
nano .env
```

**Required email settings:**
```env
EMAIL_ENABLED=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
IMAP_USER=your-email@gmail.com  
IMAP_PASS=your-app-password
EMAIL_TO=your-notification-email@gmail.com
ALLOWED_SENDERS=your-notification-email@gmail.com
SESSION_MAP_PATH=/your/path/to/ultimate-code-remote/src/data/session-map.json
EMAIL_AUTH_MODE=strict
```

📌 **Gmail users**: Use [App Passwords](https://myaccount.google.com/security), not your regular password.

#### Option B: Configure Telegram ✅ **NEW**

**Quick Setup:**
```bash
chmod +x setup-telegram.sh
./setup-telegram.sh
```

### Security Hardening (Recommended)

Add these to `.env`:

```env
# Webhook secret (shared across Telegram/LINE)
# If not set, it will be generated in-memory when starting webhooks.
# APP_SECRET=

# Email sender verification
EMAIL_AUTH_MODE=strict   # strict | relaxed

# Rate limiting (lenient defaults)
RATE_LIMIT_WINDOW_MS=300000
RATE_LIMIT_PER_SENDER=60
RATE_LIMIT_PER_SESSION=120

# Command safety
COMMAND_MAX_LENGTH=1000

# Auto-approval (opt-in)
AUTO_APPROVAL_ENABLED=false
AUTO_APPROVAL_SECRET=change-me

# Redaction
REDACT_SECRETS=true
# REDACT_KEYS=EXTRA_SECRET_1,EXTRA_SECRET_2

# Outbound allowlist (comma-separated hostnames, supports *.domain)
# If unset, defaults to api.telegram.org,api.line.me
# OUTBOUND_ALLOWLIST=api.telegram.org,api.line.me

# Telegram message max length (default 3500)
# TELEGRAM_MAX_LENGTH=3500

# LINE message max length (default 1500)
# LINE_MAX_LENGTH=1500
```

Notes:
- **APP_SECRET** is required in webhook URLs and Telegram's secret header.
- **EMAIL_AUTH_MODE=strict** hard-fails when SPF/DKIM/DMARC does not pass or headers are missing.
- Set `EMAIL_AUTH_MODE=relaxed` if your provider omits auth headers (warnings will be logged).

### Using Codex (Optional Runner)

To run tasks with the OpenAI Codex CLI instead of Claude Code, install and authenticate `codex` locally, then set the runner env vars below.

**Prerequisites**
- `codex` CLI installed and authenticated on the machine running this repo.

**Read-only sandbox example**
```env
RUNNER=codex
CODEX_BIN=codex
CODEX_SANDBOX=read-only
WORKDIR=/path/to/ultimate-code-remote
```

**Workspace-write sandbox example**
```env
RUNNER=codex
CODEX_BIN=codex
CODEX_SANDBOX=workspace-write
WORKDIR=/path/to/ultimate-code-remote
```

**Optional flags**
```env
CODEX_ARGS=--some-extra-flag
CODEX_FULL_AUTO=false
CODEX_SKIP_GIT_CHECK=false
```

**Resume behavior**
- The last Codex session ID is stored per token under `~/.ultimate-code-remote/codex-session-map.json`.
- Follow-up commands resume that session automatically when available.

### Sync Existing Codex Sessions

If you already have Codex sessions stored under `~/.codex/sessions`, you can import them to this tool so you can resume/switch sessions.

```bash
# List sessions from ~/.codex/sessions
ultimate-code-remote codex sync list

# Import a specific session by id
ultimate-code-remote codex sync import --id <codex_session_id>

# Import all sessions (dry-run)
ultimate-code-remote codex sync import --all --dry-run
ultimate-code-remote codex sync import --all --auto-add -y

# Migrate legacy map to raw token keys
ultimate-code-remote codex sync --migrate-map --dry-run
ultimate-code-remote codex sync --migrate-map
ultimate-code-remote codex sync --migrate-map --auto-add
ultimate-code-remote codex sync --migrate-map --auto-add -y
```

Notes:
- By default, imports are mapped to the raw token in `~/.ultimate-code-remote/codex-session-map.json`.
- Use `--session-key` or `--bind` to bind a specific key if needed.
- Use `--auto-add` to register missing repos (confirmation required unless `-y`).
- Use `-y` to auto-confirm repo adds.

### Migrate Legacy Codex Session Map

If you previously mapped Codex sessions to `email:<sessionId>`, use `--migrate-map` on the sync script.
Notes:
- Migration generates raw token mappings and removes legacy keys.
- It attempts to resolve `cwd` from `~/.codex/sessions` to register tokens in the local session store.
- Use `--auto-add` to register repos discovered during migration.
- Use `-y` to auto-confirm repo adds.

**Security note**
- Do **not** use `CODEX_SANDBOX=danger-full-access` unless you fully understand the risks.

### Multi-Repo (All Channels, Single Bot/Webhook)

If you want one bot handling multiple repos (Telegram/LINE/email), sessions are stored per repo under `~/.ultimate-code-remote/<repo-name>/sessions`, and token lookup is indexed globally.

**Steps**
1. Register repos (required, no default; unregistered repos will error):
   ```bash
   ultimate-code-remote repo add my-repo /path/to/repo
   ```

2. Start the webhook (one process only):
   ```bash
   ultimate-code-remote
   ```

3. In each repo where you send notifications, set:
   ```env
   WORKDIR=/path/to/that/repo
   ```

4. Tokens will route to the correct repo via `~/.ultimate-code-remote/tokens.json`.

**Storage layout**
- `~/.ultimate-code-remote/repos.json` → repoName → workdir
- `~/.ultimate-code-remote/tokens.json` → token → repoName + sessionId
- `~/.ultimate-code-remote/sessions.json` → sessionId → repoName
- `~/.ultimate-code-remote/<repo-name>/sessions/*.json` → full session payloads

### Repo Manager (ultimate-code-remote)

Use the built-in repo manager to keep a list of repos you control:

```bash
ultimate-code-remote repo list
ultimate-code-remote repo add my-repo /path/to/repo
ultimate-code-remote repo init
ultimate-code-remote repo remove my-repo
ultimate-code-remote sessions list
ultimate-code-remote sessions list --repo my-repo
ultimate-code-remote sessions reindex
ultimate-code-remote sessions new --repo my-repo
```

Repo data is stored under `~/.ultimate-code-remote/repos.json`.

### ultimate-code-remote Commands

Start ngrok + all enabled platforms (Telegram/LINE/email relay):
```bash
ultimate-code-remote
```

Dry-run to see what would start:
```bash
ultimate-code-remote --dry-run
```

Start a specific platform:
```bash
ultimate-code-remote telegram
ultimate-code-remote line
ultimate-code-remote email
ultimate-code-remote webhooks
ultimate-code-remote ngrok
```

### One-Command Ngrok Launcher

This will start ngrok on your webhook port, update `.env` with the public URL, then start all enabled services:

```bash
ultimate-code-remote ngrok
```

Config:
```env
TELEGRAM_WEBHOOK_PORT=3001
NGROK_BIN=ngrok
```

### Telegram Bot Admin Commands

You can run repo/session listing commands directly in Telegram:

```
/repo list
/repo work-on --repo my-repo
/sessions list
/sessions list --repo my-repo
/sessions new --repo my-repo
/work-on <TOKEN>
```

**Token behavior**
- Tokens do not expire.
- Set a working token with `/work-on <TOKEN>` or `/repo work-on --repo <name>` to send commands without repeating the token.

**Manual Setup:**
1. Create bot via [@BotFather](https://t.me/BotFather)
2. Get your Chat ID from bot API
3. Configure webhook URL (use ngrok for local testing)

**Required Telegram settings:**
```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_CHAT_ID=your-chat-id-here
WEBHOOK_BASE_URL=https://your-ngrok-url.app
SESSION_MAP_PATH=/your/path/to/ultimate-code-remote/src/data/session-map.json
```

**Optional Telegram settings:**
```env
# Force IPv4 connections to Telegram API (default: false)
# Enable this if you experience connectivity issues with IPv6
TELEGRAM_FORCE_IPV4=true
```

**Network Configuration Notes:**
- **IPv4 vs IPv6**: Some network environments may have unstable IPv6 connectivity to Telegram's API servers
- **When to use `TELEGRAM_FORCE_IPV4=true`**:
  - Connection timeouts or failures when sending messages
  - Inconsistent webhook delivery
  - Network environments that don't properly support IPv6
- **Default behavior**: Uses system default (usually IPv6 when available, fallback to IPv4)
- **Performance impact**: Minimal - only affects initial connection establishment

#### Option C: Configure LINE

**Required LINE settings:**
```env
LINE_ENABLED=true
LINE_CHANNEL_ACCESS_TOKEN=your-token
LINE_CHANNEL_SECRET=your-secret
LINE_USER_ID=your-user-id
```

#### Configure Claude Code Hooks（仅在跳过 `npm run setup` 时需要）

Create hooks configuration file:

**Method 1: Global Configuration (Recommended)**
```bash
# Add to ~/.claude/settings.json
{
  "hooks": {
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node /your/path/to/ultimate-code-remote/claude-hook-notify.js completed",
        "timeout": 5
      }]
    }],
    "SubagentStop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node /your/path/to/ultimate-code-remote/claude-hook-notify.js waiting",
        "timeout": 5
      }]
    }]
  }
}
```

**Method 2: Project-Specific Configuration**
```bash
# Set environment variable
export CLAUDE_HOOKS_CONFIG=/your/path/to/ultimate-code-remote/claude-hooks.json
```

> **Note**: Subagent notifications are disabled by default. To enable them, set `enableSubagentNotifications: true` in your config. See [Subagent Notifications Guide](./docs/SUBAGENT_NOTIFICATIONS.md) for details.

### 5. 启动 Claude（按你的注入模式选择）

- **默认 PTY 模式（无需 tmux）**：直接在终端运行 `claude-code --config /path/to/your/claude/settings.json`
- **如果你选择 tmux 模式**：
  ```bash
  tmux new-session -d -s claude-session
  tmux attach-session -t claude-session
  claude-code --config /path/to/your/claude/settings.json
  ```
  > Detach: Ctrl+B 然后 D

> **Note**: Interactive setup 已合并 hooks 到 `~/.claude/settings.json`。若跳过，请确保手动配置 hooks。

### 6. Start Services

#### For All Platforms (Recommended)
```bash
# Automatically starts all enabled platforms
npm run webhooks
# or
node start-all-webhooks.js
```

#### For Individual Platforms

**For Email:**
```bash
npm run daemon:start
# or
node claude-remote.js daemon start
```

**For Telegram:**
```bash
npm run telegram
# or
node start-webhook-master.js
```

**For LINE:**
```bash
npm run line
# or
node start-line-webhook.js
```

### 7. Test Your Setup

**Quick Test:**
```bash
# Test all notification channels
node claude-hook-notify.js completed
# Should receive notifications via all enabled platforms
```

**Full Test:**
1. Start Claude in tmux session with hooks enabled
2. Run any command in Claude
3. Check for notifications (email/Telegram/LINE)
4. Reply with new command to test two-way control

## 🎮 How It Works

1. **Use your AI normally** in tmux session
2. **Get notifications** when the AI completes tasks via:
   - 🔊 **Sound alert** (Desktop)
   - 📧 **Email notification with execution trace** (if enabled)
   - 📱 **Telegram message with buttons** (if enabled)
   - 💬 **LINE message** (if enabled)
3. **Reply with commands** using any platform
4. **Commands execute automatically** in the AI session

### Platform Command Formats

**Email:**
```
Simply reply to notification email with your command
No special formatting required
```

**Telegram:** ✅ **NEW**
```
Click smart button to get format:
📝 Personal Chat: /cmd TOKEN123 your command here
👥 Group Chat: @bot_name /cmd TOKEN123 your command here
```

**LINE:**
```
Token ABC12345 your command here
Or set a working token first, then just send: your command here
```

**Reply format (Telegram/LINE):**
```
📝 Reply on [TOKEN] your command preview:
<response body>
```
If the token matches your working token, the header is omitted for a cleaner reply. Long responses are split into multiple messages instead of being truncated.

**Local fallback (no tmux)**  
- 默认 `INJECTION_MODE=pty`：命令通过 PTY/智能粘贴注入，不依赖 tmux  
- macOS 可自动复制/粘贴到 Claude/终端；若自动注入失败，会把命令复制到剪贴板并弹出提醒

### Advanced Configuration

**Email Notification Options**

1. **Subagent Activities in Email**

   By default, email notifications only show the execution trace. You can optionally enable a separate subagent activities summary section:

   ```json
   // In your config/config.json
   {
     "showSubagentActivitiesInEmail": true  // Default: false
   }
   ```

   When enabled, emails will include:
   - **Subagent Activities Summary**: A structured list of all subagent activities
   - **Full Execution Trace**: The complete terminal output

   Since the execution trace already contains all information, this feature is disabled by default to keep emails concise.

2. **Execution Trace Display**

   You can control whether to include the execution trace in email notifications:

   ```json
   // In your email channel configuration
   {
     "email": {
       "config": {
         "includeExecutionTrace": false  // Default: true
       }
     }
   }
   ```

   - When `true` (default): Shows a scrollable execution trace section in emails
   - When `false`: Removes the execution trace section entirely from emails

   This is useful if you find the execution trace too verbose or if your email client has issues with scrollable content.

## 💡 Use Cases

- **Remote Code Reviews**: Start reviews at office, continue from home via any platform
- **Long-running Tasks**: Monitor progress and guide next steps remotely
- **Multi-location Development**: Control Claude from anywhere without VPN
- **Team Collaboration**: Share Telegram groups for team notifications
- **Mobile Development**: Send commands from phone via Telegram

## 🔧 Commands

### Setup
```bash
npm run setup   # Interactive wizard to create .env and merge hooks into ~/.claude/settings.json
```

### Testing & Diagnostics
```bash
# Test all notification channels
node claude-hook-notify.js completed

# Test specific platforms
node test-telegram-notification.js
node test-real-notification.js
node test-injection.js

# System diagnostics
node claude-remote.js diagnose
node claude-remote.js status
node claude-remote.js test
```

### Service Management
```bash
# Start all enabled platforms
npm run webhooks

# Individual services
npm run telegram         # Telegram webhook
npm run line            # LINE webhook  
npm run daemon:start    # Email daemon

# Stop services
npm run daemon:stop     # Stop email daemon
```

## 🔍 Troubleshooting

### Common Issues

**Not receiving notifications from Claude?**
1. Check hooks configuration in tmux session:
   ```bash
   echo $CLAUDE_HOOKS_CONFIG
   ```
2. Verify Claude is running with hooks enabled
3. Test notification manually:
   ```bash
   node claude-hook-notify.js completed
   ```

**Telegram bot not responding?** ✅ **NEW**
```bash
# Test bot connectivity
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\": $TELEGRAM_CHAT_ID, \"text\": \"Test\"}"

# Check webhook status
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

**Commands not executing in Claude?**
```bash
# Check tmux session exists
tmux list-sessions

# Verify injection mode
grep INJECTION_MODE .env  # Should be 'tmux'

# Test injection
node test-injection.js
```

**Not receiving emails?**
- Run `node claude-remote.js test` to test email setup
- Check spam folder
- Verify SMTP settings in `.env`
- For Gmail: ensure you're using App Password

### Debug Mode
```bash
# Enable detailed logging
LOG_LEVEL=debug npm run webhooks
DEBUG=true node claude-hook-notify.js completed
```

## 🛡️ Security

### Multi-Platform Authentication
- ✅ **Email**: Sender whitelist via `ALLOWED_SENDERS` environment variable
- ✅ **Telegram**: Bot token and chat ID verification
- ✅ **LINE**: Channel secret and access token validation
- ✅ **Session Tokens**: 8-character alphanumeric tokens for command verification

### Session Security
- ✅ **Session Isolation**: Each token controls only its specific tmux session
- ✅ **Auto Expiration**: Sessions timeout automatically after 24 hours
- ✅ **Token-based Commands**: All platforms require valid session tokens
- ✅ **Minimal Data Storage**: Session files contain only necessary information

## 🤝 Contributing

Found a bug or have a feature request? 

- 🐛 **Issues**: [GitHub Issues](https://github.com/oliverhuynh/ultimate-code-remote/issues)
- 🐦 **Updates**: Follow [@Jiaxi_Cui](https://x.com/Jiaxi_Cui) on Twitter
- 💬 **Discussions**: Share your use cases and improvements

## 📄 License

MIT License - Feel free to use and modify!

---

**🚀 Make Claude Code truly remote and accessible from anywhere!**

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=oliverhuynh/ultimate-code-remote&type=Date)](https://star-history.com/#oliverhuynh/ultimate-code-remote&Date)

⭐ **Star this repo** if it helps you code more efficiently!

> 💡 **Tip**: Enable multiple notification channels for redundancy - never miss a Claude completion again!
