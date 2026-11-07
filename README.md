# 灵犀 OpenClaw 插件与 CLI · 0.4.1

本版本提供个人绑定、原生 CLI 和网站文字任务自动执行。
工作台服务已配套升级；请核对实际安装版本为 0.4.1，不能把 0.3.0 当成已支持自动执行。

工作台：https://ruyi-aigc.zero0123.com/director/

平台后台：https://ruyi-aigc.zero0123.com/director/admin/

## 成员怎么用

1. 用自己的如意账号登录工作台，打开 **OpenClaw 连接**，生成并复制接入消息。
2. 在平时使用的 **Octo 群或子区 @OpenClaw**，粘贴消息。插件识别当前真实发言人，提交个人连接请求。
3. 回工作台核对 Octo 用户 ID，勾选 **允许此 OpenClaw 自动处理我提交的文字任务**，再确认连接。
4. 在网站整理剧本或生成单集提示词。插件在线时自动领取任务、调用本 OpenClaw 的模型并回写网站；不需要去聊天催它。

成员电脑不用安装 OpenClaw，不用装 Python，不填写 worker token，不运行常驻命令。
一套插件可服务同企业多位成员；各自绑定、各自授权，只领取本人提交的任务。
同一成员换群、换子区不必重新绑定；不会把整个群授权，也不会把结果主动发到群里。
自动处理使用 OpenClaw 已配置的模型及额度，不是免费生成承诺。

不勾选自动处理时仍可读取项目，既有 0.3.0 连接也默认保持只读。
已连接的成员可在同一入口启用或暂停自动处理，查看执行端在线、离线或待核验状态。
同一成员启用另一个机器人连接时，旧连接不再领取新任务；已开始的任务须保留结果核验。

如意 API Key 仍在侧栏 **如意 API Key 授权 → 验证并授权** 中管理。
这次插件只执行文字拆解和提示词，不读取 Key，不自动启用图片、视频、录音转写或学习任务。
不要把 Key、接入码或配置密钥发给其他成员。

## OpenClaw 管理者安装一次

在实际运行 OpenClaw 的机器安装或升级，使用它实际运行的同一 profile：

```sh
# 使用 ClawHub 正式发布渠道；安装后核对版本。
openclaw plugins install --accept-capabilities clawhub:@wanghaonan3333-web/lingxi-team
```

已有注册源安装使用 `openclaw plugins update lingxi-team`。
`plugin already exists` 不代表升级成功。先备份插件与配置，保留 `lingxi-team/installation.key`，
核对实际安装版本，再按当前 OpenClaw 的插件重载机制使新代码生效。
命名 profile 在安装、更新、检查和 Gateway 运行时保持一致。

候选包可由运维在隔离测试实例用 `openclaw plugins install /绝对路径/包名.tgz` 安装；
已有同名插件按当前 OpenClaw 支持的更新/替换流程操作，不直接删除原插件目录或密钥。

```sh
openclaw --profile 实际profile plugins inspect lingxi-team --runtime --json
openclaw --profile 实际profile lingxi status
```

应包含工具 `lingxi_bind`、`lingxi_team_read`、`lingxi_tasks`，CLI 根命令 `lingxi`，
后台服务 `lingxi-tasks`。后台服务由 Gateway 托管，自动每 5 秒检查一次，
不另起 Python/系统服务。空闲检查不调用模型；收到本人明确授权的文字任务后才调用。

默认使用灵犀正式站地址，以及真实聊天上下文中的 Agent。无需手填 agentId 或执行凭证。
管理员可选填 `url` 指向测试站，或填 `agentId` 限定允许接入的企业 Agent。
个人接入不能使用旧 `hostKeyFile` 共享密钥模式。
OpenClaw 的工具策略需允许这三个插件工具；本机文件/网络及后台模型能力须被宿主允许。

从 0.3.0 升级时，本机原来没有自动执行所需的连接索引。旧成员在群内再次让机器人
“查看我的灵犀项目”，即可记录已有连接，无需重装或换码；随后在网站允许自动处理。
0.4.0 新绑定会自动完成这一步。

## CLI 能做什么

原生 CLI 是宿主机操作员入口；群内 Agent 使用插件工具绑定可信当前发言人，
不能让模型指定另一个成员的连接 ID。以下命令不要求普通成员使用。

```sh
openclaw --profile test lingxi status
openclaw --profile test lingxi projects --connection 连接ID
openclaw --profile test lingxi project --connection 连接ID --project 项目ID --episode 1
openclaw --profile test lingxi tasks --connection 连接ID
openclaw --profile test lingxi analyze --connection 连接ID --project 项目ID --revision 版本号
openclaw --profile test lingxi prompts --connection 连接ID --project 项目ID --episode 1
openclaw --profile test lingxi task 任务ID
```

`analyze`、`prompts` 保存网站任务，可能随后由已授权的插件自动执行，使用宿主模型额度。
查询命令不执行模型。`status` 返回本机连接和任务状态，不打印密钥或领取凭证。
`project` 支持 `--offset` 分页；按返回的 nextOffset 继续读取。
`task` 只读取本机已领取任务的不可变输入，不能拿任意项目 ID 冒充任务。

