# Fable optimization dialogue — 2026-09-12

The user requested a fresh, substantive discussion with Fable about three-board
correctness, first place, efficiency and transfer. Two tool-free Claude CLI calls selected
`claude-fable-5-1[1m]`, disabled tools/customization loading and session persistence,
and each used a USD 1 CLI budget. The named advisory model in both responses is Fable
5.1. Fable received curated evidence, not workspace access. These are advisory answers,
not independent source inspections or experimental results.

The first packet included current board rows, dev35/E057 evidence, previous failed
experiments and Codex's proposed ordered objective. Codex then obtained the exact
official failing line and completed a fixed-artifact replay before challenging Fable.
The second packet included the first answer, corrected cost/variance interpretations,
per-response usage, the exact failure stage and the difference between current source
and historical leaderboard candidates. The reviewed outcome is in
[the optimization model](competition-optimization-2026-09-12.md).

## Decisions after checking the advice

Adopt separate leaderboard and fresh-generation views, a complete-board unit of measurement,
bounded experiments, and a short measured input/output reduction list. Keep the weakest
relative efficiency as a dashboard metric rather than an automatic allocation algorithm.

Fable withdrew its slow-password-hash explanation, missing-nine-tenths-of-calls claim,
unknown-leader-model statement, local-success lower-bound interpretation and compound
single-variable experiment proposal after Codex supplied contrary evidence.

Do not adopt these remaining statements as facts or project rules:

- The official error identifies the final timed-out call, not how much time each preceding
  step took. Nine short tests do not rule out selective browser scheduling stalls.
- E057's inspected meter handler updates attributes and sibling styles. Fable's proposed
  delayed meter replacement is not present in the code and was not reproduced.
- Official reported CNY remains the ranking observable even when causal attribution is
  unresolved. Do not require a new shared key or an entire billing project before all
  further work. Current small-board winner costs reconcile to their actual call usages;
  one older counter and Ticket have separate discrepancies.
- Generated corrections can belong in a generic runtime when a runtime defect is proven;
  fixing prompts is not the only legitimate implementation path. Manually patched answer
  applications remain diagnostic controls and are not uploaded.
- Using the old 90% Ticket cost as an absolute ceiling could block the user's stronger
  100% target. Set bounded experimental guards and compare the full-pass efficiency frontier.
- Three successful generations cannot guarantee reliability or eliminate selection bias.
  Specify trials before their outcomes and retain failures. Local and official observations
  remain distinct.
- The historical winning Smoke/Evolution traces do not establish the exact performance of
  current main. The user subsequently asked to run unchanged dev35 on both small boards.
- The user's latest instruction pauses Ticket investigation; do not continue the proposed
  Ticket environment grid merely because Fable suggested it.

Full tool-visible advisory answers follow, including statements corrected above.

## Consultation receipt

Round 1: `ae71b638-714c-493e-9b75-6b69d5bfcdcf`, 150.558 seconds, CLI estimate USD 0.637564.

Round 2: `df40976c-09d9-4361-9f08-3ceb52d3ddaa`, 122.173 seconds, CLI estimate USD 0.464534.

Combined estimate: USD 1.102098, including auxiliary Haiku usage; not an invoice or official competition charge.

## Round 1 — before the factual challenge

我先按你给的证据做一次纯推理审查，不做任何工具动作，也不引用旧 playbook。

**1. 最严重缺陷**

- **Ticket 的可靠性没有估计值。** 事实：所有官方 Ticket 运行里全通过次数为零，90% 是一次样本，此前是 70%，两次失败集合不同。推断：同一产品家族在官方环境上失败集合漂移，更像时间敏感型抖动，不像单一语义遗漏。E054 本地固定回放只丢标题，官方多丢两个登录用例，这点已经是证据。未知：官方运行器的 CPU、并发、冷启动。一个具体可查的假设是生成代码里的慢操作，例如高轮数密码哈希或同步文件写入，在本地 Mac 上几百毫秒，在受限容器里可能撞 10 秒线。注册和登录都要走哈希，与失败模式吻合，但这只是假设。
- **成本计量不可信。** 事实：官方 555,255 token，捕获 50,957。按官方 CNY 反推，混合单价约每百万 1.2 元，与 Flash 加 Kimi 的档位相符。若捕获数是真实总量，单价要到每百万 13 元，不合理。推断：捕获遗漏了约九成调用，很可能是循环内的工具往返或图像 token 未被记录。后果：在计量修好前，任何 Smoke 或 Evolution 的减费实验都无法在本地量化，只能靠官方试跑盲测。
- **min 比值目标会把全部资源推向 Smoke。** 事实：Smoke 我们是榜首效率的 0.19 倍，Evolution 0.26 倍，Ticket 已是对手的 4 倍。你的 min_b 定义会让 Smoke 永远是瓶颈，恰好和你担心的"为常数预算小榜无限优化"相矛盾。
- **榜首 2 秒可能已接近物理下限。** 推断：2 秒延迟只够一次小模型短调用，对手可能没有图像观察、没有自检生成。未知：对手行的 token 数和模型。若其成本已是单次真实生成的地板，2 倍就是在要求不做真实生成，这与用户禁止空调用刷计量直接冲突。
- **最终聚合规则未核，却已累积多行。** 若聚合取最新行而非最优行，一次更贵的 100% 尝试会把我们自己从 134 拉到 70 左右。余额 401 也意味着任何付费试跑可能中途断掉并留下坏行。

