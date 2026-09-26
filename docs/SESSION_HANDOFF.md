# 当前交接 — 2026-09-26 15:10：接力跑包 60380c6d（4.23 第二套书面测试），3 轮

先读 [改进路线图](reference/roadmap.md) 第 27 版日志和 4.23；证据 `docs/evidence/2026-09-26-second-suite/README.md`；数字见 [progress.md](progress.md) 账本表第 15、16 行。

## 状态

- 总榜第 1，S 55.37（提交 `2d65ddb1c133`，包 9bbd6939：GitHub 25、Sheet 79）。
- 甲方 15:07「都按推荐」：4.23 上正式提交，基底 main（含 4.21），GitHub 也开第二套书面测试。
- 接力：15:09 起用包 `60380c6d`（main a6d7529），进程 `scripts/submission_chain.py`（main 里起的，nohup，3 轮、保留 200 元、10-01 23:00 后不再起新提交），日志 `~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/official/chain-2026-09-26-second.jsonl`，输出同目录 `.out`。第一轮提交 `0ca9c21d4bf9`：GitHub `d34e9b03b172`、Sheet `fa94581a6fa7`。
- 每次提交预计约 40 元（多写两套测试），每轮可能比以前长 1–2 小时。比赛额度 334.37 元（15:09）。

## 接下来

1. 每轮出分填账本第 16 行起。日志里每题应有两条 `acceptance tests` 和两条 `repair end`；第二条 `acceptance tests` 缺失，或出现 `second suite skipped`，要看原因。
2. 4.23 判据 ③：3 次提交后 Sheet 均值高于 77.0、GitHub 不低于 20，不过就关掉 `ONESHOT_SECOND_SUITE`。
3. 已知风险：3:1 规则会放过真退步（ed1e 回放里公式复制被丢了一条）。
4. 小候选（没做）：书面测试的 API 误用（`toHaveText can be only used with Locator object`）不算测试自身错误；可加进 `OWN_ERROR`。
5. worktree `repair-order`、`suite-load`、`sheet-batch2`、`suite-timeout`、`no-4-21`、`second-suite` 可删；分支 `relay/without-4.21`（包 50eb9932）留作备选。

## 不要做

- 不要把平台返回的失败测试内容，或正式题、练习题的专名写进包里。
- 不要把受控回放的分数当成进展。
- 不要改校准判据来让候选过关。
- 不要在接力脚本运行时手动上传提交（只有最新提交能起 run，会打断接力）。
- 停接力要在它等 run 的时候停；run 一结束它会在两分钟内上传下一轮。

---

# 当前交接 — 2026-09-26 09:10：榜首更新为 S 55.37（包 9bbd6939 第二轮）；接力已停，下一包待甲方定

先读 [改进路线图](reference/roadmap.md) 第 26 版日志和 4.20–4.22；数字见 [progress.md](progress.md) 账本表第 13–15 行。

## 状态

- **总榜第 1，S 55.37**：提交 `2d65ddb1c133`（包 9bbd6939），GitHub 25（GitHub 最好）、Sheet 79，费用 22.21 元。原最好是第九次 55.27。
- 夜里修了 4.22（书面测试超时零结果，Sheet 因此 1/100），PR #79 合入 main。
- 4.21 按判据撤回（第一轮 Sheet 69 < 78）；第二轮 Sheet 79。4.21 两读 69、79，此前三包 78、79、80。
- 没有接力在跑。比赛额度 334.37 元（09:05）。arcbench cookie 10-09 过期。
- 两个现成的包：`9bbd6939`（main，含 4.21；两轮 GitHub 20、25，Sheet 69、79）和 `50eb9932`（分支 `relay/without-4.21`，不含 4.21；同代码无缺陷的读数还没有，13640cc2 那份 GitHub 两次 24）。都在 `official/packages/`。

## 待甲方定

1. 接下来的提交用哪个包。推荐 `50eb9932`：4.21 的预设判据没过，两读也看不出它帮 Sheet；GitHub 各包差异在噪声里。若想少一个变量，就用 main 的 9bbd6939，它刚拿到榜首成绩。
2. 接力轮数和保留额度（每轮约 22 元；截止 10-01 23:59）。

