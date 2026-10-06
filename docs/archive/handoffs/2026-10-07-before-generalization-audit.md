# 2026-10-07 01:55 决赛：最终包候选五在循环重跑

先读本页、AGENTS.md、`docs/reference/finals-roadmap.md`（第 2 节须知、第 4.5 节最终包与策略、F2-real、F3）。git 和 CLI 是现状真源。E3=`~/projects/arcbench-campaign/evidence/2026-10-06-finals`，L=`~/projects/arcbench-campaign/finals-local`。

## 目标与约束
- 10-06 12:20 用户：「arc 我们进决赛了，可以开始猛攻决赛了，你跟 gpt6astra max 一起」。Codex 走 codex-dispatch。
- 练习额度与正式试跑已授权直接跑；volo-factory PR 验收后自己合；包里不写题名和答案；代理暗题位置不进派发单与仓库。
- 用户要求中文回复（10-06 22:29 用户：「说中文，看不懂」）。

## 决赛事实
- 截止 10-08 18:00，截止时停在跑容器；榜只看每队最新提交，同一提交内每题取最好；成本只算选中的两次运行。
- 额度 200 元，10-07 01:33 剩 175.02。
- 官方报告在 run 下载包 `template/.arc/playwright-report.json`。本地代理 v3（`L/run_local.py github-real|sheet-real <包> <标签>`）在 10 份官方产物上 292/300 一致。

## 提交记录（决赛）
| 提交 | 包 | GitHub | Sheet | 备注 |
|---|---|---|---|---|
| 8aac3a380e0c | 9293a251 | 3 | 21 | 入口位置不符 |
| 977c79cf0389 | a7066b2e | 21 | 29 | **最好 50/60** |
| 0a76ab46dad8 | 3c0294d9 | 3 | 24 | 网关退化 |
| 2c7c25f47b5d | 52126573 | 15 | 11 | 菜单条目角色、守卫误否决 |
| d99dcad49dc5 | 94ff9ecf（候选五，最终包） | 16, 21, … | 26, 23, … | 循环重跑中，现为最新 |

## 在跑
- `E3/rerun_loop.sh d99dcad49dc5 github|sheet 12`（nohup，能活过 /clear），日志 `E3/reruns-d99dcad49dc5-*.log`，`touch E3/STOP-github` 或 `STOP-sheet` 停。
- 候选五练习 6 题（run id 在 `E3/c5-practice-ids.txt`），过了（≥ 37/38，Keep EV-1.1 为既有波动）就把 feat/finals-region-contract 合 main。

## 等甲方
- 删提交授权（已问未答）：若 d99dcad49dc5 的最好组合到截止前仍低于 50，需删 0a76ab46dad8、2c7c25f47b5d、d99dcad49dc5，让 977c79cf0389 回到最新。删除不可撤销，未获授权不删。

## 下一步
1. 盯重跑日志，最好组合超过 50 即为新最好；截止前 10-08 16:30 起不再起新的 GitHub 重跑（单次约 30–75 分钟）。
2. 若要换包（候选六），须在代理 v3 上明显好于候选五，最晚 10-08 上午。剩余官方失分：REQ-1-4 两种状态都显示、REQ-2-1-2 账户菜单不是 role=menu、REQ-2-4/REQ-5-5 入口找不到、REQ-4-5 文字格式与种子值、REQ-8-1-1 便签按钮不在格内、REQ-5-1-2「Create filter」第二次点不到。

## 坑
- 网关会退化（10-06 22:00–23:45 短请求 29 s、流式 40 字符/秒），退化时不要起正式运行；探针脚本思路：一次短请求 + 一次 2000 token 流式。
- zsh 里 `for x in "a b"; do set -- $x` 不拆词；起多个后台进程逐条写。
- 本地 stdout.log 是块缓冲，进度看 `runs/<run>/.oneshot-*/progress.json`。
- 旧回归判据剔除决赛改动的需求（Sheet REQ-2-1-3）。
