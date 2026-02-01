# Clawdbot QQ Channel Kit (NapCat / OneBot11)

[中文说明](README.zh-CN.md)

This is a **complete QQ plugin package** with configuration files and fixed plugin code.

## ⚠️ Important Update

**This version includes a fix for concurrent message streaming conflicts!**

If you encountered this error:
```
Unexpected event order, got message_start before receiving "message_stop"
```

This version has fixed it. The fix works by adding a message queue for each chat to ensure messages from the same chat are processed sequentially, preventing streaming state conflicts.

## What you need

- Clawdbot installed and running
- NapCat (OneBot11) installed and running

## Quick setup

### 1. Configure NapCat
Merge the content of `napcat-onebot11-template.json` into your NapCat OneBot11 config file.

**Important:** Replace `YOUR_SHARED_TOKEN` with your own token (must match on both sides).

### 2. Configure Clawdbot
Merge `clawdbot-qq-channel.json` into `~/.clawdbot/clawdbot.json`.

**Important:** Replace `YOUR_SHARED_TOKEN` with the same token as NapCat.

### 3. Install the fixed plugin

**Method A: Replace built-in plugin (recommended)**
```bash
# Backup original plugin
cp -r ~/.nvm/versions/node/v22.22.0/lib/node_modules/clawdbot/extensions/qq \
      ~/.nvm/versions/node/v22.22.0/lib/node_modules/clawdbot/extensions/qq.backup

# Copy fixed plugin
cp -r extensions/qq/* \
      ~/.nvm/versions/node/v22.22.0/lib/node_modules/clawdbot/extensions/qq/
```

**Method B: Use custom plugin path**
Add to `~/.clawdbot/clawdbot.json`:
```json
{
  "plugins": {
    "load": {
      "paths": ["/path/to/openclaw-qq-channel-setting/extensions"]
    }
  }
}
```

### 4. Restart services
```bash
# Restart NapCat (depends on your installation)
# e.g.: systemctl restart napcat

# Restart Clawdbot
clawdbot gateway restart
```

### 5. Test
Send a QQ message to the bot account. It should reply.

**Test concurrency:** Send multiple messages quickly in succession to confirm no streaming errors occur.

## Important notes

- If NapCat and Clawdbot are on different machines, replace `127.0.0.1` with the reachable IP.
- Make sure the ports are open in your firewall.
- If Clawdbot updates and overwrites the plugin, you'll need to reapply the fix.

## Fix details

### Problem
Sending messages quickly or having long conversations causes:
```
Unexpected event order, got message_start before receiving "message_stop"
```

### Cause
Multiple webhook events enter the streaming handler concurrently, causing state confusion.

### Solution
Added a message queue mechanism in `extensions/qq/src/webhook.ts`:
- Each chat (group or private) has its own processing queue
- Messages from the same chat are processed sequentially; the next one starts only after the previous one completes
- Different chats can still process concurrently without affecting performance

### Modified files
- `extensions/qq/src/webhook.ts` - Added `chatQueues` and `enqueueForChat` functions

## Troubleshooting

### Still getting streaming errors
1. Confirm you've restarted the Clawdbot service
2. Check if the plugin files were correctly replaced
3. View logs: `clawdbot logs --follow`

### Not receiving replies
1. Check if NapCat and Clawdbot tokens match
2. Check if webhook URL is correctly configured
3. Check if ports are open

### Group chat requires @ mention to reply
Set in `~/.clawdbot/clawdbot.json`:
```json
{
  "channels": {
    "qq": {
      "requireMention": false
    }
  }
}
```

## Contributing
If you find issues or have suggestions, feel free to submit an issue or PR.

## License
MIT License