## 接下来

1. 起接力后逐轮填账本第 16 行起。
2. 小候选（证据弱，没做）：书面测试的 API 误用（`toHaveText can be only used with Locator object`）没被认作测试自身错误，被当成 helper 缺陷送去修；可加进 `OWN_ERROR`。
3. worktree `repair-order`、`suite-load`、`sheet-batch2`、`suite-timeout`、`no-4-21` 在分支处理完后可删。

## 不要做

- 不要把平台返回的失败测试内容，或正式题、练习题的专名写进包里。
- 不要把受控回放的分数当成进展。
- 不要改校准判据来让候选过关。
- 不要在接力脚本运行时手动上传提交（只有最新提交能起 run，会打断接力）。
- 停接力要在它等 run 的时候停；run 一结束它会在两分钟内上传下一轮（06:48 就是这样晚了一步）。

---

# 当前交接 — 2026-09-26 06:55：4.21 撤回；接力已停，第二轮（包 9bbd6939）在跑；下一包 50eb9932 待上传

先读 [改进路线图](reference/roadmap.md) 第 25 版日志和 4.20–4.22；数字见 [progress.md](progress.md) 账本表第 13–15 行。

## 状态

- 总榜第 1 仍是第九次（S 55.27）。GitHub 最好 24（包 13640cc2，两次），Sheet 最好 80（包 f08f3fdf）；还没有一次提交把两者凑齐。
- 夜里修了 4.22（书面测试超时零结果，Sheet 因此 1/100），PR #79 合入 main，包 9bbd6939。
- 包 9bbd6939 接力第一轮（`2c440765a81d`）：GitHub 20、Sheet 69，S 46.67。4.21 判据（Sheet ≥ 78）不过，**4.21 撤回**。
- 接力进程 06:48 已停（`chain-2026-09-26-timeout.jsonl` 末行说明）。停的时候第二轮已经上传并起跑：提交 `2d65ddb1c133`，GitHub `4310823c83f3`、Sheet `4c98ff3ad8b3`，包 9bbd6939。没有取消（刚起跑，而且 09:00 后本来也不会再起新提交）。出分后手工填账本第 15 行；它是 4.21 的第二个读数，只作参考。
- 撤回 4.21 后的包 **`50eb9932`**：分支 `relay/without-4.21`（27501d3 + 4.20 + 4.22，与 main 的差别只有 4.21 的三个文件），存档 `official/packages/pkg-50eb9932.zip`。还没上传过。
- 比赛额度约 356 元（第二轮起跑前 378.69 减第一轮 22.12）。arcbench cookie 10-09 过期。

## 接下来

1. 第二轮两题结束后（约 09:15），填账本第 15 行。
2. 推荐：接下来的提交用包 50eb9932 起接力（`scripts/submission_chain.py --package .../pkg-50eb9932.zip --name-prefix volo-oneshot-50eb9932 ...`，时间和轮数由甲方定）。依据：13640cc2 那份代码 GitHub 两次 24；它的两次 Sheet 低分（59、1）分别是 4.20、4.22 修掉的缺陷；4.21 判据没过。
3. main 上 4.21 还在。若第二轮 Sheet 也低于 78，就在 main 上 revert 143c0ef、95fd830，让 main 与接力包一致；若 ≥ 80，再议。
4. 小候选（证据弱，没做）：书面测试的 API 误用（`toHaveText can be only used with Locator object`）没被认作测试自身错误，被当成 helper 缺陷送去修；可把它加进 `OWN_ERROR`。
5. worktree `repair-order`、`suite-load`、`sheet-batch2`、`suite-timeout`、`no-4-21` 在分支处理完后可删。

## 不要做

- 不要把平台返回的失败测试内容，或正式题、练习题的专名写进包里。
- 不要把受控回放的分数当成进展。
- 不要改校准判据来让候选过关。
- 不要在接力脚本运行时手动上传提交（只有最新提交能起 run，会打断接力）。
- 停接力要在它等 run 的时候停；run 一结束它会在两分钟内上传下一轮（06:48 就是这样晚了一步）。

