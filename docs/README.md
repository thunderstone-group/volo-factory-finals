# docs/ — 地图与管理规范

last-reviewed: 2026-09-21。本文只维护 docs/ 的结构与规则，不复述任何文档的内容；某份文档说了什么，去读它。

## 地图

| 位置 | 是什么 | 谁维护、怎么改 |
|---|---|---|
| `SESSION_HANDOFF.md` | 当前交接：只有**一节**，写给下一个会话的第一个读者 | 每次会话结束整体改写；旧节整份搬进 `archive/handoffs/<日期-时间>.md`，不在文件里堆叠 |
| `progress.md` | 当前路线（one-shot，2026-09-17 起）的追加式账本：做了什么、结果、run id | 只追加，条目标题 `## YYYY-MM-DD [时刻] — 主题`；路线切换时把旧路线整段搬进 `archive/progress-<起>-to-<止>.md` |
| `adr/NNNN-slug.md` | 架构决策记录：难以回退、脱离上下文会显得奇怪、且有真实取舍的决定 | 三条不全中就不写；决定被推翻时新增一条并在旧条标 superseded，不改旧文 |
| `reference/` | 稳定的操作与事实文档：平台 CLI 用法、论坛 CLI、one-shot 候选的边界、官方语料目录 | 无日期前缀，内容随现状更新；顶部写 last-reviewed；过时段落标 TODO 而不是悄悄删 |
| `reports/YYYY-MM-DD-topic.md` | 有日期的调查、计划、账本、复盘：写完即冻结，只允许在顶部加「更新/被谁取代」一行 | 一次调查一份；结论若改变，写新报告并互链，不改旧报告正文 |
| `evidence/YYYY-MM-DD-*.json` | 报告引用的原始数据：榜单快照、run 记录、计量表 | 只增不改；报告用相对链接指向它 |
| `archive/` | 不再被当前工作读取的东西：旧交接节、旧路线账本、冻结的多轮 harness 时代（09-11～09-14）的设计与调查稿 | 原样搬入，不改名不改内容；`archive/README.md` 一行一份说明它是什么 |

入口顺序：新会话先读 `SESSION_HANDOFF.md`，再读 `progress.md` 它指定的位置，再按需读 `reports/` 与 `reference/`。仓库根的 `AGENTS.md` 是项目地图，只指向本目录，不复述。

## 规则

1. **一个事实一个真源。** 平台规则在 `reference/platform-cli.md`，赛制与目标在最新的 `reports/*-campaign-plan.md` / `*-goal-ledger.md`，当前状态只在 `SESSION_HANDOFF.md`。别处需要时用链接，不复制段落。
2. **三个月判据决定去处。** 三个月后还会有人读、且内容会随现状变的 → `reference/`；三个月后还会有人读、但内容不再变的 → `reports/`；三个月后没人读的 → 不写，或写进 `progress.md` 一条。
3. **日期进文件名，只有报告有日期。** `reports/` 与 `evidence/` 用 `YYYY-MM-DD-` 前缀，按时间排序即是历史；`reference/` 不带日期（外部快照除外，如 `docs/reference/arc-bench-corpus-2026-09-14.md`，它是对某天上游仓库的目录）。
4. **状态不落盘。** 分支、候选包、run 列表、余额都从 git 与 `arcbench` 现场读；文档里出现的 run id、提交号、榜位都是「当时」的证据，不是当前状态。
5. **交接文件只有一节。** 旧节是历史，属于 `archive/handoffs/`；文件顶部永远是最新一节，第一行写日期时刻和「先读什么」。
6. **报告冻结，账本追加，参考文档更新。** 三种写法对应三个目录，混用就是漂移的开始：发现报告结论过时，在顶部加一行指向新报告；发现参考文档过时，直接改并更新 last-reviewed。
7. **归档不删除、不改写。** 归档只是搬家加一行索引；文件名不变，内部链接由搬家脚本改写；要删除的只有确证错误且没有被引用的文件。
8. **中英不限，但同一份文档一种语言。** 报主办方的稿子按收件人语言；代码注释与提交信息英文。
9. **每次会话结束的最低义务：** `SESSION_HANDOFF.md` 整体改写、`progress.md` 追加一条、本文的地图若结构变了就改。不落盘等于没做完。

## reports/ 索引（新在上）

- `2026-09-21-business-feedback-pilot.md` — 两份冻结 Ctrip 草稿的业务反馈循环、输入契约补充、独立评分和费用证据。
- `2026-09-18-goal-ledger.md` — 甲方 01:53 定的「Web 聚合榜 ≥ 80%」目标模式：每轮一行的账本、护栏、判据。
- `2026-09-18-distillation.md` — 把 know-how 压到弱模型能用的层级（门 → 骨架 → 表 → 散文）的叙事，ADR 0001 的背景。
- `2026-09-16-workspace-consolidation.md` — 09-16 工作区收编决定：VOLO 唯一主项目、one-shot 与论坛 CLI 的边界。
- `2026-09-16-oneshot-evolution.md` — one-shot 在 Evolution 榜的入口兼容修复与 CLI 诊断。
- `2026-09-14-campaign-plan.md` — 主办方口述的赛制、当日榜况、目标函数驱动的泛化策略与初赛前工作顺序。
- `2026-09-14-organizer-report.md` — 报主办方：运行器 1 核 CPU 配额造成首测试超时（已发 gist）。
- `2026-09-14-early-stall.md` — 托管运行器测试阶段开头的停顿归因（是运行器的，不是我们的）。
- `2026-09-14-nav-race.md` — 生成应用禁止浏览器自导航：与测试的下一次 goto 竞态。对当前路线仍有效。
- `2026-09-14-vision-model-availability.md` — 网关哪些模型真能读图、服务哪些 id、价目表核对。
- `2026-09-14-token-accounting.md` — 官方 token 数的构成：共享 key 计量表差值，并发污染。

## reference/ 索引

- `docs/reference/business-feedback-loop.md` — 有限轮次业务反馈实验的执行、探针校准、独立评分和边界。
- `docs/reference/platform-cli.md` — `arcbench` 客户端的安装配置与绑定本 harness 的平台规则。
- `docs/reference/oneshot.md` — one-shot 候选在仓库内的位置与边界、打包入口。
- `docs/reference/forum-cli.md` — 独立的 Qiwoo 论坛 CLI（不进竞赛包）。
- `docs/reference/arc-bench-corpus-2026-09-14.md` — 官方基准仓库六个 app 的目录：跑什么、要求什么、意味着什么（09-14 快照）。

- `docs/reference/repair-experiment-recovery.md` — 已冻结修复对照的恢复命令、累计重试、请求一致性及运行时约束。
