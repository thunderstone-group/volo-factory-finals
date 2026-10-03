# 2026-10-03 ARC 完整榜首与继续提分

先读本页；代码规则在 AGENTS.md，实验边界见 docs/reference/roadmap.md。状态从 CLI/git 现场读，以下是本次观察。E2 = `~/projects/arcbench-campaign/evidence/2026-10-02-s70`。

- 用户要求继续提高两个任务，main 始终保留最新可交付版。现有练习/正式余额已授权，不充值，无子 agent 授权；不要反复推演或重复付费运行。开发在 worktree，验证后 PR 合 main 并清理。
- 完整正式 v7 submission `12e3bab723fd`：G `c5e4493bad81` 76/100、CNY2.017375；Sheet `5d3438cb9865` 80/100、CNY9.135983；同一提交 156/200、S92.6557759483609、当时 rank1。来源和终态见 `docs/evidence/2026-10-03-v7-complete-and-repair-feedback.json`。此前 Sheet 消失只是新提交没有完成该任务，现已恢复。历史 Orchestro S103.61657 仍高于这次分数，榜上消失的原因未查，不作合规推断。
- 正式包仍是 E2/candidate-selected-value-v7.zip，SHA4ae64326c7e942c97e37685641766881b20d7d81c061ccc309d167f395a88f48。不要把本次源码改进当作平台已采用。
- 当前补跑 Sheet `defb678bf0a1`，同一有效提交保留最佳成绩。E2/watch_v7_stages.py / exec3182 等待它终态后依次启动 GitHub Stage1、2、3，每次校验最新 submission 和余额，串行继承上阶段最佳应用。看 E2/v7-stages-watch.log、v7-sheet-repeat-result.json、v7-official-stage-*-start.jsonl/result.json、v7-board-after-stages.json。恢复必须读现有 run id，不重复执行 start。旧 exec2772 观察已超时并退出，不能据此重启原任务。
- 今日 selftest 基线已完成：同一 G76 应用 25/30、23/29、28/41，合计76，与正式分相同。E2/v7-official-github-76/stage-feedback-summary.json：13定位歧义、6超时、4导航缺失、1评测函数 uniqueAccount 未定义。重复 Code 链接是应用问题；部分宽泛定位同时匹配正常状态与历史，不能把全部失败算成业务缺陷。不要隐藏合法历史或删除其他记录来迎合歧义。
- G 导航受控产物 E2/v7-github-navigation-control 只修首页 Settings、搜索后重复 Code 导航及返回文件列表。原生角色选项改动导致局部回退，已撤回。其 Stage2 自测仍23/29：歧义消失后暴露了搜索上下文被清空，未证明提分；手修应用只是诊断，不放入 agent 包。今日 selftest 已完成4次，额度最多10次；不要猜剩余额度，以终态/服务响应核对。
- Sheet 的实际缺陷：创建/打开筛选写读 session filters，但弹窗读取 sheet.filters。E2/v7-sheet-filter-control 只改一处 reader；真实 Chromium 弹窗由关闭到打开，固定 g99/cov99n-arm 各88到91，原通过项均保留。
- 通用 agent 改进：源码审查接收剩余浏览器失败线索并追踪实际 writer/reader/renderer；测试自身的 beforeAll/afterAll page fixture 错误回交测试作者；源码依赖链接不再25轮截断，以有限源码索引为界。两次实际调用 CNY估算0.623199，自动找到筛选反例，定义不改即原应用 fail/一行修复 pass。其他生成反例仍有夹具局限，不能把全部 fail 当作质量问题。E2/v8-source-observations-sheet 保留原始执行和固定对照。
- 主分支 CLI0.5.0 已包含正式额度、群友 doctor PR11 和 selftest API，已安装远端 main。环境在 ~/.config/arcbench/volo.env，不输出密钥。当前 formal submission 的 credential_mode=official_evaluation；其平台专用 key 与本机练习 key 分开。自费共享 key 模式仍必须防止并发污染计量。

继续顺序：读取上述运行现有句柄；核对 G 导航控制收益和 Sheet 补跑终态；保持当前正式提交到完整验证新候选后再替换。下一份包要验证全新双题和固定独立检查，不能把手修应用增分当作 agent 泛化成绩。阶段路线须完成三阶段、同提交最佳 Sheet 和完整来源 run ids 后再报总榜分。
