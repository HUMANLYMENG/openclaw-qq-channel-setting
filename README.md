# Clawdbot QQ Channel Kit (NapCat / OneBot11)

中文说明: README.zh-CN.md

This kit contains **minimal config templates** to enable Clawdbot QQ channel via NapCat.
No plugin code is required (Clawdbot ships the QQ plugin by default).

## What you need
- Clawdbot installed and running
- NapCat (OneBot11) installed and running

## Quick setup
1) Pick a shared token (same token in both configs).
2) Configure NapCat to push events to Clawdbot.
3) Configure Clawdbot to send messages via NapCat.
4) Restart both services.
5) Send a QQ message to test.

## NapCat config template
Edit and place the JSON in your NapCat OneBot11 config file.
See `napcat-onebot11-template.json`.

## Clawdbot config template
Merge `clawdbot-qq-channel.json` into `~/.clawdbot/clawdbot.json`.

## Important notes
- Do **NOT** add a custom `plugins.load.paths` entry for QQ. Use the built-in plugin.
- If NapCat and Clawdbot are on different machines, replace 127.0.0.1 with the reachable IP.
- Make sure the ports are open in your firewall.

## Restart
- NapCat: restart your NapCat process/service
- Clawdbot: `sudo systemctl restart clawdbot-gateway.service`

## Test
Send a QQ message to the bot account. It should reply.