---

# 当前交接 — 2026-09-26 03:15：接力换成包 9bbd6939（f37fc67d + 书面测试超时保留结果）

先读 [改进路线图](reference/roadmap.md) 第 24 版日志和 4.20–4.22；数字见 [progress.md](progress.md) 账本表第 13、14 行。

## 状态

- 总榜第 1 仍是第九次（S 55.27）。GitHub 最好 24（包 13640cc2），Sheet 最好 80（包 f08f3fdf）；还没有一次提交把两者凑齐。
- 13640cc2 第二轮 Sheet `dca5df727dcb` 隐藏 **1/100**：初稿栈溢出，书面测试在平台上跑过 900 秒被掐断、零结果，修复 0 轮（4.22）。f37fc67d 同样会中招，所以在它第一次上传前换成包 `9bbd6939`（分支 `fix/suite-timeout` 66adb30，PR 合入 main）。
- 夜间接力：03:11 起用包 `9bbd6939`，进程 `scripts/submission_chain.py`（main 里起的，nohup，4 轮、保留 200 元、09-26 09:00 后不再起新提交），日志 `~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/official/chain-2026-09-26-timeout.jsonl`，输出同目录 `.out`。它先等 13640cc2 第二轮的 GitHub `4dc11acce4d1` 结束；那条 GitHub 分数要手工填账本第 13 行。
- 受控回放（4.22 判据 ③）在本机跑：`/private/tmp/claude-501/-Users-e0-7-projects/876b5ae9-a273-497b-89d5-e2ea073c5e55/scratchpad/dca5/replay-new/`，第一轮 1→38 pass 已接受。
- 比赛额度 391.02 元（03:15，GitHub `4dc11acce4d1` 仍在跑）；`arcbench balance` 显示 402.69 元（as_of 19:12 UTC）。arcbench cookie 10-09 过期。

## 接下来

1. 早上读接力结果：账本第 13 行补 GitHub，第 14 行起逐轮填；日志 `repair end` 行里 `counts_after` 不应再是全 `unparsed`，超时的运行会有「stopped at its 900 s limit」的未运行条目。
2. 4.21 判据（Sheet 不低于 78）、4.18 继续看 GitHub。
3. 暂缓项：种子冲突合并（`feat/sheet-batch2` 的 babbaa3），证据弱。
4. worktree `repair-order`、`suite-load`、`sheet-batch2`、`suite-timeout` 在分支合入后可删。

## 不要做

- 不要把平台返回的失败测试内容，或正式题、练习题的专名写进包里。
- 不要把受控回放的分数当成进展。
- 不要改校准判据来让候选过关。
- 不要在接力脚本运行时手动上传提交（只有最新提交能起 run，会打断接力）。

---

# 当前交接 — 2026-09-26 01:50：接力换成包 f37fc67d（GitHub 24 的依赖顺序修复 + Sheet 修正）

先读 [改进路线图](reference/roadmap.md) 第 23 版日志和 4.18–4.21；数字见 [progress.md](progress.md) 账本表第 12–14 行。

## 状态

- 总榜第 1 仍是第九次（S 55.27）。GitHub 最好 24（包 13640cc2），Sheet 最好 80（包 f08f3fdf）；还没有一次提交把两者凑齐。
- 夜间接力：01:46 起用包 `f37fc67d`（main 上 `fix/suite-load` 合入后的代码），进程 `scripts/submission_chain.py`（main 里起的，nohup，4 轮、保留 200 元、09-26 09:00 后不再起新提交），日志 `~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/official/chain-2026-09-26.jsonl`，输出同目录 `.out`。换包时 13640cc2 的第二轮（提交 `4e6ef6222609`，GitHub `4dc11acce4d1`、Sheet `dca5df727dcb`）还在跑，新接力等它结束才上传；它的结果要手工填账本第 13 行。
- 包 f37fc67d 比 13640cc2 多：书面测试文件加载不了时找出来跳过（4.20）；脚手架菜单修正、筛选不藏控件的卡片规则（4.21）。
- 比赛额度 399.30 元（01:21）；练习 key 约 190 元。arcbench cookie 10-09 过期。

