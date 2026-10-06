# 决赛路线图（活文档）

last-reviewed: 2026-10-06 12:40（第 1 版，决赛开工）

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
- **状态：** 10-06 12:27 已起跑，提交 `da8189ed3dd5`（arc-bench-evolution）、`cba6094af823`（lite-evolution），模型 deepseek-v4-flash-vision-exp，练习额度。

### F2 决赛代理暗题（主会话专用）

- **产出：** 在真实的决赛起点应用 G79、Sheet87 上，按官方 Light 风格各写 30 条进化需求和测试；同时交付官方配置的运行器、手写参考实现，以及旧行为回归套件的包装。由 Codex（GPT-6 Astra，max）独立编写，位置不写进任何改进派发单。
- **判据：** 参考实现两次 30/30；回归套件不低于基线减 1；需求和测试冻结后的改动逐条有理由。
- **状态：** 10-06 12:35 派出。

### F3 进化模式改进（等 F1、F2 证据再定候选）

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

## 5. 决策记录

| 日期 | 决策 | 状态 | 依据 |
|---|---|---|---|
| 10-06 | 练习进化赛用主分支 v11 包跑基线 | 按授权直接跑（练习额度已授权） | F1 |
| 10-06 | 决赛代理暗题由 Codex 独立编写，主会话持有 | 用户要求与 GPT-6 Astra max 协作 | F2 |

## 6. 迭代日志

- **2026-10-06 12:40 第 1 版。** 用户告知进决赛并要求开攻。核实决赛形式为 `hackathon-evolution`（从初赛选中的产物继续进化，2 题 60 条）；F1 练习基线 8 题起跑，F2 代理暗题派给 Codex。
