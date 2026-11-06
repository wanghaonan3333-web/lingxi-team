# 灵犀团队私聊接入

这份说明供运行 OpenClaw 的管理员使用。成员只需要灵犀团队账号和一个可以私聊这台 OpenClaw 的聊天账号。

## 团队成员怎么用

1. 登录团队工作台，点击 **连接我的 OpenClaw → 生成团队授权码**。
2. 把复制的整条 `/lingxi LX-…` 指令发到本团队已安装本插件的 OpenClaw 私聊。每个成员单独领码，生成新码会替换该团队尚未使用的旧码。码在 10 分钟内可用一次。
3. 收到绑定的团队名称和私聊编号后，单发 `/lingxi` 即可核对项目列表。这一步由插件处理，无需模型。开通对话模型后，可以直接问“读一下《排练室》第一集，列出人物和每场需要的道具”，草稿显示在私聊里。

一次绑定有效 30 天。工作台可按私聊编号末六位撤销授权，再次查询就会被拒绝。之前发出的消息可能仍在聊天记录中，因此一段私聊只服务一个团队。成员更换账号或机器人后须在新私聊重新绑定。

## 管理员的一次性配置

本地验收使用了 OpenClaw 2026.10.5、独立配置和样例数据。

1. 在运行团队 OpenClaw 的电脑上执行（已验证版本 2026.10.5）。使用命名 profile 时，给安装、配置和重启命令都加同一个 `--profile 名称`。

   ```sh
   openclaw plugins install --accept-capabilities clawhub:@wanghaonan3333-web/lingxi-team
   ```

2. 为团队机器人准备独立 OpenClaw profile、聊天渠道账号及空白 Agent 工作区，仅放行获准成员的私聊。只给这个专用 Agent 开放 `lingxi_team_read`。关闭该 profile 的共享记忆、自动跨会话检索以及其他自动注入资料的插件，不授予成员文件、终端、历史搜索、任意联网或管理权限。将团队机器人消息路由给下面的 `director` Agent。已有个人助手继续使用其自己的 profile。
3. 将下面的字段合入专用 profile 的配置，替换绝对路径。若渠道本身通过插件提供，在 allow 列表中同时保留该渠道及运行模型所需的插件。

```json
{
  "session": {"dmScope": "per-account-channel-peer"},
  "agents": {"entries": {"director": {
    "workspace": "/ABSOLUTE/PRIVATE/lingxi-agent-workspace",
    "tools": {"allow": ["lingxi_team_read"]}
  }}},
  "plugins": {
    "allow": ["lingxi-team"],
    "entries": {"lingxi-team": {
      "enabled": true,
      "config": {
        "agentId": "director",
        "url": "https://ruyi-aigc.zero0123.com/director"
      }
    }}
  }
}
```

4. 在同一 profile 下检查配置和加载结果，再启动或重载专用 Gateway。将下面示例中的 `lingxi-director` 替换为所选 profile 名。

```sh
openclaw --profile lingxi-director config validate
openclaw --profile lingxi-director plugins inspect lingxi-team --runtime --json
```

验收时应看到 `status: loaded`、命令 `lingxi`、工具 `lingxi_team_read`，且 diagnostics 没有该插件的错误。站点只需提供入站 HTTPS，Mac 通过出站请求读取灵犀，无需对公网开放 Mac 的 Gateway 端口。绑定表位于团队配置文件同目录的 `chat-pairing.sqlite3`，备份和恢复时与团队配置、项目库保持一致。

## 现场验收和排查

- 用两个测试成员，在两段真实私聊中分别绑定两个样例团队。先发 `/lingxi` 对照各自的项目，再撤销其中一段私聊并重试，另一团队应继续可读。最后在模型运行另行获准后，验收一次自然语言提问和回答。
- 网页没有连接按钮时，检查是否已部署支持私聊的多团队服务、启用 LINGXI_TEAM_PLUGINS=1 并重启。插件报认证失败时，核对插件版本、服务端配置及灵犀地址。
- 聊天渠道须同时向命令处理器和工具传递可信的发送者、Agent 和独立私聊会话键。群聊、共用 main 会话、合并身份或渠道改写发送者 ID 都可能被拒绝。先在目标渠道验收，不以消息正文中的用户名或团队 ID 代替可信身份。
- 当前读取范围为本团队的项目清单、项目概况、资产名称与说明、分集目录及剧本文本。自动领任务、回传结果走独立的 CLI 连接器，需要单独授权。工作台只读绑定可单独启用。

[OpenClaw 官方私聊会话说明](https://docs.openclaw.ai/concepts/session)