## 接下来

1. 早上读接力结果：账本第 13 行起；4.21 判据（Sheet 不低于 78）、4.18 继续看 GitHub。日志 `repair end` 行带最后失败、error 的书面测试 id；停止原因若是「测试跑不了」会带运行器报错。
2. 若某次提交两题都到最好水平（GitHub 20+、Sheet 80+），S 会明显超过 55.27；接力就是在抽这个样本。
3. 暂缓项：种子冲突合并（`feat/sheet-batch2` 的 babbaa3），证据弱；要用得先多写两套测试比较。
4. worktree `repair-order`、`suite-load`、`sheet-batch2` 在分支合入后可删（接力脚本从 main 运行）。

## 不要做

- 不要把平台返回的失败测试内容，或正式题、练习题的专名写进包里。
- 不要把受控回放的分数当成进展。
- 不要改校准判据来让候选过关。
- 不要在接力脚本运行时手动上传提交（只有最新提交能起 run，会打断接力）。

---

# 当前交接 — 2026-09-25 23:15：接力跑包 13640cc2（依赖顺序修复 + Sheet 诊断修正）；双初稿择优已撤回

先读 [改进路线图](reference/roadmap.md) 第 22 版日志和 4.17–4.19；数字见 [progress.md](progress.md) 账本表第 11、12 行和 09-25 晚上三节；Sheet 诊断全文 `docs/evidence/2026-09-25-sheet-gap/README.md`。

## 状态

- 总榜第 1 仍是第九次提交（S 55.27）。第十次 p 46.0%，接力第一轮 p 48.0%（Sheet 80 是 Sheet 最好，GitHub 16）。
- 夜间接力：23:07 起用包 `13640cc2`（提交 27501d3，分支 `feat/repair-order`）。进程 `scripts/submission_chain.py`（从 worktree `../volo-factory-worktrees/repair-order` 起的，nohup，5 轮、保留 200 元、09-26 09:00 后不再起新提交），日志 `~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/official/chain-2026-09-25-order.jsonl`，输出同目录 `.out`。第一轮提交 `907c6878f22f`（GitHub `1f0760580523`、Sheet `7936cf7a0ab0`）。接手先 `ps aux | grep submission_chain` 和 `arcbench runs --limit 6`，别重复提交；脚本崩了就看 `.out`，按账本补记后重启。
- 包内改动：修复请求按需求依赖深度排序、helper 不再被截掉（4.18）；测试文件去 Markdown 围栏；改名守卫看得见 `aria-label` 覆盖字段名（4.19）；书面测试 grounding 合并空白、认编号名；等书面测试上限 3600 秒。
- 双初稿择优（4.17）按判据 ④ 撤回，代码已删。
- 比赛额度 416.46 元（23:07）；练习 key 约 205 元。arcbench cookie 10-09 过期。

## 接下来

1. 接力每轮出分：填账本第 12 行起；GitHub 日志的 `repair end` 行现在带着最后失败、error 的书面测试 id。4.18 判据 ④：第一次 GitHub 不低于 17。
2. Sheet 下一批（诊断排序，见 4.19「未做的候选」）：脚手架菜单与选区（预计 +2..+4）、种子描述冲突合并（+1..+3，GitHub 同类）、卡片「筛选不藏自己的控件」（+1..+2）、新会话不改共享状态的检查。每项先按诊断里写的本地验证方法做，再进包。
3. GitHub：代理仍松（书面 84 对隐藏 16）；4.13 的严格测试要多套比较。
4. PR `feat/repair-order` 合 main 后删 worktree（接力脚本正从该 worktree 运行，等接力结束再删）。

## 不要做

- 不要把平台返回的失败测试内容，或正式题、练习题的专名写进包里。
- 不要把受控回放的分数当成进展。
- 不要改校准判据来让候选过关。
- 不要在接力脚本运行时手动上传提交（只有最新提交能起 run，会打断接力）。

---

