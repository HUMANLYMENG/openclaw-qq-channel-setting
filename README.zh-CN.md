# Clawdbot QQ 通道配置包（NapCat / OneBot11）

这是一个**完整的QQ插件包**，包含配置文件和修复后的插件代码。

## ⚠️ 重要更新

**此版本包含了针对并发消息streaming冲突的修复！**

如果你遇到以下错误：
```
Unexpected event order, got message_start before receiving "message_stop"
```

这个版本已经修复了这个问题。修复原理：为每个chat添加消息队列，确保同一个聊天的消息按顺序处理，避免streaming状态冲突。

## 你需要准备
- 已安装并运行的 Clawdbot
- 已安装并运行的 NapCat（OneBot11）

## 快速配置

### 1. 配置 NapCat
把 `napcat-onebot11-template.json` 的内容合并到 NapCat 的 OneBot11 配置文件。

**重要：** 把 `YOUR_SHARED_TOKEN` 替换成你自己的token（两边配置必须一致）。

### 2. 配置 Clawdbot
把 `clawdbot-qq-channel.json` 合并到 `~/.clawdbot/clawdbot.json`。

**重要：** 把 `YOUR_SHARED_TOKEN` 替换成和NapCat一样的token。

### 3. 安装修复后的插件

**方法A：替换内置插件（推荐）**
```bash
# 备份原插件
cp -r ~/.nvm/versions/node/v22.22.0/lib/node_modules/clawdbot/extensions/qq \
      ~/.nvm/versions/node/v22.22.0/lib/node_modules/clawdbot/extensions/qq.backup

# 复制修复后的插件
cp -r extensions/qq/* \
      ~/.nvm/versions/node/v22.22.0/lib/node_modules/clawdbot/extensions/qq/
```

**方法B：使用自定义插件路径**
在 `~/.clawdbot/clawdbot.json` 中添加：
```json
{
  "plugins": {
    "load": {
      "paths": ["/path/to/openclaw-qq-channel-setting/extensions"]
    }
  }
}
```

### 4. 重启服务
```bash
# 重启 NapCat（根据你的安装方式）
# 例如：systemctl restart napcat

# 重启 Clawdbot
clawdbot gateway restart
```

### 5. 测试
给机器人 QQ 账号发送消息，应该会收到回复。

**测试并发：** 快速连续发送多条消息，确认不会出现streaming错误。

## 重要说明
- 如果 NapCat 和 Clawdbot 不在同一台机器，把 `127.0.0.1` 改成对方可访问的 IP。
- 确保端口在防火墙中已放行。
- 如果Clawdbot更新后插件被覆盖，需要重新应用修复。

## 修复详情

### 问题
快速发送消息或对话多了会出现：
```
Unexpected event order, got message_start before receiving "message_stop"
```

### 原因
多个webhook事件并发进入streaming处理器，导致状态混乱。

### 解决方案
在 `extensions/qq/src/webhook.ts` 中添加了消息队列机制：
- 每个chat（群聊或私聊）有独立的处理队列
- 同一个chat的消息按顺序处理，前一个完成后才开始下一个
- 不同chat之间仍然可以并发，不影响性能

### 修改的文件
- `extensions/qq/src/webhook.ts` - 添加了 `chatQueues` 和 `enqueueForChat` 函数

## 故障排除

### 仍然出现streaming错误
1. 确认已经重启了Clawdbot服务
2. 检查是否正确替换了插件文件
3. 查看日志：`clawdbot logs --follow`

### 消息收不到回复
1. 检查NapCat和Clawdbot的token是否一致
2. 检查webhook URL是否正确配置
3. 检查端口是否开放

### 群聊中需要@才回复
在 `~/.clawdbot/clawdbot.json` 中设置：
```json
{
  "channels": {
    "qq": {
      "requireMention": false
    }
  }
}
```

## 贡献
如果你发现问题或有改进建议，欢迎提交 issue 或 PR。

## 许可证
MIT License
