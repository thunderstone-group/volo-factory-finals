# 当前交接 — 2026-10-02 01:35：Vision 两题独立生成中，尚无新正式成绩

先读 `docs/reference/roadmap.md` 4.34、`docs/reference/preliminary-rules.md` 当前截止更新，以及 `docs/evidence/2026-10-02-coverage-pilot.json`。继续用户的冲榜任务，不要只做报告或重新询问小额模型调用许可。

## 目标与授权

- 用户要求尽可能提高正式榜单成绩，同时保留泛化能力。主办方公告将截止延至 **10-03 23:59**，追加练习 300 元、评测 200 元。平台通用页面仍写 10-17，以用户提供的公告为准。
- 现有 ARC 额度已授权使用；不足才通知，不购买、不充值。首批内部计划上限：练习 80 元、正式 40 元，先验证再晋升。
- 起始练习余额 474.072673，01:33 读到 **444.270359**（已结算约 29.80 元）；评测仍为 **234.623313**。这是当时读数，后续从 CLI 查询。
- 已确认正式上传使用 `credential_mode=official_evaluation`，官网说明每次运行创建独立临时 key；本地只用练习 key，可在凭据隔离下并行。运行详情通用 `billing_mode` 字段在历史已入榜的运行上也显示 self_funded，不能单凭它判断费用来源。

## 代码与当前任务

- 主线基线 main `f643e2f`，包 `bfddd36c`；历史最好 S **59.7517**，同提交 GitHub 24、Sheet 81；历史单题 Sheet 86。没有新分数。
- 工作树 `~/projects/volo-factory-worktrees/behavior-coverage-20261001`，分支 `exp/behavior-coverage-20261001`；最新代码提交 **0df8483**（之前 c9e726e、e08e83d、b31d894）。没有合并主分支。
- 当前冻结候选包 **c2a2b32a5ed1ff709859cfe3989143cc44bc1343d8937d8ed20e110eb6f518b0**：覆盖审查默认启用；初稿完成后写测试；测试模型调用串行；保留原断言，仅追加有需求原文依据的检查；修复附带真实失败页面快照；补 Vision 正确价格和流错误细节。
- 活跃的完整生成只有 **vision-sheet-1** 与 **vision-github-1**，模型 `deepseek-v4-flash-vision-exp`，同一冻结包。每个任务内部单路调用，总并发至多两路。
- 证据目录 **`~/projects/arcbench-campaign/evidence/2026-10-01-leaderboard-push/`**。每个生成目录有 process.json、stderr.log、stdout.log；运行中看 `.oneshot-*/progress.json`，退出后看 finished.json 与 application/。不得重复启动已有目录。主脚本 generate_one.py。
- Sheet 初稿一次完成（415 秒），无重试，语法检查通过；随后顺序写测试。GitHub 刚启动。先读取实时文件，不把本节当实时状态。

## 已完成的验证与被否候选

- 覆盖审查 pilot：四次完整 Flash 调用约 1.2032 元，逐条校验引文后保留 18 条新增检查；冻结产物上 14 过 / 4 失败。其中两个产品缺陷有公开需求及源码支持，两个是测试导航假设，提示已收紧。只说明机制，不能证明正式提分。
- **Kimi Sheet 不晋升**：包 66809c07，3132.7 秒完成，书面 42 过 / 50 失败 / 35 错误（含 helper 汇总）；估算费用 36.94 元，未知断流用量另计。固定裁判 g99 / cov99n-arm 得 **29 / 25**，旧正式 81 分产物得 **90 / 88**。结果在 judges/ 与 kimi-decision.json。没有用评测额度跑它。
- 当前 requirements.yaml 与旧 81 分 Sheet / 24 分 GitHub 归档应用中的需求逐字节一致，排除了比较时输入版本不同。
- 最新完整 tests_oneshot：**245 项，242 通过、3 个可选浏览器就绪检查跳过**。legacy 226 项运行完成、12 个可选集成跳过；相关新增浏览器报告测试与安全路径边界通过。候选代码和四个新提交秘密扫描无发现。

## 传输与定位证据

- 冻结旧包正式对照提交 `91bc50f2f30d`，GitHub `49930bdb20c3`、Sheet `06836d4c5363`。由于多次流截断，23:48 主动取消，平台确认 **CANCELLED**，没有测试成绩，费用字段仍 null。不要恢复或把它们当零分样本。
- 同时的 Flash 本地两题首批也因断流停止。SIGINT 能保留主调用 trace，但未结束的写测试线程还会重试，所以随后 SIGTERM 终止；实际退出 -15，operator-abort.json 留证，侧路计费从 Meter 核对。
- 已抓到实际截断帧 `{"created":1790870706,"usage":null,"mo`，不是合法的另一种 delta 格式。回归夹具见 `docs/evidence/2026-10-02-truncated-sse.json`。
- 之后同一请求哈希 94e31e78 经 curl 在 64.7 秒完整返回（实际 HTTP/1.1）；原 urllib 紧接着在 69.1 秒也完整返回（length、无代码）。不支持把成功归因于 HTTP2，所以没有给 agent 增加 curl 依赖。
- **操作者归因已更正**：创建页面和 Create 都是需求要求；所有生成 helper 都点了 Create。初稿真实问题是额外要求填写名称，第一轮修复已去掉。不要沿用「不该有创建页」或「测试漏点 Create」的错误说法；原测试未因此修改。详见 operator-correction.json。

## 接下来必须完成

1. 监控两份 Vision 生成，保留真实模型调用、失败、费用与最终源码。若网络失败，按传输分类，不据此评价模型能力。不要继续叠加候选代码改动。
2. 完成后用固定独立裁判评分：Sheet 运行 `judge_generated.py vision-sheet-1`；GitHub 使用冻结 gh99 套件，并同旧 GitHub 24 分产物对照。测试不参与这些生成过程。
3. 两题满足本地关口后，核对实时任务/额度、精确包哈希、代码扫描和当前官方需求，再按完整两题发正式提交。不得拼接不同提交单题；不能把自测/打包/上传当正式成绩。
4. 读取正式终态、真实费用和对应提交榜单；达到晋升依据再考虑合并 PR。所有异常与负面结果也进账本。若差于基线，不盲目继续同包抽样。

旧交接原样保留在 `docs/archive/handoffs/2026-10-01-before-extension-push.md`。课程仓库 origin/main 1d1f0bb 无新提交；新需求映射与即时调试支持尚未看到公开入口。Chrome 的 brixton profile 有 VOLO-AI 会话，必要时复用；优先用已配置的独立 arcbench CLI。