# 当前交接 — 2026-09-25 19:50：双初稿择优上线（包 f08f3fdf），夜间接力已换包；第十次在跑

先读 [改进路线图](reference/roadmap.md) 第 21 版日志和 4.17；数字见 [progress.md](progress.md) 账本表第 10、11+ 行和「09-25 19:50」一节。

## 状态

- 甲方 18:38 拍板按推荐走：GitHub 做双初稿择优（4.17）。包 `f08f3fdf`（提交 2328d2c，PR `feat/draft-pair`）：第二份初稿与第一份并行起草，第一份书面测试过不到三分之一才评第二份，通过多的进修复。本地 GitHub 真实运行过了判据 ①②，并修掉了路由门禁让第二份不被测的缺陷。
- 夜间接力：19:46 起用包 f08f3fdf（旧的 c5152707 接力在上传前停掉，没有产生提交）。进程 `scripts/submission_chain.py`（nohup，5 轮、保留 200 元、09-26 09:00 后不再起新提交），日志 `~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/official/chain-2026-09-25-pair.jsonl`，输出同目录 `.out`，包存档 `packages/pkg-f08f3fdf.zip`。它会先等第十次两题跑完。接手先 `ps aux | grep submission_chain` 和 `arcbench runs --limit 6`，别重复提交。
- 第十次提交（`a2375cd48c2a`，包 c5152707）在跑：Sheet `ed1ef8fb5d78` 修到 15 轮、书面测试 81；GitHub `d58e50066c0a` 初稿 11，6 轮后 23。
- 总榜第 1 仍是第九次（S 55.27）。比赛额度约 466 元（第十次起跑前）；练习 key 约 228 元。
- **arcbench 会话**：甲方 09-25 重新登录了 Chrome「Profile 1」，19:50 已重新 `arcbench session --profile "Profile 1"`，env 里的 cookie 10-09 15:09 过期，赛期内不用再登录。注意 Profile 1 里还留着一条 09-29 过期的 `www.arc-bench.com` 旧 cookie，CLI 按读到的顺序取最后一条（这次取对了）；再抓会话后用 `arcbench whoami` 确认。

## 接下来

1. 第十次出分：填账本第 10 行。
2. 接力每轮出分：按提交填账本第 11 行起；GitHub 日志里找 `draft pair` 行，核 4.17 判据 ③（两份的通过数都在，`acceptance tests` 到 `draft pair` 不超过 20 分钟）和 ④（GitHub 隐藏分不低于 17）。④ 不过就停接力、换回 c5152707。
3. 提分方向（按证据强弱）：GitHub 代理太松（4.13）；Sheet 别队 90–99%、我们 79；修复都停在「连续 4 轮被拒」。
4. 生成侧候选（证据弱）：同名种子只种一份；没写密码的种子账号用需求给出的密码。

## 不要做

- 不要把平台返回的失败测试内容，或正式题、练习题的专名写进包里。
- 不要把受控回放的分数当成进展。
- 不要改校准判据来让候选过关。
- 不要在接力脚本运行时手动上传提交（只有最新提交能起 run，会打断接力）。

---

# 当前交接 — 2026-09-25 17:40：第九次提交 p 50.5%，总榜第 1；第十次在跑；夜间接力抽样

先读 [改进路线图](reference/roadmap.md) 第 20 版日志、4.13–4.16；数字见 [progress.md](progress.md) 账本表第 7–10 行和 09-25 各节；计分与并发的实测规则见 [preliminary-rules.md](reference/preliminary-rules.md)「09-25」两段。

## 状态