**2. 目标函数修正**

- p_full 只能按官方整跑计数，目前样本为零次成功，任何点估计都无意义。把本地固定产品在受限资源下的 N 次回放通过率作为 p_full 的下界代理，官方只做确认。按用例统计失败频率仅用于定位，不进 p_full。
- 榜面行是 best-of-N，已被选择偏差抬高，对手同样如此。"断层"必须定义在冻结版本的新生成分布上：至少 3 次新生成的效率中位数，而不是最好一次。同时单独记录榜面行，两者不混。
- 三榜聚合改为字典序加门槛，不用 min 比值：先三榜 100%，再每榜达到各自门槛，门槛由地板可行性决定，见第 4 节。每榜设官方试跑次数上限，达到即停，不管是否到 2 倍。
- 研发成本分三本账：官方 CNY、咨询 USD、人和 agent 小时，另加"官方行数"作为独立资源，因为行不可删且聚合规则未知。
- 效率公式不含时延，所以在 agent 内执行公开 spec 是零 CNY 的验收手段，而让模型生成自检要花 token。这是你第三条的量化依据：用执行公开 spec 替代大部分自检生成，既省费又修掉 E051 那类自我放水，但它抓不到官方环境下的超时。

**3. 最小实验序列**

1. 免费，Ticket 复现。变量：E057 冻结产物在 CPU 限 1 核、内存受限、服务刚启动即测、4 worker、10 秒超时下回放 10 次。控制：同产品不限资源。观察：注册或登录超时是否出现。停止：出现一次即定位慢路径；十次不出现则改读代码找哈希轮数与同步 IO，并把官方环境差异列为待核未知。
2. 免费，计量对账。逐条枚举事件日志里的模型调用，与供应商后台该时段用量比对。观察：缺口来自少数大调用还是大量小调用，决定后续减费是砍上下文还是砍调用数。停止：差距进入 10% 内，或确认结构性缺口来源。
3. 免费，聚合与余额。核实榜单聚合取最优还是最新，恢复登录看余额。这是第 4、5 项的前置门。
4. 官方，Ticket 100%。把第 1 项发现转化为对模型的生成侧要求，不手工修产物，跑 1 次。观察：10/10 且成本低于 1.50。停止：通过则冻结并追加 2 次新生成看方差；不通过回到第 1 项。
5. 官方，Smoke 与 Evolution 减费。变量：去图像观察、单次调用、在 agent 内执行公开 spec 替代自检生成。控制：dev35 原样。各跑 1 次。观察：成本与 100%。停止：破 100% 就逐项回退。

**4. 对 2 倍门槛与题集迁移的批评**

- 2 倍是工作建议而非用户要求，你已说明。但它在三榜上性质完全不同。Ticket 上 2 倍允许 1.50 元，我们 90% 只花 0.67，约束根本不是成本而是 p_full。Smoke 上先算地板：最小真实生成 token 数乘以最便宜合规模型单价。若地板高于 0.00155，2 倍不可行，应改为"不低于榜首且有其方差余量"，并公开记录为何放弃。
- 题集里 10 个 mobile 无 spec，dev34 的公开 spec 输入路径完全不适用，agent 内执行 spec 的验收路径也不适用。建议在三榜期间只做一小时零费用可执行性分类，判断运行时是否要重做，因为这是排期级信息，但不动手迁移。保留一整个 web 任务作未见，赞同。

**5. 应明确拒绝的建议**

- 拒绝用 min 比值做三榜目标。
- 拒绝把捕获的 50,957 作为任何成本结论的依据。
- 拒绝在计量对账前做减费实验的本地量化结论。
- 拒绝在聚合规则和余额核实前提交任何成本高于现行的 Ticket 100% 尝试。
- 拒绝把 E057 涨分归因于公开 spec 输入或修复分支。
- 拒绝为 Smoke 追求 2 倍而引入预存答案、空调用或跳过真实生成。
- 拒绝重建验证架构或加第二模型，dev32 已证明代价。
- 拒绝把按用例通过率当独立试验来算 p_full。
- 拒绝先改完 20 题再谈泛化。

## Round 2 — after the factual challenge

先按你的新证据逐条修正上一轮，再给联合建议。

**接受的纠正**

