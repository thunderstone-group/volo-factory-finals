# 当前交接 — 2026-09-24 23:45：新版赛题；Sheet 评测方故障；修复改定点编辑，回放验证中

先读 [改进路线图](reference/roadmap.md) 第 1 节「09-24 晚更正」、4.11、4.12 和第 16 版日志；数字见 [progress.md](progress.md) 最后一节和正式提交账本表。分支 `feat/seed-reach`（worktree `../volo-factory-worktrees/seed-reach`，已推，未合 main）。

## 状态

- 主办方 19:05 更正赛题，截止顺延到 10-01 23:59。新版两题各 100 个场景对应 100 条隐藏测试（测试名末尾 `Scenario <n>` = YAML 里第 n 个场景），GIVEN 写种子。新需求与证据在 `~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/`。
- **Sheet 新套件在评测方那里列不出用例**：run `c34ae0a54c1e`、`4ef5a779acf2` 都是 "Failed to enumerate Playwright tests before execution"。给主办方的反馈草稿已交甲方转发。修好之前别再发 Sheet。
- 正式提交：第 4 次 GitHub 11/100；第 5 次（包 165aece2，种子清单 + 卡 6b）GitHub 13/100。比赛额度约 487 元（主办方说会补今天的消耗）。
- 本地代理测试套件（flash 按新需求写，各 100 条，练习 key）：本会话 scratchpad `gh-suite/`、`gh-suite-np/`（跳过改密码那条）、`sheet-suite/`。只能做 A/B，比隐藏测试宽松。
- 受控回放（GitHub 新包初稿 a）：旧修复 3 轮全被拒（整份重发 93 KB app.js 每轮坏 10 条；零倒退规则扔掉了 25→32 的一轮）。9416c8d 改为 SEARCH/REPLACE 定点编辑、书面测试也按「每丢 1 条至少修 3 条」、helper 阻塞的测试转通过算增益；92b3797 让 testgen 不改种子记录。第二次回放 `replay2-gh-new-a` 在跑。

## 接下来

1. 读第二次回放：收下几轮、代理通过数、每轮耗时。收下且净增，就用 `ONESHOT_TESTGEN=1` 的包发一次 GitHub 正式 run（只发 GitHub），看隐藏分和平台上书面测试能否跑起来（日志里找 `acceptance tests`）。
2. 平台书面测试跑通且隐藏分上升，就把 `ONESHOT_TESTGEN` 默认打开，开 PR 合 main。
3. 主办方修好 Sheet 后：先用最好的包两题各跑一次拿完整 S，再做 Sheet 的 A/B（本地 `sheet-suite`）。
4. 种子冲突（Sheet 的 `Q3 Sales` A1、GitHub 的 `acme-docs` 归属）没有通用解，先不处理。

## 不要做

- 不要把平台返回的失败测试内容，或正式题、练习题的专名写进包里。
- 不要把受控回放的分数当成进展。

---

# 当前交接 — 2026-09-24 14:00：第四次提交的包已备好，等平台维护结束

先读 [改进路线图](reference/roadmap.md) 第 12 节第 15 版日志、4.10 和 4.11；数字见 [progress.md](progress.md) 09-24 14:00 节和正式提交账本表。分支 `feat/testgen-loop`（worktree `../volo-factory-worktrees/testgen-loop`）。

## 状态（以 `arcbench status` 实时读到的为准）

- 平台 arc-bench.com 12:57 起返回「系统维护」500。第三次提交的 Sheet run `14de9c6238ff` 未读；它的 GitHub run 是 1/100。
- 第四次提交候选：提交 9ac8e89，包 `9bf0254a…525f`（交互机制四项修复、方言卡 8a、prerequisites.md；按需求写测试默认关闭）。本地产物在本会话 scratchpad，打包命令 `scripts/package_oneshot.py --output …` 可复现。
- 余额：比赛额度约 494 元（第三次提交前 495.96）；练习 key 约 88 元。

## 后台在跑（14:15 起，本会话 scratchpad `/private/tmp/claude-501/-Users-e0-7-projects/7f16c387-dfb4-4435-a927-a282ac849158/scratchpad`）

- `sub4_chain.py`：等第三次提交 Sheet 跑完，自动上传包 9bf0254a 并在两题各起一次正式 run（只起一次，不重试），日志 `sub4_chain.log`，run 记录存到 campaign evidence 的 `official/`。接手前先 `ps aux | grep sub4_chain` 和 `arcbench runs`，别重复提交。
- 4.11 判据 ③：`ONESHOT_TESTGEN=1` 的本地 Sheet 端到端运行，日志 `gen/hackathon--sheet-tg1.log`，产物 `gen/hackathon--sheet-tg1/`。判据 ① ② 已在一份样本上满足（progress 14:15 节）。

## 接下来

1. 平台恢复：读第三次提交 Sheet（`arcbench status 14de9c6238ff`），填账本；再发第四次提交（`arcbench upload --official-evaluation`，两题各一个 run），跑完读 REQ-3-1-1、REQ-3-1-2、REQ-3-2-1 和 GitHub 严格模式失败有没有下降。
2. 分支验收后开 PR 合 main（PR 可自己合）。
3. 4.11 判据 ①–③：用 `oneshot/testgen.py write/run` 在本地产物上跑；判据过了才把 `ONESHOT_TESTGEN` 默认打开。
4. GitHub：等主办方补 E2E 变量并重评；prerequisites.md 若有内容，包已会读。

