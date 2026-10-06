# 决赛路线图（活文档）

last-reviewed: 2026-10-06 19:05（第 5 版，决赛包 v2）

初赛路线图 [roadmap.md](roadmap.md) 到 10-03 截止为止，保留作历史；决赛的目标、事实、工作流、判据和决策都写在本文。结果数字照旧进 [progress.md](../progress.md)，当前停在哪一步写在 [SESSION_HANDOFF.md](../SESSION_HANDOFF.md)。

## 1. 目标

决赛 `hackathon-evolution` 的 S 尽量高。初赛的做法照旧有效：只做通用机制，永不交付空，用证据晋升。包里不写题名、专属规则和答案。

## 2. 已核实的赛制事实（2026-10-06）

- 初赛 `hackathon` 已结束（09-01～10-03）。终榜 VOLO-AI 第 2（GitHub 79 + Sheet 87，p 83.0%，S 104.96），提交 `12e3bab723fd`（v7 包 4ae64326）。10-05 组委会来信：入围决赛，安排另行通知。
- 平台竞赛 `hackathon-evolution`（official，`template_required: true`，`template_source_competition_id: hackathon`）。2 题、60 条测试，status upcoming，`starts_at` 2026-10-05。任务、需求和测试都还没开放，访问返回 403「has not started yet」。
- 平台原文：「Extend the applications produced by the Official Hackathon while preserving their existing behavior. Each task starts from the application selected for the participant's latest leaderboard submission, and falls back to the default template when no eligible source result is available.」所以决赛的起点应用就是初赛 G79（run `afc04ffe5b63`）和 Sheet87（run `defb678bf0a1`）的产物，本地副本在 campaign evidence `2026-10-02-s70/v7-official-github-79/application` 与 `v7-official-sheet-87/application`。
- 报名：`arcbench registration hackathon-evolution` 显示 registered=False、can_confirm=True、initial_budget_cny=0.0；确认要提交成员邮箱，CLI 不代办。
- 同形式的练习赛（10-05 新开）：`arc-bench-evolution` 6 题共 38 条，每题从我们在 `arc-bench-web` 的最好产物起步；`arc-bench-lite-evolution` 2 题共 12 条，从主办方的 Lite 基线起步。需求为 EV-x.y 原子需求，约三分之一 `change_type: CHANGE`（带 `original_requirement_id`），三分之二 `ADD`，每条一个场景。测试只考 EV 场景，用 27 行的新版 helpers（`exact: true`、严格计数 1）。题包、需求原文在 campaign evidence `2026-10-06-finals/`。
- 平台把进化题的旧应用直接放进 output-dir，再放新的 `requirements/`。我们的包在 output-dir 非空时走升级路径（`oneshot/main.py` 的 template 分支），GitHub 阶段 2 实测可继承。

计分公式、决赛额度、时间窗与提交次数都还没公布，公布后补进本节。

## 3. 工作流

判据在动手前写死；要改判据，先改本文再在日志里写理由。

### F1 平台练习基线

- **产出：** v11 主分支包（cd0f5969）在两项练习进化赛 8 题各跑一次的终态、费用、时长，以及逐条失败归因。
- **判据：** 8 个终态读数入账；每条失败都归到一类：起草、修复、种子、定位、回归或平台。
- **状态：** 第一轮（包 cd0f5969，提交 `da8189ed3dd5`、`cba6094af823`）8 题全部在 agent 阶段退出 1、零测试：生成、自写测试、修复都完成了（例如 Web BookStack 自测 6/6），最后发布报 `template changed during generation`。根因是平台在运行期间往 output-dir 的 `.arc/stdout.log`、`.arc/runner-events.jsonl` 写日志，而原地升级路径冻结了整个目录。这条路径此前从没在平台上成功过（阶段 2 的成绩来自本地生成后的快速自测）。PR #121 改为只回写变化的应用文件（main 6ee6a63，包 0a0ab9d7），第二轮（包 0a0ab9d7）13:20 起跑、13:41 全部终态：arc-bench-evolution 6 题 38/38（12306 6、BookStack 6、Ctrip 9、Keep 6、PrestaShop 5、StackOverflow 6；run ec0f88fc1d76、c9f51fed2e74、115f8e358790、c47f2ae0d52d、7cf38b3e1ad3、35677f5758f2），榜第 1（唯一一队）；lite-evolution 10/12（BookStack db1e3e705fa3 丢 REQ-10.2 书内排序，Keep 2632aff4abd5 丢 REQ-8.1 清单笔记），榜第 3（前两名 100%）。实际花费约 10.5 元（余额 348.11→337.63，含两次本地代理回放）。第一轮实际花费约 8.9 元（余额 356.99→348.11）；平台费用列合计约 49 元，是并发 run 共用计量表的虚高。

