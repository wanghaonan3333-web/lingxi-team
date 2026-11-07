# 灵犀 OpenClaw 个人接入 · 0.3.0

在 **Octo 群或子区 @OpenClaw，连接发言人自己的灵犀账号**。不是给整个群授权，也不用转去私聊。

工作台：https://ruyi-aigc.zero0123.com/director/

平台后台：https://ruyi-aigc.zero0123.com/director/admin/

## 成员只需三步

1. 用自己的如意账号登录工作台，点击 **OpenClaw 连接 → 生成我的接入消息 → 复制接入消息**。
2. 到平时使用的 Octo 群或子区 **@团队 OpenClaw**，粘贴消息。已安装插件时，它调用 `lingxi_bind`，识别当前实际发言人的 Octo ID，提交个人连接请求。
3. 回工作台，核对机器人回复中的 Octo 用户 ID，点击 **确认是我，连接账号**。然后在原位置 @它说“查看我的灵犀项目”。

只需本人确认，不需要群管理员或平台管理员审批。因为码发在群内，公开码只用于发起请求；未经本人网页确认不能读取企业资料。不要确认陌生 Octo 用户的请求，重新生成会取消尚未确认的旧请求。

每位成员各自连接一次。同一机器人账号和 Agent 下，换群、换子区不用重复连接，其他人不能借用你的授权。授权有效 30 天，可在自己的工作台撤销。群内回答对能看到该消息的人可见；个人授权不等于私密聊天。

若模型没调用工具，可在目标群／子区单独发送 `/lingxi LM-你的接入码`，按渠道要求 @机器人。接入码 10 分钟内有效且只能使用一次。不要把命令当作终端命令。

## 如意 API Key 在哪里绑定

工作台侧栏 **如意 API Key 授权** → 输入属于当前如意账号的 Key → **验证并授权**。不要将 Key 发到聊天里。

“如意账号已有 Key”和“已授权给灵犀”是两件事。OpenClaw 个人连接也不等于授权付费生成。本插件只读取项目、素材说明和分集剧本，不读取 Key、不领生成任务、不扣费。真实生成仍按平台的独立执行开关与本人确认处理。

## 团队管理员安装／升级一次

在运行 OpenClaw 的主机上操作，成员电脑不用安装。命名 profile 的安装、检查、配置及重载必须使用同一个 profile。

```sh
openclaw plugins install --accept-capabilities clawhub:@wanghaonan3333-web/lingxi-team
```

群内个人连接需要 **0.3.0 或更高版本**。`plugin already exists` 不代表升级成功：备份原插件和配置后执行 `openclaw plugins update lingxi-team`。若原插件来自本地包、不支持 update，核对旧目录与备份后，可使用 `openclaw plugins install --force --accept-capabilities clawhub:@wanghaonan3333-web/lingxi-team` 替换为注册源版本；不要删除本机 `lingxi-team/installation.key`，否则原连接身份会改变。

检查：

```sh
openclaw --profile 你的profile config validate
openclaw --profile 你的profile plugins inspect lingxi-team --runtime --json
```

应显示 `loaded`、命令 `lingxi`，以及工具 **lingxi_bind、lingxi_team_read**。将这两个工具开放给本企业实际承接群消息的 Agent；插件配置 `agentId` 必须与该 Agent 一致，`url` 为上述工作台地址。个人接入使用插件自动维护的本机身份，不能配置共享 `hostKeyFile`。无需新增整群授权配置。

## 身份与会话约束

- 用 OpenClaw 可信上下文里的当前发送者、机器人账号和 Agent 生成个人身份；不读取聊天正文中的用户名、@对象或模型提供的用户 ID 作为授权身份。
- Octo 主群和子区都支持。渠道须向命令／工具提供可信目的地；子区完整 ID 为 `父群____子区`，需与会话键一致。丢失或冲突时拒绝，不回退主群。
- 工具不能指定收件人或任意群 ID，读取结果回到调用它的原会话。不得把子区结果主动转发到主群。
- 一套企业 Agent 可以服务多位成员。不同企业不能共用这套 Agent 的资料历史、文件和记忆；服务端将首次确认的企业固定到这个 Agent 的安装身份，避免串企业。另一个企业由管理员使用隔离 Agent，而不是让普通成员配置。
- 群共享会话中以前回复过的资料可能已存在于历史中。当前发送者未授权时 API 会拒绝读取，但插件不能抹去已有聊天历史，也不能限制一个同时持有文件／终端工具的 Agent 自行读取本机材料。管理员须管理企业 Agent 的资料、工具和群可见性。
- 原有 LX 私聊绑定继续保留；仅接受原来的 `per-account-channel-peer` 独立私聊会话，不自动迁移为群授权。

## 故障提示

| 提示 | 处理 |
| --- | --- |
| 没有 lingxi_bind | 检查是否仍是 0.2.x，以及同 profile 的插件加载和工具白名单 |
| 请使用管理员指定的灵犀助手 | 插件 agentId 与当前承接消息的 Agent 不一致，由管理员核对 |
| 当前成员尚未连接 | 由当前成员生成自己的接入消息，网页确认后再试 |
| 缺少可信账号／发送者／目的地 | 当前渠道未提供必需上下文，升级渠道；不要伪造身份 |
| Agent 已处理其他企业资料 | 由管理员使用独立企业 Agent，不能清数据库绕过历史隔离 |
| 码过期 | 工作台重新生成；旧码和旧待确认请求失效 |

## 本地验证与发布边界

仓库的 `test_member_chat.py` 和 `member_chat_flow.mjs` 使用真实本地 HTTP 服务与插件执行代码，覆盖主群、两个子区、两个成员、机器人账号隔离、跨企业、撤销、过期、并发兑换和旧私聊兼容。不等同于现场 Octo Gateway、模型推理或付费生成验收。
