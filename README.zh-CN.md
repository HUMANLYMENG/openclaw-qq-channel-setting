# Clawdbot QQ 通道配置包（NapCat / OneBot11）

这是一个**最小化配置模板**，用于让 Clawdbot 通过 NapCat 接入 QQ。
不需要上传任何插件代码（Clawdbot 自带 QQ 插件）。

## 你需要准备
- 已安装并运行的 Clawdbot
- 已安装并运行的 NapCat（OneBot11）

## 快速配置
1) 选一个共享 Token（两个配置里必须一致）。
2) 配置 NapCat，把事件推送到 Clawdbot。
3) 配置 Clawdbot，通过 NapCat 发送消息。
4) 重启两个服务。
5) 发送 QQ 消息测试。

## NapCat 配置模板
把模板内容写入 NapCat 的 OneBot11 配置文件。
见 `napcat-onebot11-template.json`。

## Clawdbot 配置模板
把 `clawdbot-qq-channel.json` 合并到 `~/.clawdbot/clawdbot.json`。

## 重要说明
- **不要**在 Clawdbot 配置里添加 `plugins.load.paths` 指向自定义 QQ 插件，直接使用内置插件。
- 如果 NapCat 和 Clawdbot 不在同一台机器，把 `127.0.0.1` 改成对方可访问的 IP。
- 确保端口在防火墙中已放行。

## 重启
- NapCat：重启 NapCat 进程/服务
- Clawdbot：`sudo systemctl restart clawdbot-gateway.service`

## 测试
给机器人 QQ 账号发送消息，应该会收到回复。