- **B 推翻我的慢哈希假设。** 失败点在填入弱密码后、强密码更新之前，注册尚未提交，哈希与持久化路径根本没跑到。其余九条用例耗时都在一秒内，说明官方环境并非整体资源饥饿，卡住的是一个特定步骤。这反而收窄了假设：Playwright 的定位器 evaluate 会先等元素重新解析，若强度元素在可见断言通过后被移除、替换节点或选择器失配，evaluate 就会等到超时。弱密码触发防抖后隐藏或重绘强度条，是最符合"本地快则过、官方慢则挂"的机制。这是可离线核查的假设，不是结论。
- **C 撤回"漏记九成"。** 官方数字来自共享账号的基线差分，不能归属到单次运行；捕获数是逐条响应。两者都不是 E057 的可归属成本，我不再用任一做推论。真正有用的新信息是 Flash 输出七成以上是推理 token，这才是最大的可压缩项。
- **D 撤回"不知榜首模型"。** 榜首两行都是 deepseek-v4-flash，取整 token 不能证明物理地板，我不再说两倍必然要求作弊。先测我们 Smoke 的实际请求与回复字节和真实 usage，算出可压缩空间再谈可行性。
- **反驳 1 接受。** 本地固定回放率不是 p_full 下界，分开记 p_eval(A, e_local) 与 p_full(θ, e_official)，记录 k/n 与不确定性，不拟合概率，不在现阶段追求统计意义上的可靠性下界。
- **反驳 2 接受。** min 比值只作三榜短板仪表，不作停止或选题依据。硬门为全部官方 100% 且各榜第一，版本冻结后的预先声明验证集另做重复性门。两倍是 stretch。
- **反驳 3 接受。** 我把三项改动捆在一起却称单变量，错误。Smoke 和 Evolution 已经是单次短调用无图像，不存在这项"改进"。必须先读两个赢榜 run 的 trace 和当前 main 的选择路径，压实际存在的冗余，不预设 dev35 原样就是旧榜面源码。
- **反驳 4 接受。** agent 内执行公开 spec 只是零 CNY 于执行本身，若结果回流触发付费修复调用就不是零成本。小题测自检输出占比，大题测延迟，分开量。
- **反驳 5 接受。** 下一步是定位而不是盲压测，不改哈希代价、不延超时、不碰 meter 控件。

**保留的分歧**

- **Ticket 的可靠性主张。** 即使第 67 行修好，也只消掉一个已知失败模式。E054 在官方环境丢的是别的用例，同一产品家族的失败集合仍在漂移。修完后不能宣称可靠，只能说 k/n 又多一次观测。
- **计量的处理方式。** 我不主张继续对账历史，两套记录各自封存即可。但下一次付费运行前必须有可归属手段，例如专用 key 或 gateway 标签，否则减费实验仍无法量化。这是付费实验的前置门，不是可选项。
- **修复方式。** 定位后的改动只能表达为对模型的生成侧要求，不手工修产物，不做 spec 特化补丁。

**优化函数**

对冻结版本 θ 和每个榜 b：先过硬门，即官方 100% 且第一；再看预先声明验证集上 n 次新生成的通过数 k/n 与费用中位数。晋级比较用中位数，不用最小值，榜面 best 行只作成绩证据单独记录。这样一次幸运运行永远不能让候选晋级，也不会激励刷最好一次。

**第一轮实验与判据**

1. **免费，Ticket 定位。** 先读 report 里第 67 行的错误原文，区分"等待定位器"还是"执行上下文销毁"。再读 E057 HTML 里强度条在弱密码下的 DOM 生命周期。然后用固定产物开 trace 回放，浏览器换成 Playwright 自带 Chromium headless，并用 CDP 限速 CPU 复现。停止：复现一次即转成生成侧要求；三种环境变体都不复现则记为官方环境专属未知，转为下次官方运行前的可观测性要求。
2. **免费，读赢榜 trace 与 main 路径。** 输出一张可删支出清单，按推理 token、自检输出、提示词长度排序。停止：清单完成，只取最大一项。
3. **免费，前置门。** 可归属计量手段、聚合规则、余额，三项齐后才允许付费。
4. **付费一次，Smoke 单变量。** 只去掉第 2 项的最大一项，对照为当前 main。晋级：官方 100% 且费用不高于现行，再补两次新生成的本地验收记 k/n，无失败。任一失败即回退该变量，当天不再调参。

**成本账与两倍**

三本账加官方行数，按运行逐条记，不再回溯。两倍先用第 2 项算 Smoke 的可压缩空间，若压完后地板仍高于两倍榜首，把地板与证据交给你决定，不为达标引入空调用或预存答案。

**20 题迁移**

三榜期间只做一小时零费用可执行性分类，判断 mobile 无 spec 题是否需要运行时重做，作为排期信息，不动手迁移，保留一整个 web 任务未见。

**Ticket 怎么走**

不全停。第 1 项无计费定位与第 2、4 项 Smoke 切片并行，两者互不占用官方运行。Ticket 的付费运行只在两个条件同时满足时进行：第 1 项给出生成侧假设或可观测性方案，第 3 项三门已过。费用上限为现行 90% 行的成本，不为碰运气多跑。

小结：撤回慢哈希、漏记九成、榜首模型未知三个判断，接受五条反驳。保留三点：修好第 67 行不等于可靠，付费前必须有可归属计量，只做生成侧改动。下一步是免费定位加 Smoke 支出清单，付费只在前置门齐后做一次单变量。
