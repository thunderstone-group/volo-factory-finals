<p align="center">
  <img src=".github/tech/00-title.jpg" width="100%" alt="VOLO Factory 技术记录：从 0 到 1，架构是怎么减出来的">
</p>

<h3 align="center">架构是怎么减出来的 · How the architecture was subtracted</h3>

<p align="center">左边是流水线的五个环节，每一章改动其中几格；右边是那一次决定的证据。<br><sub>Left: the five pipeline stages, changed chapter by chapter. Right: the evidence behind each decision.</sub></p>

<p align="center"><a href="README.md">README</a> · <a href="#完整决策表--full-decision-log">完整决策表 Full log</a> · <a href="EXPERIMENTS.md">116 条实验 Experiments</a></p>

## 一览 · At a glance

| 日期 Date | 改动 Change | 结论 Verdict | 决定性读数 Deciding reading |
|---|---|---|---|
| [09-11](#09-11--起点--start) | 多轮工具循环<br><sub>multi-round tool loop</sub> | 起点 start | Keep 186 次调用 calls · 22/32 · ¥12.03 |
| [09-15](#09-15--一次起草--one-call-draft) | 一次起草 + 方言卡<br><sub>one call + dialect card</sub> | 采用 adopted | 27/32、29/32 · ¥0.88–0.94 |
| [09-18](#09-18--门禁与温度-0--gates-and-t--0) | 确定性门禁 · 温度 0<br><sub>deterministic gates · T = 0</sub> | 采用 adopted | 60.8/34.0 → 64.5/58.6 |
| [09-23](#09-23--先写判据--criterion-first) | 判据先行 · 3:1 修复<br><sub>criterion first · 3:1 repair</sub> | 采用 adopted | 23 样本 samples · 0 满分 perfect |
| [09-24](#09-24--开赛--day-one) | 服务器共享状态<br><sub>shared server state</sub> | 采用 adopted | Sheet 3 → 42 |
| [09-25](#09-25--只读需求写测试--tests-from-requirements) | 只读需求写测试 · 定点编辑修复<br><sub>tests from requirements · patch repair</sub> | 采用 adopted | Sheet 43 → 53 → 79 · S 55.27 |
| [09-26～10-01](#09-2610-01--平台期--plateau) | 四个候选，按判据去留<br><sub>four candidates, judged by criterion</sub> | 3 未采用 · 1 采用<br><sub>3 dropped · 1 adopted</sub> | ¥22 → ¥17 |
| [10-02～10-03](#10-0210-03--冲刺--sprint) | vision-exp 模型<br><sub>vision-exp model</sub> | 采用 adopted | S 104.96 |
| [10-06](#10-06--在旧应用上进化--evolve-the-shipped-app) | 只回写改动 · 升级时关掉源码审查<br><sub>write back changes · review off</sub> | 采用 adopted | 8 题零分 → Web 38/38 |
| [10-06](#10-06--不调模型的守卫--a-guard-without-the-model) | 旧行为守卫（宽松）<br><sub>regression guard (lenient)</sub> | 采用 adopted | 38/38 vs 36/38 |
| [10-06 晚](#10-06-晚--需求写了位置就照着放--stated-placement) | 位置进方言卡、测试和守卫<br><sub>placement into card, tests, guard</sub> | 采用 adopted | 24/60 → 50/60 |
| [10-07](#10-07--泛化审查--generalization-audit) | 删改迎合评测的规则，加回四条，挪不复制<br><sub>coupled rules cut, four back, move not copy</sub> | 采用 adopted | 98.48 撤回 → 99.88 |
| [10-08](#10-08--第六版--version-six) | 显示约定清单<br><sub>display checklist</sub> | 最终 final | 58/60 · S 120.49 |

## 09-11 · 起点 · Start

<img src=".github/tech/01-start.jpg" width="100%" alt="起点：多轮工具循环，大题 Keep 186 次调用">

| 之前 Before | 之后 After | 依据 Evidence | 出处 Source |
|---|---|---|---|
| — | 多轮工具循环：分批生成，循环内自检、修复<br><sub>multi-round tool loop, self-check and repair inside</sub> | 练习小题两题全过、第 1、1.6 分钱；大题 Keep 一局 186 次调用、22/32、¥12.03<br><sub>smoke tasks passed, rank 1; Keep: 186 calls, 22/32, CNY 12.03</sub> | [09-11～09-14 账本](docs/archive/progress-2026-09-11-to-09-14.md) · [EXPERIMENTS.md](EXPERIMENTS.md) |

## 09-15 · 一次起草 · One-call draft

<img src=".github/tech/02-oneshot.jpg" width="100%" alt="同一道 Keep：多轮循环 22/32 ¥12.03，一次起草 27/32、29/32 ¥0.88–0.94">

| 之前 Before | 之后 After | 依据 Evidence | 出处 Source |
|---|---|---|---|
| 多轮工具循环<br><sub>tool loop</sub> | 一次调用 + 方言卡；无工具、无自检、无修复<br><sub>one call + dialect card; no tools, no self-check, no repair</sub> | 22/32 · ¥12.03 → 27/32、29/32 · ¥0.88–0.94 | [蒸馏报告](docs/reports/2026-09-18-distillation.md) |
| TypeScript 内核重写<br><sub>TS kernel rewrite</sub> | 否定 rejected | 场景检查编译器 32 条里 24 条判不了<br><sub>scenario compiler could not judge 24 of 32</sub> | `tag:archive/2026-09-16/ts-kernel` |
| Prime Agent 适配<br><sub>Prime Agent adaptation</sub> | 否定 rejected | 6/32 → 18/32 → 22/32；自建测试 37/37 就停，官方挂 14 条<br><sub>stops at its own 37/37; 14 official failures</sub> | [初赛路线图第 8 节](docs/reference/roadmap.md) |

## 09-18 · 门禁与温度 0 · Gates and T = 0

<img src=".github/tech/03-ladder.jpg" width="100%" alt="知识阶梯：门禁、骨架、表、散文；温度 0 让两样本差距收窄">

| 之前 Before | 之后 After | 依据 Evidence | 出处 Source |
|---|---|---|---|
| 规则写在提示词里<br><sub>rules as prose</sub> | 能做成门禁就不写进卡片，随包发脚手架<br><sub>gate it if you can; ship a scaffold</sub> | 一夜 11 轮：45.0% → 60.8%<br><sub>one night, 11 rounds</sub> | [ADR 0001](docs/adr/0001-distillation-ladder.md) · [目标模式账本](docs/reports/2026-09-18-goal-ledger.md) |
| 温度 0.3<br><sub>T = 0.3</sub> | 温度 0<br><sub>T = 0</sub> | 同包两样本 60.8% / 34.0% → 64.5% / 58.6%<br><sub>two samples of one package</sub> | [ADR 0002](docs/adr/0002-model-policy.md) |

## 09-23 · 先写判据 · Criterion first

<img src=".github/tech/04-criteria.jpg" width="100%" alt="23 个独立样本 0 个满分；修复规则改为每丢 1 条至少多过 3 条">

| 之前 Before | 之后 After | 依据 Evidence | 出处 Source |
|---|---|---|---|
| 单样本迭代<br><sub>single-sample iteration</sub> | 每个机制先写死判据再上场<br><sub>criterion written before each run</sub> | 23 个独立样本 0 个满分；相邻版本差 5–8 分，在噪声内<br><sub>23 samples, 0 perfect; neighbours differ by 5–8</sub> | [09-23 评审](docs/reports/2026-09-23-harness-review.md) |
| 修复「只增不减」<br><sub>repair must never lose a test</sub> | 每丢 1 条至少多过 3 条<br><sub>3 gains for every loss</sub> | 修好路由：自检 9 → 28，因为丢了两条被连拒三次<br><sub>route fix 9 → 28, rejected 3 times for losing two</sub> | [初赛路线图 4.3](docs/reference/roadmap.md) |
| 截断或断流会交出空应用<br><sub>a cut stream could ship nothing</sub> | 永不交付空：任何路径都交付最好的完整版本<br><sub>never deliver empty</sub> | 截断与断流曾让整题零分<br><sub>truncation and dropped streams once zeroed a whole task</sub> | [初赛路线图 4.1](docs/reference/roadmap.md) |

## 09-24 · 开赛 · Day one

<img src=".github/tech/05-opening.jpg" width="100%" alt="开赛第一天 GitHub 5/100、Sheet 3/100，S 4.4；改为服务器共享后 Sheet 3 到 42">

| 之前 Before | 之后 After | 依据 Evidence | 出处 Source |
|---|---|---|---|
| 脚手架数据只活在单个浏览器会话<br><sub>state lived in one browser session</sub> | 服务器共享状态<br><sub>state shared on the server</sub> | GitHub 5/100、Sheet 3/100（S 4.4）；Sheet 3 → 42 | [`docs/progress.md`](docs/progress.md) 09-24 |

## 09-25 · 只读需求写测试 · Tests from requirements

<img src=".github/tech/06-testgen.jpg" width="100%" alt="场景自检 0/48、0/64；只读需求写测试后 Sheet 43 到 79">

| 之前 Before | 之后 After | 依据 Evidence | 出处 Source |
|---|---|---|---|
| 需求场景自检<br><sub>scenario self-check</sub> | 同一模型只看需求写 Playwright 测试，驱动修复<br><sub>same model writes tests from requirements alone</sub> | 场景自检可解析 Sheet 0/48、GitHub 0/64；Sheet 43 → 53 | [初赛路线图 4.2、4.11](docs/reference/roadmap.md) |
| 整份重发、12 次 / 5 元<br><sub>full resend, 12 calls / CNY 5</sub> | 定点编辑 SEARCH/REPLACE、3:1、24 次 / 10 元；守卫计作丢失<br><sub>patch edits, 3:1, 24 calls / CNY 10; guard counts as a loss</sub> | Sheet 53 → 79，S 55.27，首次总榜第一 | [初赛路线图 4.15](docs/reference/roadmap.md) |
| 双初稿择优<br><sub>two drafts, keep the better</sub> | 撤回 withdrawn | GitHub 16，判据 17 | [4.17](docs/reference/roadmap.md) |

## 09-26～10-01 · 平台期 · Plateau

<img src=".github/tech/07-plateau.jpg" width="100%" alt="平台期六个决定：读数对判据">

| 候选 Candidate | 读数 Reading | 判据 Criterion | 结论 Verdict | 出处 Source |
|---|---|---|---|---|
| 4.21 Sheet 批次<br><sub>batch 4.21</sub> | Sheet 69 | 78 | 撤回 withdrawn | [4.21](docs/reference/roadmap.md) |
| 4.23 换套测试再修<br><sub>re-test after repair stops</sub> | 82 · 56 · 78 | 均值 mean ≥ 77 | 关闭 closed | [4.23](docs/reference/roadmap.md) |
| 只起草、多抽样<br><sub>draft only, sample more</sub> | S 40.5 | 当时 then 57.4 | 撤回 withdrawn | [初赛路线图](docs/reference/roadmap.md) |
| 写测试共享缓存前缀<br><sub>shared prefix cache for tests</sub> | ¥22 → ¥17，S 56.17 | 同样的通过率 same pass rate | 采用 adopted | [4.24](docs/reference/roadmap.md) |
| 「401 墙」<br><sub>the "401 wall"</sub> | 是我们把 key 覆盖成了需求编号<br><sub>our own bug: key overwritten</sub> | — | 更正 corrected | [4.33](docs/reference/roadmap.md) |

## 10-02～10-03 · 冲刺 · Sprint

<img src=".github/tech/08-sprint.jpg" width="100%" alt="初赛得分曲线 4.4 到 104.96，10-02 的虚线是外部变化">

| 之前 Before | 之后 After | 依据 Evidence | 出处 Source |
|---|---|---|---|
| deepseek-v4-flash | vision-exp 模型；检查里加入源码审查<br><sub>vision-exp model; a source review joins the checks</sub> | S 62.33；GitHub 重跑 79.48 时主办方同期更新了需求（灰色虚线，不算机制收益）；v7 G79 + Sheet87，S 104.96 | [10-02 读数](docs/evidence/2026-10-02-s70-achieved.json) · [选版报告](docs/reports/2026-10-03-final-candidate-selection.md) |

## 10-06 · 在旧应用上进化 · Evolve the shipped app

<img src=".github/tech/09-upgrade.jpg" width="100%" alt="练习赛 8 题全部零分，只回写改动后 Web 6 题 38/38、Lite 2 题 10/12；升级时关掉源码审查">

| 之前 Before | 之后 After | 依据 Evidence | 出处 Source |
|---|---|---|---|
| 冻结整个输出目录<br><sub>freeze the whole output directory</sub> | 只回写内容变了的文件<br><sub>write back changed files only</sub> | 练习赛 8 题全部零分 → Web 6 题 38/38、Lite 2 题 10/12<br><sub>8 tasks at zero → Web 38/38, Lite 10/12</sub> | [决赛路线图 F1](docs/reference/finals-roadmap.md) |
| 源码审查<br><sub>source review</sub> | 升级时关掉<br><sub>off for upgrades</sub> | 13 次进化运行零产出；¥1.31–1.67 → 0.78/0.64 | [EXPERIMENTS.md](EXPERIMENTS.md) F3 |
| 定点编辑起草 · 测试编译器<br><sub>patch drafting · test compiler</sub> | 不采用 not adopted | 33/38；代理题 0/60 可编译<br><sub>33/38; 0 of 60 compilable</sub> | [决赛路线图 F1–F3](docs/reference/finals-roadmap.md) |

## 10-06 · 不调模型的守卫 · A guard without the model

<img src=".github/tech/10-guard.jpg" width="100%" alt="宽松守卫 38/38 对严格 36/38；首个正式读数 GitHub 3/30、Sheet 21/30">

| 之前 Before | 之后 After | 依据 Evidence | 出处 Source |
|---|---|---|---|
| — | 旧行为守卫（宽松，不调模型）<br><sub>regression guard, lenient, no LLM</sub> | 宽松 38/38 对严格 36/38；找回旧界面 45、24、161 项 | [守卫报告](docs/reports/2026-10-06-regression-guard.md) |
| 首个正式读数<br><sub>first official reading</sub> | GitHub 3/30 · Sheet 21/30 | GitHub 27 条失败：22 条卡在正文「Sign in」，5 条卡在页头「Search」 | [EXPERIMENTS.md](EXPERIMENTS.md) F2-real |

## 10-06 晚 · 需求写了位置，就照着放 · Stated placement

<img src=".github/tech/11-placement.jpg" width="100%" alt="位置与提示角色进方言卡、测试和守卫后，GitHub 3 到 21、Sheet 21 到 29，50/60">

| 之前 Before | 之后 After | 依据 Evidence | 出处 Source |
|---|---|---|---|
| 位置由模型自由发挥<br><sub>placement left to the model</sub> | 需求写明的位置与提示角色进方言卡、测试和守卫<br><sub>stated placement and roles into card, tests, guard</sub> | 3/30 + 21/30 → 21/30 + 29/30，50/60，S 98.82 | [F2-real、F3](docs/reference/finals-roadmap.md) |

## 10-07 · 泛化审查 · Generalization audit

<img src=".github/tech/12-audit.jpg" width="100%" alt="146 组规则：A 37、B 77 保留，C 26、D 6 删改；加回四条后 S 98.48 撤回，再加挪不复制 S 99.88">

| 类别 Class | 含义 Meaning | 数量 Count | 去留 Fate |
|---|---|---|---|
| A | 来自本次需求<br><sub>from the requirements</sub> | 37 | 保留 keep |
| B | 没有评测也有用<br><sub>useful on its own</sub> | 77 | 保留 keep |
| C | 迎合评测或定位器<br><sub>shaped for the evaluator</sub> | 26 | 删改 cut |
| D | 题目残留<br><sub>task-specific residue</sub> | 6 | 删改 cut |

| 版本 Version | 读数 Reading | 结论 Verdict |
|---|---|---|
| 纯清理<br><sub>pure cleanup</sub> | 本地 Sheet 23/25/20、GitHub 17/15 | 低于对照 below control |
| 加回四条（两条灰区）<br><sub>four rules back, two grey</sub> | 官方 S 98.48 < 保底 98.82 | 撤回 withdrawn |
| 再加「挪过去，不复制」<br><sub>plus "move it, don't copy it"</sub> | 49/60，S 99.88 | 保留 kept |

出处：[泛化审查](docs/reports/2026-10-07-generalization-audit.md) · [EXPERIMENTS.md](EXPERIMENTS.md) 10-07

## 10-08 · 第六版 · Version six

<img src=".github/tech/13-final.jpg" width="100%" alt="第五版 57/60 S 119.06，第六版 58/60 S 120.49，第七版 S 110.25 删除；第六版的重跑读数">

| 版本 Version | 决赛 Finals | S | 结论 Verdict |
|---|---|---|---|
| v5 | 57/60 | 119.06 | — |
| **v6** | **58/60** | **120.49** | **最终提交 final** |
| v7 | — | 110.25 | 删除 deleted |

| 第六版重跑 v6 reruns | 读数 Readings | 榜上 On the board |
|---|---|---|
| GitHub（6 次） | 25、28、28、26、25、27 | 28/30 |
| Sheet（7 次） | 25、27、29、30、30、30、27 | 30/30 |

榜上取同一提交里最好的一次，58/60 不是这个包的期望值。两题模型费用 ¥2.56，1.66M token，二十支队伍里第二。<sub>The board keeps the best run; 58/60 is not the package's expected score. Both tasks: CNY 2.56, 1.66M tokens, 2nd of 20.</sub> 出处：[README 成绩细节](README.md#成绩) · [决赛路线图 4.5 节](docs/reference/finals-roadmap.md)

## 最后留下的四步 · What was left

<img src=".github/tech/14-arch.jpg" width="100%" alt="一次起草、自写测试、有界修复、守卫交付，每一步标着它进入架构的日期">

| 步骤 Step | 进入架构 Arrived | 做什么 What it does |
|---|---|---|
| 一次起草<br><sub>one-call draft</sub> | 09-15 | 需求、方言卡、旧源码放进同一个请求，温度 0<br><sub>requirements, dialect card and old source in one request, T = 0</sub> |
| 自写测试<br><sub>tests from requirements</sub> | 09-25 | 同一模型看不到应用，只读需求写 Playwright 测试<br><sub>the model never sees the app</sub> |
| 有界修复<br><sub>bounded repair</sub> | 09-23 | 定点编辑，每丢 1 条至少多过 3 条，24 次调用或 10 元封顶<br><sub>SEARCH/REPLACE edits, 3:1 rule, capped at 24 calls or CNY 10</sub> |
| 守卫交付<br><sub>guarded delivery</sub> | 10-06 | 不调模型：重放旧行为、核对需求写明的位置，永不交付空<br><sub>no LLM: replay old behaviour, check stated placement, never ship empty</sub> |

## 完整决策表 · Full decision log

| 日期 Date | 决策 Decision | 依据 Evidence | 出处 Source |
|---|---|---|---|
| 09-15 | 放弃多轮工具循环和 TypeScript 内核重写，入口改成一次起草<br><sub>drop the tool loop and the TS kernel rewrite; one call</sub> | Keep 22/32 · ¥12.03 对 27/32、29/32 · ¥0.88–0.94 | [蒸馏报告](docs/reports/2026-09-18-distillation.md) |
| 09-15 | 关闭 Prime Agent 适配，不另起框架<br><sub>close the Prime Agent adaptation</sub> | 6/32、18/32、最好 22/32 | [初赛路线图第 8 节](docs/reference/roadmap.md) |
| 09-17～09-18 | GLM 出局<br><sub>GLM out</sub> | 输出额度全花在推理上、零正文；三次在 1201 秒被切<br><sub>all output tokens spent on reasoning; cut at 1201 s three times</sub> | [ADR 0002](docs/adr/0002-model-policy.md) |
| 09-18 | 知识下沉：能做门禁就不写进卡片，随包发骨架<br><sub>gates over prose; ship a scaffold</sub> | 骨架轮 65.2% / 58.7% 对上一轮 56.5% / 63.0% | [ADR 0001](docs/adr/0001-distillation-ladder.md) |
| 09-18 | 温度 0<br><sub>temperature 0</sub> | 64.5% / 58.6% 对 0.3 时 60.8% / 34.0% | [ADR 0002](docs/adr/0002-model-policy.md) |
| 09-18 → 09-25 | 双初稿择优：先否决、后试、按判据撤回<br><sub>two drafts: rejected, tried, withdrawn</sub> | GitHub 16，判据 17 | [4.17](docs/reference/roadmap.md) |
| 09-23 | 停掉单样本迭代，判据写死<br><sub>stop single-sample iteration</sub> | 23 个样本 0 个满分；相邻版本差 5–8 分 | [09-23 评审](docs/reports/2026-09-23-harness-review.md) |
| 09-23 | 修复接受规则改为 3:1<br><sub>repair acceptance becomes 3:1</sub> | 自检 9 → 28 仍被连拒三次 | [4.3](docs/reference/roadmap.md) |
| 09-23 | 默认 flash，Kimi 只做回退<br><sub>flash by default, Kimi as fallback</sub> | 三组配对分不出高下，Kimi 贵 4–7 倍<br><sub>three pairs indistinguishable; Kimi 4–7× the cost</sub> | [4.5](docs/reference/roadmap.md) |
| 09-24 → 09-25 | 改为按需求写测试驱动修复<br><sub>tests from requirements drive repair</sub> | Sheet 43、53，守卫计作丢失后 79，S 55.27 | [4.2、4.11、4.15](docs/reference/roadmap.md) |
| 09-26、09-27 | 4.21 撤回，4.23 关闭<br><sub>4.21 withdrawn, 4.23 closed</sub> | 69 对判据 78；82、56、78 均值低于 77 | [4.21、4.23](docs/reference/roadmap.md) |
| 09-27 | 写测试共享缓存前缀<br><sub>shared prefix cache</sub> | ¥22 → ¥17，S 56.17 | [4.24](docs/reference/roadmap.md) |
| 09-28 | 更正「401 墙」：是我们的 bug<br><sub>the "401 wall" was our bug</sub> | 正确 key 重放返回 200<br><sub>replay with the right key returns 200</sub> | [4.33](docs/reference/roadmap.md) |
| 09-28 | 撤回「只起草、多抽样」<br><sub>withdraw draft-only sampling</sub> | 24 个组合最高 S 40.5，不及 57.4 | [初赛路线图](docs/reference/roadmap.md) |
| 10-02 | 改用 vision-exp 模型<br><sub>switch to vision-exp</sub> | S 62.33；79.48 那一跳混入了需求更新 | [10-02 读数](docs/evidence/2026-10-02-s70-achieved.json) |
| 10-03 | 分数优先：正式成绩保留 v7，v12 撤回<br><sub>keep v7 as the score; withdraw v12</sub> | v7 G79 + Sheet87，S 104.96 | [选版报告](docs/reports/2026-10-03-final-candidate-selection.md) |
| 10-06 | 宽松守卫默认开；严格守卫、定点编辑起草、编译器不用；升级跳过源码审查<br><sub>lenient guard on; strict guard, patch draft, compiler off; skip review on upgrades</sub> | 38/38 对 36/38；33/38；0/60 | [决赛路线图 F1–F3](docs/reference/finals-roadmap.md) |
| 10-06 晚 | 需求写明的位置进方言卡、测试和守卫<br><sub>stated placement enters card, tests and guard</sub> | 3/30 + 21/30 → 21/30 + 29/30 | [F2-real、F3](docs/reference/finals-roadmap.md) |
| 10-07 | 删改评测耦合规则，加回四条（两条灰区），位置改为挪不复制<br><sub>cut coupled rules, add four back, move don't copy</sub> | 146 组：A 37、B 77、C 26、D 6；加回版 S 98.48 撤回；挪不复制后 S 99.88 | [泛化审查](docs/reports/2026-10-07-generalization-audit.md) |
| 10-08 | 第六版定为最终包<br><sub>version six is final</sub> | v5 57/60 · S 119.06；v6 58/60 · S 120.49；v7 S 110.25 删除 | [决赛路线图 4.5 节](docs/reference/finals-roadmap.md) |

每一次实验的假设、判据、读数和去留在 [`EXPERIMENTS.md`](EXPERIMENTS.md)，共 116 条，其中 42 条按读数砍掉。<sub>All 116 experiments with hypothesis, criterion, reading and fate; 42 were cut.</sub>