- 第九次提交（`dfce9da4382a`，包 6143d95f，4.15 守卫计入 3:1）：GitHub 22、Sheet 79，p 50.5%，费用 16.39 元，S 55.27，**总榜第 1**（Iris 36.34）。main 已合入 PR #73（到 4.16 与接力脚本）。
- 第十次提交（`a2375cd48c2a`，包 c5152707，4.16 轮内追问 + 单元格坐标）：Sheet `ed1ef8fb5d78`（16:45 起）、GitHub `d58e50066c0a`（17:24 起）。
- 夜间接力：`scripts/submission_chain.py` 在第十次两题结束后，把包 c5152707 当新提交重复上传、两题各跑一次、一次一轮；日志 `~/projects/arcbench-campaign/evidence/2026-09-24-hackathon-v2/official/chain-2026-09-25.jsonl`，进程输出同目录 `chain-2026-09-25.out`（nohup 脱离会话运行，09-25 17:30 起，参数：5 轮、保留 200 元、09-26 09:00 后不再起新提交；包存档在同目录 `packages/pkg-c5152707.zip`）。停止条件：轮数用完、额度低于保留线、到点。接手先 `ps aux | grep submission_chain` 和 `arcbench runs --limit 6`，别重复提交。
- 规则：同一道题同时只能有一个正式 run（再起返回 409）；只有最新提交能起 run，所以提交节奏由较慢的 GitHub 决定。正式评测按 run 计费，并发不串费用。
- 比赛额度约 466 元（第十次起跑前）；练习 key 约 205 元。
- **arcbench 会话**：cookie 取自 Chrome「Profile 1」（`arcbench session --profile "Profile 1"`），09-29 11:35 过期，到期前要甲方在该 profile 重新登录。

## 接下来

1. 读第十次两题，填账本第 10 行；看日志里 `follow_up` 轮次是否被收下。
2. 读接力结果（jsonl），按提交填账本；榜只看最好的一次。
3. 提分方向（按证据强弱）：
   - GitHub 代理太松（书面测试 77 对隐藏 22）。4.13 的严格提示 v2/v3 单套校准没过判据；要比较提示须每版写 2–3 套（每套约 7 元练习 key）。v2 Sheet 套件在两份 Sheet 产物上的排序与隐藏相反（2 个样本）。
   - 修复都停在「连续 4 轮被拒」，花费和时间都没用满；被拒原因多是「弄坏 1 条」或「没修好任何一条」。
   - Sheet 别队 90–99%；我们 79。书面测试 88 对隐藏 79，Sheet 代理在修复后是可用的。
   - 待甲方拍板：GitHub 双初稿择优（甲方 09-18 定过不做 best-of-2；注意全程 temperature 0）。
4. 生成侧候选（证据弱）：同名种子只种一份；没写密码的种子账号用需求给出的密码。

## 不要做

- 不要把平台返回的失败测试内容，或正式题、练习题的专名写进包里。
- 不要把受控回放的分数当成进展。
- 不要改校准判据来让候选过关。
- 不要在接力脚本运行时手动上传提交（只有最新提交能起 run，会打断接力）。

---

# 当前交接 — 2026-09-25 13:30：第七次提交两题齐全（p 32%，榜第 2）；第八次提交在跑；严格书面测试校准未过

先读 [改进路线图](reference/roadmap.md) 第 18 版日志、4.13、4.14；数字见 [progress.md](progress.md) 账本表第 7、8 行和「09-25 11:00-」一节；分歧归因见 `docs/evidence/2026-09-25-proxy-looseness/README.md`。

## 状态