### F2 决赛代理暗题（主会话专用）

- **产出：** 在真实的决赛起点应用 G79、Sheet87 上，按官方 Light 风格各写 30 条进化需求和测试；同时交付官方配置的运行器、手写参考实现，以及旧行为回归套件的包装。由 Codex（GPT-6 Astra，max）独立编写，位置不写进任何改进派发单。
- **判据：** 参考实现两次 30/30；回归套件不低于基线减 1；需求和测试冻结后的改动逐条有理由。
- **状态：** 10-06 13:15 交付：两题各 30 条（各 10 CHANGE、20 ADD），冻结后才读起点源码；起点 0/30，参考实现两次 30/30；GitHub v6-fixed 107/4/0 不变，Sheet g99 66/9/26 不变、cov99n 96→97。位置与跑法只在主会话专用说明里。

### F2 读数（主会话，题面位置不入库）

包 0a0ab9d7 本地回放，按平台布局（output-dir 预置起点 + requirements/ + 运行中追加的 `.arc/stdout.log`）：

| 题 | 样本 | 代理新功能 | 旧功能回归（起点） | 估算费用 |
|---|---|---|---|---|
| GitHub Light | s1、s2 | 29/30、29/30（同一条：取消最后一个置顶后空的置顶区被整个藏掉） | 106/5、106/5（起点 107/4，同一条：仓库文件列表里的 README.md 链接） | 1.31、1.67 |
| Sheet Light | s1、s2 | 30/30、30/30 | g99 66/9/26 不变；cov99n 96/4 不变 | 1.39、1.58 |
| GitHub 散文写法 | s1 | 30/30 | 106/5 | 1.19 |
| Sheet 散文写法 | s1 | 30/30 | g99 65/10/26、cov99n 94/6（各丢 1–2） | 1.10 |

温度 0 下同包两个样本几乎一样，再抽样没有信息量。现有链路在新功能上已近满分，稳定的失分渠道是旧行为丢失（练习赛 6 题上守卫观察器也找到 132 条可见旧界面丢失，例如 12306 侧栏改名、BookStack 页面丢 Edit/Favorite、PrestaShop 匿名「My account」入口消失）。

### F3 进化模式改进（等 F1、F2 证据再定候选）

**10-06 下午状态：**
- **Light 编译器**（PR #125，默认关）：官方 Light 题 35/38 场景可编，编出测试在官方全过的 6 份应用上 35/35、起点 0/35；代理题句式不同，0/60 可编，整场景回退给模型。新功能上现有链路已近满分，暂不打开。
- **旧行为回归守卫**（分支 feat/evolution-regression-guard，默认关）：确定性浏览器清单，未登录状态，丢失项进修复且不能拿新增通过抵。平台第一次试跑（包 1621c206，6 题 38/38）守卫全程没生效：起草并行的基线比 Playwright 安装早，报「runtime is not installed」后静默退化，已修（自行安装）；第二次试跑（包 e256d162）在跑。代理题上暴露豁免规则太宽：1194 项里 645 项因 CHANGE 需求提到「Issues」「Home」「Sign in」等导航名被豁免，README.md 丢失没报，已交 Codex 收紧。
- **源码审查**：13 次进化运行里零产出（空答案/JSON 解析失败/断流/绑定错误或 0 条提议），每次 0.13–0.58 元、2–9 分钟，约占三到四成费用。消融（ONESHOT_SOURCE_CONTRACTS=0）在代理两题上跑；若通过数不掉，升级模式下关掉它（从零生成保持原样）。


候选假设，按证据排序后逐个做，一次只改一个机制：

1. 起草改用 SEARCH/REPLACE 定点编辑，不再整份重发大文件。G79 的 app.js 有 105 KB，整份重发容易丢功能或截断。
2. 旧行为回归守卫：改动前后各跑一次「起点应用已通过的行为」，修复验收计入回归。
3. 同名控件冲突：新控件和已有界面在同一作用域重名会撞严格模式，起草前把现有可访问名清单交给模型，交付门禁也查这一点。
4. 种子合并：GIVEN 声明的新记录并入已有种子，不覆盖旧记录。

- **判据：** 每个候选都要在 F2 代理暗题上配对比较（每题至少 2 个样本），新增通过数提高，回归不变差；再上练习平台做真实链路验证。

