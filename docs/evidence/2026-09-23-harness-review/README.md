# 2026-09-23 harness 评审的原始材料

这里存放 [评审报告](../../reports/2026-09-23-harness-review.md) 及其附录所依据的脚本与中间数据，由四个只读子评审在会话临时目录里产出后原样搬入。

脚本里的绝对路径都指向已不存在的草稿目录，重跑前要先改路径；需要原始日志的脚本，要先用 `arcbench --env-file ~/.config/arcbench/volo.env logs` 重新拉取日志。所有文件已扫描过凭据：唯一的账号字段是 CLI 输出里已经打码的形式。

## code-pipeline/（附录 1）

| 文件 | 内容 |
|---|---|
| `gen_stats.py`、`kimi_agg.py` | 从 lite-first 的 `R/generations/*/trace.json` 抽取每次调用的耗时、token 和推理占比，再按价目表重算费用 |
| `time_smoke.py` | 调用包内 `smoke_check` 复跑交付产物，并按阶段计时 |
| `smoke-keep-v18.json`、`smoke-bookstack-v18.json` | 两份 v18 产物的自检复跑结果。v24 官方产物与两行修正版的结果放在上一级目录的 `2026-09-23-v24-selfcheck-*.json` |
| `v24-stdout-lines.txt` | 官方 v24 run 的 stdout，逐行截断 |
| `v24-official-calls/call1`、`call2` | 从官方 trace 拆出的首稿文件和修复文件。两份 app.js 的路由段相同，说明路由错误在首稿里就已存在 |

## official-runs/（附录 3）

| 文件 | 内容 |
|---|---|
| `runs-raw.json`、`runs-classified.json`、`runs-dataset*.{json,csv}` | 账户全部 run 的原始列表，以及 09-17 以来 389 条完成 run 的数据集。数据集另有一份在 `../2026-09-23-official-runs-dataset.csv` |
| `logs-parsed.json` | 从 389 条完整日志里解析出的计量窗口、agent 起止时间和逐调用状态 |
| `dist-task-model-package.csv`、`analysis-output.txt`、`score-combos.json` | 分布表、方差与敏感度的计算输出、一中一大配对的分数 |
| `cost-fit.json`、`own-cost-est.json` | 并发 run 实付费用的反卷积拟合及逐 run 估计 |
| `requests.json`、`usage-day*.json`、`balance.json`、`models.json`、`submissions.json`、`competitions.json` | 计量请求明细、日用量、余额、价目、提交列表、竞赛列表（均为 09-23 00:5x 读取） |
| `lite-local-0922.{csv,json}` | 09-22 本地 Lite 独立生成的逐次记录 |
| `fetch_*.py`、`parse_logs.py`、`build_*.py`、`an_*.py`、`score.py`、`md_tables.py` | 拉取、解析、建数据集、分析和计分脚本 |

## large-tasks/（附录 4）

| 文件 | 内容 |
|---|---|
| `large-runs.txt`、`fetch-list.txt` | 纳入统计的大题 run 列表 |
| `large-gen-table.{txt,json}` | flash 时代 44 个大题 run、105 次调用的生成层汇总：正文体量、耗时、finish_reason、断流、修复结果 |
| `kimi-calls.{txt,json}` | Kimi 调用统计（只有中题数据） |
| `failures.json` | 大题 Playwright 失败清单的原始归类。汇总版在 `../2026-09-23-large-task-failure-families.txt` |
| `tools/` | 解析与汇总脚本 |
