# 主会话专用的暗题验收资产（不给执行 agent 看）

这里放路线图各工作流的暗题验收材料。执行者看不到这些，它们只在主会话验收 PR 时使用。
不要把本目录的路径写进任何派发单，也不要复制进 volo-factory 仓库。

## 交付去零（路线图 4.1）

- `hidden_dnz_test.py`：9 条暗题，覆盖以下场景：
  - 块间截断两次后完成；
  - flash 与 Kimi 的回退配对，以及回退后的温度；
  - 用空串禁用回退；
  - 空正文重试；
  - content_filter 不切到 qwen；
  - 修复崩溃后仍交付（空输出目录和平台预置目录两种）；
  - 反引号名字进词表。

  用法：在待验收分支的 worktree 根目录下运行
  `~/projects/volo-factory/.venv/bin/python -m unittest discover -s <本目录> -p hidden_dnz_test.py -t <本目录>`。
  在 main 9700ab5 上有 8 条失败，是对照结果；在 PR #46 上全部通过。
- `replay_repair_branch.py` + `ctrip-0919-repair-restored.txt`：把 09-19 Ctrip 那次真实修复重放进候选的 `repair_delivery`，不调用模型。
  - 原始脚本由 09-23 的大题复查 agent 写成，这一版已适配 PR #46 之后的 `CallBudget(draft_limit, repair_limit)`。
  - 修复原文取自平台日志，其中 6 处被脱敏的字面量按推测补回。
  - 用法：`replay_repair_branch.py <oneshot 目录> ~/projects/volo-factory/runs/2026-09-20-goal/ctrip-goal-bundle/template ~/projects/volo-factory/runs/2026-09-20-goal/r28-req-ctrip/requirements.yaml <工作目录> ctrip-0919-repair-restored.txt <输出.json> as-is`。
  - 需要 `NODE_PATH`，以及 lite-first worktree 下 `runs/lite-goal-20260922/browser-runtime/node_modules` 和 `browser-cache` 两份环境。
  - 判定：在 main 9700ab5 上被改名否决拒绝；在 75360b7 上被接受。

## 场景自检（路线图 4.2）的保留集（09-23 11:40 已用掉，Keep 转为开发集）

- 位置：`~/projects/volo-factory-worktrees/lite-first-20260922/runs/lite-goal-20260922/replays/` 下路径含 `keep` 的 24 份回放，其中 10 份满分。
- 另外，Keep 的需求 YAML 也不给执行者看。
- 验收方法：用执行者交付的 `scripts/calibrate_scenarios.py`，在这 24 份回放和 Keep 公开需求上复核三项：
  - 一致率不低于 85%；
  - 假通过不超过 10%；
  - 满分产物上失败场景为 0。
- Keep 公开需求在 `~/projects/arcbench-campaign/upstream/hackathon-local-simulation/public-exercise/keep/requirements/requirements.yaml`。

## 仿隐藏意图评估器（09-27 夜，路线图 4.29）

- 位置：`oracle-2026-09-27/`，用法见其中的 `README.md`。
- 同样只在主会话里使用，不写进派发单，不进仓库。

## 决赛代理暗题（10-06，决赛路线图 F2）

- 题：`~/projects/arcbench-campaign/finals-proxy/`（Codex GPT-6 Astra max 编写；README 有设计、冻结哈希和基线/参考成绩）。GitHub、Sheet 各 30 条官方 Light 风格进化需求，起点就是真实决赛起点 G79、Sheet87。起点 0/30，参考实现两次 30/30，三套旧回归无丢失。
- 跑法：`~/projects/arcbench-campaign/finals-local/run_local.py <github|sheet> <package.zip> <label>`，按平台布局（output-dir 放起点应用 + requirements/ + 运行中追加的 `.arc/stdout.log`）跑打好的包，再跑代理题（官方 runner 镜像）和旧回归。
- 同样不写进派发单、不进仓库；改进执行者不得看到题面。