### F4 本地进化回放

- **产出：** 用 F1 产物里的起点应用与公开测试，在本地跑 agent 并按官方配置判分，作为不上平台的快速回路。
- **判据：** 本地分与 F1 平台分对得上，差距不超过 1 条/题。

### F5 决赛运营

- 报名确认（甲方定）；额度公告一出就复核本节；提交前检查沿用初赛路线图第 6 节。

## 4. 证据口径

沿用初赛路线图第 7 节：受控修复不算进展；单样本只能分辨大差异；本地分与平台分分开记；对外结论引用真实 run id。

## 4.5 当前决赛包

main 上的包（守卫宽松版默认开 + 进化模式跳过源码审查 + 发布修复），候选验证时的包哈希 9293a251：平台练习 6 题 38/38（提交 `9b6dfbecf17a`），代理两题 30/30、30/30，估算费用 0.75/0.69 元。严格豁免版守卫在平台丢 2 条（Keep 合法去掉的「Matching notes」被守卫逼回来，PrestaShop 修复空转 13 轮），不采用。已知短板：起草整份重写大文件会随机丢掉登录后的旧功能（这次丢了「Edit issue title」「Assignees」的代码），守卫只看未登录状态看不见，下一候选是升级起草改定点编辑。

## 5. 决策记录

| 日期 | 决策 | 状态 | 依据 |
|---|---|---|---|
| 10-06 | 练习进化赛用主分支 v11 包跑基线 | 按授权直接跑（练习额度已授权） | F1 |
| 10-06 | 决赛代理暗题由 Codex 独立编写，主会话持有 | 用户要求与 GPT-6 Astra max 协作 | F2 |
| 10-06 | 守卫宽松版默认开；严格豁免版不采用 | 主会话按配对证据定，可回退 | 第 4.5 节 |
| 10-06 | 进化模式跳过源码审查 | 主会话按 15 次零产出与消融定，可回退（ONESHOT_UPGRADE_SOURCE_CONTRACTS=1） | PR #127 |

## 6. 迭代日志

- **2026-10-06 19:05 第 5 版。** 严格守卫候选（a64cd91e）平台 36/38 被否；宽松守卫 + 跳过源码审查（9293a251）平台 38/38、代理 60/60，合入 main 作为决赛包。GitHub 旧功能回归 100–107 之间波动，根因是起草整份重写 app.js 随机丢代码，下一候选：升级起草定点编辑。组委会 18:13 邮件：决赛安排只在决赛微信群发，入群要甲方扫码。

- **2026-10-06 15:30 第 4 版。** 代理基线入表（新功能 59/60、60/60，散文 60/60；稳定失分是旧行为丢失）。守卫在平台首次试跑没生效（运行时未装），已修并重跑；豁免规则过宽交 Codex 收紧。源码审查在进化任务上零产出，做升级模式关掉它的消融。练习起点 `base-web-*` 被 CLI 脱敏损坏，可信起点在 campaign evidence `2026-10-06-finals/base-recovered/`（按快照哈希恢复）。

- **2026-10-06 13:50 第 3 版。** 发布修复后练习进化赛 Web 6 题全满分、Lite 10/12：在官方 Light 题面与 27 行严格 helper 下，现有「升级起草 + 书面测试 + 修复」链路已够用。F1 判据剩 Lite 两条失败的归因。F3 新增候选「Light 场景编译器」（Codex job `2026-10-06-light-compiler`，默认关），用于把 Light 场景确定性编成与官方同构的测试；是否打开看决赛代理题与练习赛的配对证据。

- **2026-10-06 13:25 第 2 版。** F1 第一轮 8/8 死在发布（平台运行期间写 `.arc/`，原地升级路径冻结目录）。按现在的包打决赛两题都会是零；PR #121 已修并合入，第二轮起跑。Codex 策略评审（job `2026-10-06-finals-strategy`）另指出：种子清单与首页入口提取认不出新版题面（signed out、activates、双引号 GIVEN）；内部测试超时 15/5 与官方 10/10 不一致；起草前没有旧行为基线；决赛起点应用的 `lib/arc.js` 每次渲染按 outerHTML 隐藏重复控件，新增同样标记的控件会被藏掉。这些列入 F3 候选，等第二轮真实读数排序。

- **2026-10-06 12:40 第 1 版。** 用户告知进决赛并要求开攻。核实决赛形式为 `hackathon-evolution`（从初赛选中的产物继续进化，2 题 60 条）；F1 练习基线 8 题起跑，F2 代理暗题派给 Codex。
