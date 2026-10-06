# 2026-10-06 19:50 决赛备战：决赛包 v2 已定，定点编辑起草在验证

先读本页、AGENTS.md、`docs/reference/finals-roadmap.md`（决赛真源，含 4.5 节当前决赛包与 F2/F3 状态）。git 和 CLI 是现状真源。E3=`~/projects/arcbench-campaign/evidence/2026-10-06-finals`，L=`~/projects/arcbench-campaign/finals-local`。

## 目标与约束（用户原话）
- 10-06 12:20 用户：「arc 我们进决赛了，可以开始猛攻决赛了，你跟 gpt6astra max 一起」。Codex 本机默认就是 gpt-6-astra + max，派发走 codex-dispatch skill（`~/.agents/skills/codex-dispatch/bin/codex-job.sh`），重要判断先让 Codex 对抗评审。
- 练习额度已授权直接跑；volo-factory 的 PR 验收后自己合；包里不写题名和答案；决赛代理暗题（主会话专用）的位置不写进任何派发单或本仓库，跑法见 `~/projects/arcbench-campaign/acceptance-hidden/README.md` 末节。

## 决赛事实
- 平台竞赛 `hackathon-evolution`：从初赛最新提交选中的 G79（run afc04ffe5b63）、Sheet87（run defb678bf0a1）继续进化，2 题 60 条，10-06 19:50 仍 upcoming（403）。报名 can_confirm=True，等甲方确认。
- 组委会 10-06 18:13 邮件「入围 Hackathon 决赛通知」：决赛安排只在决赛微信群公告发布，入群二维码是邮件内嵌图（尺素取不出），等甲方扫码入群并用 ChatDrop 转公告。

## 当前决赛包（main 9e1051e 起，包 9293a251）
发布修复（#121）+ Light 编译器默认关（#125）+ 进化模式跳过源码审查（#127）+ 宽松守卫默认开（#129）。证据：平台练习 6 题 38/38（提交 9b6dfbecf17a），代理 30/30、30/30，估算 0.75/0.69 元/题。否掉的：严格豁免守卫（平台 36/38，逼回需求合法删掉的容器）。

## 在跑（19:45 起，nohup，能活过 /clear）
- 定点编辑起草（分支 feat/upgrade-patch-draft f7f40d5，Codex 交付，默认关 `ONESHOT_UPGRADE_PATCH=1`；报告 worktree upgrade-patch-draft 的 docs/reports/2026-10-06-upgrade-patch-draft.md）。验证：
  - 平台 6 题，默认开变体包 1d31282d（分支 exp/upgrade-patch-default-on），提交 eb0354fab442，run id 在 E3/patch-ids.txt；
  - 本地代理两题 × 2 样本，分支包 6293670a + 环境变量开，结果在 L/runs/{github,sheet}-patch-6293670a-{s1,s2}；
  - 汇总脚本 L/summarize_patch.sh 写 L/patch-summary.txt，末行 DONE 表示全部完成（若脚本死了，直接重跑它，它会重新 wait 已有 run）。
- 判据（写死）：平台 ≥ 38/38；代理新功能不低于 30/30、30/30；GitHub 旧功能回归（v6-fixed-independent）两样本都 ≥ 106（关闭时 6 次为 107/106/106/105/103/100，起点 107），Sheet g99 ≥ 66、cov99n ≥ 96；费用不高于 v2 的 1.5 倍。过了就把 feat/upgrade-patch-draft 改成默认开（参照 #129 的做法：代码默认 "1"，tests_oneshot/test_oneshot.py OfflineCase 夹具里 patch 成 False），PR 合 main，更新 finals-roadmap 4.5 与日志；没过就保持默认关，记录原因。

## 下一步（第一条命令）
`cat ~/projects/arcbench-campaign/finals-local/patch-summary.txt`（没有 DONE 就等）。之后：按判据定去留 → 更新路线图/progress → 检查 `arcbench competitions | grep hackathon-evolution` 与 ChatDrop 是否有「决赛群」会话，决赛一开放就下载需求，用 Light 编译器覆盖率（`oneshot/light_tests.compile_requirements`）判断题面风格，再上传决赛包（`arcbench upload ... --competition hackathon-evolution --official-evaluation`，先确认报名与额度）。

## 坑
- `arcbench source` 下载的文件会被 CLI 秘钥脱敏改坏（`password = ***`），E3/base-web-* 不可信，可信起点在 E3/base-recovered/。待修 arcbench-cli。
- 平台费用列在并发 run 时虚高（共享计量表），真实花费看 `arcbench balance` 差值；19:45 余额约 300 元。
- 守卫只看未登录界面；登录后的旧功能丢失只能靠起草别丢（定点编辑）。
- 本地 run_local.py 判分输出必须写在暗题目录内（脚本已处理）；跑 testgen.run_suite 要传绝对路径的 suite 目录，并设 NODE_PATH=/var/folders/j8/60kxyby16mzdsdsy73k7w4bc0000gn/T/oneshot-playwright-test-1.57.0/node_modules。
- 把守卫或其他浏览器机制改成默认开时，离线单测会去起浏览器而卡死，夹具里要显式关掉。
- 平台日志会截断超长的 `[oneshot] smoke` 行，完整日志从 `arcbench download` 的 bundle 里 `template/.arc/stdout.log` 读。

## 等甲方
1. 扫码入决赛微信群，把群公告转给 ChatDrop。2. 平台确认决赛报名（推荐按初赛队员名单）。