## 不要做

- 不要把平台返回的失败测试内容，或正式题、练习题的专名写进包里。
- 不要在 4.11 判据跑完前默认打开按需求写测试。

---

# 当前交接 — 2026-09-24 12:45：第三次正式提交在跑

先读 [改进路线图](reference/roadmap.md) 第 12 节第 13、14 版日志和 4.9；赛制见 [初赛规则](reference/preliminary-rules.md)「开赛后核实」；数字见 [progress.md](progress.md) 09-24 两节和正式提交账本表。

## 状态（run 以 `arcbench status` 实时读到的为准）

- 正式赛 `hackathon`：GitHub、Sheet 各 100 条。VOLO-AI 是队长；额度 495.96 元（第三次提交前）。
- 账本：提交 1 基线 GitHub 5 / Sheet 3（S 4.4）；提交 2 共享状态 GitHub 3 / Sheet 42（S 29.0，榜第 2，Iris 28.5%）；提交 3（包 1b4e26a8，main c93b99c，可点击下拉框加命名规则）run `9de6dee5e02f`（GitHub）、`14de9c6238ff`（Sheet），12:40 起跑。
- GitHub：93 条是评测方漏配 `E2E_*` 变量。主办方 12:28 答复会补上并重评之前的提交，还说应用要把需求 `data` 字段描述的数据写进自己的数据库。重评后要读 GitHub 的逐条报错，看 E2E 的值怎样对上我们应用的种子数据。
- 平台 run 记录带 `failed_tests`（逐条名字和报错），只用于诊断，不进包。隐藏测试按精确名加严格模式定位；超时类失败没有细节。
- 诊断工具：`docs/evidence/2026-09-24-opening-day/testgen/`（flash 按需求写测试的原型，加上运行器；README 写了用法和校准结果）。
- CLI：arcbench-cli PR #9（0.4.0）本机已从分支安装，PR 未合（公开仓库，等甲方）。

## 接下来

1. 读提交 3 的结果，填账本表；和提交 2 按需求编号对比 Sheet 的失败（REQ-5 的下拉框、标签名、同名控件这几类是否消失）。
2. 主办方重评之后，读 GitHub 的逐条报错。
3. 路线图第 14 版日志里的候选 ①：把「按需求生成测试 → 跑 → 按失败修复」接进包里。开工前先请 Codex 对抗评审设计。
4. 最好的包可以重复提交（取历史最高分，每次约 2 元）。

## 不要做

- 不要把平台返回的失败测试内容，或者正式题、练习题的专名写进包里。
- 不要把受控修复的分数当成进展。

---

# 当前交接 — 2026-09-23 16:10：开赛包就绪（main 8285cdb）

先读 [改进路线图](reference/roadmap.md)，第 4 节是每条工作流的状态，第 5 节是开赛首日的步骤，第 12 节是迭代日志。赛制见 [初赛规则](reference/preliminary-rules.md)。本节只写现在在哪一步、接下来做什么。

## 状态（截至 16:10；分支和 run 以 git 和 arcbench 实时读到的为准）

- **开赛包**：main 8285cdb，`scripts/package_oneshot.py` 打包，SHA-256 `bb73b7f4…43aa`（全文见 progress.md 16:10 节）。
  - 内容：交付去零、场景自检（4.2）、场景验收修复（4.3）、减法后的方言卡（4.6）；默认模型 flash（4.5）。
  - 新流水线的干净 flash 样本：Keep 5 次全 32/32，BookStack 32–34，每题 0.8–1.6 元。
- **新流水线在大题上的实跑（本地，12306 旧写法）**：101/135 和 98/135；旧流水线同口径是 51、51。
  - 修复 7 轮只接受 1 轮，原因是整份重发大 app.js 容易改坏别的场景。
  - 每题 2.6–3.5 元，33–41 分钟；一次场景检查本地约 4–5 分钟，平台只有 1 CPU，会更慢。
- **包的平台式实跑**：从解压后的 zip 按平台方式跑 Keep，32/32，1.43 元。
- **余额**：练习 key 约 150 元，09-24 00:00 清零。

## 接下来（开赛首日，09-24 00:00 以后）

1. 取正式题的需求，核对它与平台运行时拿到的输入是否一致。
2. 量场景解析覆盖率：规则解析多少、模型翻译多少，重点看大题。命令是 `scenario_check.run` 或 `scenarios.plan`。
3. 00:00 后如果还有练习额度，用正式题在本地各生成 2 次，重点看大题的修复轮数、耗时和费用。
4. 发第一次正式提交：只能由队长账号发起，提交前先确认。提交后按路线图第 6 节记账。

## 已知风险和后续项

- 断网超过约 35 秒会让起草整题失败。今天三次本机断网都来自 Clash：网关流量走兜底规则出洛杉矶节点，平台上不会有。本机实验要稳定，可以给 arc-bench.com 配单独的规则，这需要甲方确认。
- 召回缺口：自检没发现失败场景时，新循环就不修，配对对比里有 1 份 Keep 因此少 2 条。
- 脚手架 `APP.screens` 的 `this` 绑定，模型反复犯错。可以在脚手架里固定 `this` 来根治。

暗题验收资产的位置记在项目记忆里，不要写进派发单。

## 不要做

- 不要把受控修复的分数当成进展。
- 正式提交只能由队长账号发起，提交前先确认。