### 修复旧版长回复卡在“待核验”

0.4.1 修复终态摘要最多 4096 字符造成的 JSON 解析失败。新任务通过宿主 SDK
读取原任务独立会话的完整结果，再持久化并校验回写；不把聊天展示摘要当作结果。
第三方插件不借用官方插件的 Gateway 权限，也不读取其他聊天记录。

旧版因截断停留待核验的任务，升级并重载后会自动读取原 runId 的完整结果尝试补交一次，
不会重新调用模型。原截断快照另存保留；完整结果仍不合法时继续待核验。
自动读取不可用时，管理员可在运行机器、同一 profile 下显式执行：

```sh
openclaw --profile test lingxi status
openclaw --profile test lingxi recover 任务ID --connection 原连接ID
```

`recover` 使用当前操作员的 Gateway 登录权限，从原任务的独立会话读取完整消息，
核验原 runId 已成功结束、完整消息与已保存摘要一致，再补交到原任务。
它不创建新 run、不调用模型、不改授权、不清理 journal，也不打印剧本或密钥。
消息仍被截断、完整原答不是合法 JSON、原文校验失败或版本冲突时保留任务，不能伪造成功。
成功回执须为 `applied`，随后网站才会显示分析结果；`conflict` 需保留结果处理项目版本冲突。
只有本机操作员 CLI 提供此恢复能力，群内工具不能选择别人的连接或执行恢复。

已有结果需要人工核验修复后补交时，可用：

```sh
openclaw --profile test lingxi submit 任务ID --connection 连接ID \
  --file /绝对路径/原会话结果.json --reconciled
```

仅接受已停留在待核验阶段的本连接任务和 0600 结果文件。
`--reconciled` 表示操作员已核对原会话；该命令不会再次调用模型。
服务端继续校验作者、集数、原文、资产引用、版本与结果摘要，不能强行覆盖正在处理的任务。

## 如何执行及保护数据

插件、CLI、聊天工具共用 HTTPS API 客户端。插件背景服务领取任务后，使用
OpenClaw 原生后台运行接口，继承该 Agent 的模型配置，不覆写 provider/model。
每个任务使用独立会话，关闭工具和对外消息递送，文字输入不含个人 API Key 或执行凭证。
CLI 的项目与任务控制不依赖单独的 Python 环境。

任务记录保存在当前 OpenClaw profile 的私有插件状态目录，文件 0600。
先落盘派发意图，再申请服务端启动权，之后才调用模型。
重启后恢复原 runId；网络丢失重试原结果，不重复生成。
无法确定模型是否已启动时停留待核验，不根据租约过期自动重跑。
本地项目资料不会写入 Agent 的全局记忆或发往其他聊天。

企业内部仍遵守现有单执行队列，进行中的任务需要先完成或核验。
自动接入只领取记录了本人成员 ID 的新文字任务；旧版无提交者任务不自动认领。
尚未开始的旧拆解任务可在网站点击“交给我的 OpenClaw”，由登录成员明确接手。
旧单集提示词点击生成时可接手未开始的排队任务；输入已变化则保留旧记录并生成新任务。
已有执行记录的任务仍须核验原会话，不能批量改归属或删日志后重跑。

服务器固定企业与 Agent 安装身份。另一个企业使用隔离 Agent/工作区。
同一机器的操作员能接触插件私有文件，不能把宿主机 CLI 当作不可信群成员的权限边界；
共享聊天只开放带当前发言人上下文的插件工具，不以 CLI 的连接选择参数代替个人认证。
旧 LX 私聊连接继续只读，不自动升级为执行权限。

## 故障定位与当前验证边界

- **已授权，等待插件连接**：确认实际运行版本为 0.4.1、Gateway 已重载、网站配套服务已升级。
- **仅连接账号**：本人尚未允许自动处理，插件不会领任务或调用模型。
- **执行被暂停**：检查个人授权和平台管理员的执行开关。
- **待核验**：网站会显示固定错误类别；截断摘要使用上面的 `recover` 恢复。保留原任务/runId/结果，不重装清目录或重复提交模型。
- **runtime_unavailable**：宿主缺少后台 run/wait API；核对实际 OpenClaw 版本和权限。
- **旧任务没被领取**：没有提交者标记的旧任务需运维核验，不能自动冒认成员。

已使用 OpenClaw 2026.10.5 发布包的接口定义开发，真实本地 HTTP、SQLite、插件服务、
原生 CLI 命令解析和网页授权流程联调；快速回归的模型 runtime 使用替身。
另已安装真实 OpenClaw 2026.10.5，在隔离 Gateway 中验证候选包安装、热加载、
CLI 及网站拆解/提示词任务自动领取和回写；这轮只替换模型 HTTP 接口，未替换 runtime。
Octo 身份来自测试上下文，未连接真实群聊，也未调用真实模型。
尚未在远端 winky Gateway 上完成真实模型验收。正式版本状态以 ClawHub 发布页为准。