- 主办方 10:56：Sheet 列不出用例已修，旧 run 只重跑测试重评（我们的 `c34ae0a54c1e`、`4ef5a779acf2` 截至 13:30 未重评）。平台 run 记录不再返回 `failed_tests`，连旧记录里的也被清掉了；逐条隐藏读数只剩 campaign evidence 里 09-24 存下的两份（第四次 `run-7e3f4dba7736.json`、第五次 `run-5450c3c63fe0.json`）。
- 第七次提交（`3b1bef245862`）：GitHub 21、Sheet 43（`b491936e86f2`，10.06 元），p 32.0%，S ≈ 34.6，榜第 2（Iris 40.5%）。比赛额度 489.94 元。
- 第八次提交（`1503bf3a1f15`，包 d3769ab0，分支 `feat/repair-visibility` 20dcdbd）：GitHub `95ec6880ee7f`、Sheet `e6cf53b272c1`，12:56 起跑。改动见 4.14。出分后读日志里的 `[oneshot] repair round` / `repair end` 行（第一次能看到平台上修复跑了几轮、为什么停），填账本第 8 行；隐藏分不降就开 PR 合 `feat/repair-visibility`。
- 严格书面测试 v2（分支 `feat/testgen-strict`，叠在 repair-visibility 上）：四项判据过两项（第五次提交代理多过 22→9 过；第四次 14→10 未过 ≤7；第五次隐藏独过 4→6 未过 ≤4，多出来的都是 `error`；写套件 7.19 元过）。未进包。第四次提交上剩余 10 条和 3 条误报在子 agent 复查中，结果回来后改 v3、用同一判据再校准。同分支修了测试 id 解析（模型漏写 `#n` 时四条测试共用一个 id，修复记账会错）。
- 校准脚本 `scratchpad/calib.sh SUITE TAG`（本会话 scratchpad `/private/tmp/claude-501/-Users-e0-7-projects/425683f3-24c0-420e-befc-1badcf2e5635/scratchpad/`，平台产物 `b-7e3f`、`b-5450`、`b-5cbf`、`b-b491`，套件 `gh-suite-v2`）。
- **arcbench 会话**：cookie 取自 Chrome「Profile 1」（`arcbench session --profile "Profile 1"`），09-29 11:35 过期，到期前要甲方在该 profile 重新登录。

## 接下来

1. 读第八次提交（两题），填账本；修复是否撞到 24 次/10 元上限、还是连续 3 次被拒。
2. v3 书面测试校准；过了就作为下一个候选（行为改动，按第 7 节至少多样本）。
3. 生成侧候选（未做，证据弱）：同名种子只种一份；没写明密码的种子账号用需求给出的密码。先本地量机制指标。
4. Sheet：代理套件比隐藏更严（本地 30 对隐藏 43），4 个文件解析失败、种子在模块间矛盾；没有逐条隐藏读数，暂不深挖。

## 不要做

- 不要把平台返回的失败测试内容，或正式题、练习题的专名写进包里。
- 不要把受控回放的分数当成进展。
- 不要改校准判据来让候选过关。

---

# 当前交接 — 2026-09-25 04:30：GitHub 稳定 21/100；等主办方修 Sheet

先读 [改进路线图](reference/roadmap.md) 第 17 版日志、4.11、4.12；数字见 [progress.md](progress.md) 正式提交账本表（第 1–7 行）和最后两节。main 3c761e2 = 当前最好的包（书面测试 + 定点编辑修复默认开）。

## 状态

- 新版赛题（09-24 19:05 更正，截止 10-01 23:59）。GitHub：第 6、7 次提交都是 21/100（7.75–10.94 元，80–97 分钟）；之前 11、13。新题 GitHub 榜第一。
- **Sheet 新套件在评测方列不出用例**（run `c34ae0a54c1e`、`4ef5a779acf2`，别队也遇到）；反馈已交甲方转发，附线索「某个测试文件解析失败会让整套 `--list` 失败」。修好前不发 Sheet。
- 受控回放（练习 key、本地代理套件）：GitHub 25→38，Sheet 20→72。代理套件和回放产物在 09-24 夜会话的 scratchpad（`/private/tmp/claude-501/-Users-e0-7-projects/49fc6e81-.../scratchpad/`：`gh-suite-np/`、`sheet-suite/`、`replay*`）。
- 平台日志在大 trace 处截断，看不到修复轮次；近两次 run 记录不带 `failed_tests`。
- 比赛额度约 470 元（主办方说会补 09-24 消耗）；练习 key 约 60 元。

## 接下来

1. Sheet 修好后：main 的包两题各跑一次，拿到完整 S。
2. GitHub 继续提分的候选（按预期收益）：修复轮次上限与时间（平台上修复阶段约 70 分钟，还在涨就被停）；种子冲突（`acme-docs` 归属两说）；看本地代理剩余失败的共性。
3. 书面测试把 trace 写进日志太大，考虑精简 trace 让修复轮次在平台日志里可读。

## 不要做

- 不要把平台返回的失败测试内容，或正式题、练习题的专名写进包里。
- 不要把受控回放的分数当成进展。

---

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
