# Fable consultation and evidence review

Date: 2026-09-12. User explicitly requested current Fable advice. This is separate
from the deprecated `fable-playbook` skill, which was not used for this work.

The suggested [fable-orchestrator](https://github.com/codejunkie99/fable-orchestrator/tree/e6345e56d3a6fc7456cda0dd352a6f6c993b1125)
uses the local Claude CLI. We adapted that tool-free consultation approach rather
than installing its router or implementation-worker policy. Calls explicitly selected
`claude-fable-5-1[1m]`, disabled tools/customization auto-loading and session persistence,
and supplied only a concise evidence packet. Fable did not inspect source or run tests.

Two bounded advisory turns completed: the first review, then one factual correction.
The CLI reported 48.446 and 29.846 seconds, with an aggregate estimated cost of
USD 0.278537. These are CLI usage estimates, not an invoice or competition-gateway
charge. CLI metadata also contains auxiliary Haiku usage; the named advisory model
is Fable 5.1. No implementation agent was dispatched and no official run was started.

## Our assessment

Adopt the reminder to classify failures before investing further in verification
architecture. Preserve the small executor, deterministic independent checks and
explicitly bounded optional diagnosis. Do not equate a repository merge with turning
on all experimental stages.

Fable's initial advice misread two facts, which the second packet corrected:

- The same agent ZIP generated different E047/E048 applications. Repeating generation
  does not isolate runtime variance of a fixed application.
- E049 rendered one username twice in the DOM. It was not a test-account collision.

Further limits remain in the second answer:

- E047's local record is forty **test executions** across four ten-test suites, not
  forty independent complete application trials.
- A delayed replay reproducing one navigation defect does not establish that timing
  is the main cause of all official failures. Match the failed step, observable state
  and error signature before attributing a specific failure.
- New unique test IDs would not repair an evaluator that locates text/roles; assertions
  must follow the actual requirement and public interaction contract.
- An official pass is not proof that a probe finding is false. Judge proposed findings
  against original requirements and controlled product corrections; keep unresolved
  cases explicit.
- A 36-replay grid or a full workday is not the next gate. Start with one concrete
  fixed-artifact positive/negative comparison and expand only if it leaves a decision
  unresolved. Historical logs cannot prove that a newly fixed recovery path executed;
  that remains separately tested with synthetic responses until a real run occurs.

## Proposed next slice

Use E047's unchanged output and a disposable copy containing only the previously
isolated sign-out-label correction. Preserve the public tests, runtime/browser version,
test order and initial state. Reuse the known delayed-logout probe (zero versus the
previously observed 400 ms response delay) only where needed to distinguish them.
The gate is whether the same external check rejects the known failure, accepts the
specific correction, and still rejects weakening only self-tests. If the failure cannot
be reproduced, report an unresolved environment/interaction difference instead of
inventing a new product rule or adding model calls.

E048/E049 are available deterministic controls for combined/duplicate username text.
Bring them in only to test a distinct uncovered behavior. A model-browser probe earns
further work only by adding a confirmed defect beyond this calibrated evidence with
measured additional time/tokens. No universal layout rule is inferred from these cases.

The main baseline stays at the merged dev31. This note is the first scoped work on
`feat/lean-acceptance-harness`, and is a proposal, not a completed replay experiment.

## Fable first response (verbatim; factual errors identified above)

## 你当前判断最可能错在哪里

你把官方分数掉落（自测 7/7 → 官方 5/10，同包 6/10 → 4/10）主要归因为"执行者自行宣布验收"，于是把重心放在验收架构。但事实 1 更像方差与环境失配问题：同一包重跑差 2 分、官方超时/导航中断本地不复现、失败原因是"重复精确用户名"这种数据初始化细节。任何验收者（确定性套件或模型探针）都无法修复"本地过、官方随机挂"的差距；它只能修复"本地也应该挂但没挂"的那一类。你尚未量化这两类各占多少，就已经建了三条验收分支和一个浏览器探针，这才是最可能偏离打榜目标的地方。第二个风险：dev29 的截断修复未经任何官方验证，dev31 又叠了新变更，官方信号会被混淆。

## 1. 边界是否足够

方向对（单执行者 + 外部确定性优先 + 有预算探针 + 不加经理），但还需两条硬边界：
- 探针在证明"能抓到确定性套件抓不到的官方失败"之前，不得进入生产路径，哪怕默认关闭；否则它会继续吸时间。
- 每次官方运行只允许一个变量变化。dev31 若同时含截断修复 + 验收接入，结果不可归因。

继续偏离的投入：Docker 隔离（对分数无直接贡献）、Pi 适配（协议通了但不能证明质量）、浏览器计划探针语义验证、单链接规则的通用化争论。这些都该冻结在 harness_lab。

## 2. 正确验收套件未知怎么办

不要追求"完整正确的测试"，改为**需求契约**：每条需求文本抽一条可观察断言（页面存在、动作后状态变化、数据唯一性约束等），只断言需求明说的，不外推。这是不变量集合，不是正确性证明，但它的来源是需求而非实现，模型无法改弱。防无限自测的规则：契约只在生成前固定一次，修复循环最多 N 轮（建议 2），超过即以当前最好候选提交并记录未满足项。套件的增长唯一来源是官方失败：每次官方扣分反推一条契约（如"用户名生成含随机后缀且不重复"），这就是你在事实 1 里已有的信号。

## 3. 最有价值的下一实验

**先量方差，再测验收。** 用现成产物、不新生成：
- 取已知官方通过/失败的 Ticket 产物，跑需求契约套件，统计能否区分（召回官方失败的比例）。若召回 < 一半，说明主要失分不在本地可检性，验收投入应降级。
- 用 dev31 单变量（只含截断修复）官方跑 Ticket 同一包 3 次。判据：三次分差 ≥ 2 分 → 优先做确定性（固定 seed、初始化数据唯一性、启动等待/重试），暂停验收项；分差 ≤ 1 且均值不高于 dev29 → 截断修复无效，回滚。
- 只有当契约套件在已知产物上召回率高，且方差收敛后，才给探针一次对照：同产物上探针额外抓到的官方失败数 > 0 才继续。

## 4. 具体借哪一小段

- Octos verifier：只借"失败/重复时触发、仅看最近几条结构化记录、≤512 tokens、独立记账、输出进展/卡住/可结束"——当作卡住检测器，不当 GUI 验收。这正好对应你"仅重复失败启用一次探针"的位置，比看需求+页面的 8 场景计划便宜得多。
- mini-SWE-agent：连续格式错误上限与费用/时间硬停，补到你现有三次截断停止旁边。
- Harbor：把官方超时/导航中断作为独立结果类别记录，与断言失败分开统计，这样才能算出上面那个方差判据。
- arc-adapter 的 UI 规则含单链接规则：降为警告级 lint，不做硬约束，除非需求文本明确要求唯一入口。
- Pi：截断工具不执行你已做，其余不借。

一句话：先证明失分来自哪一类，再决定验收花多少；当前最省的动作是单变量官方重跑三次。

## Fable response after the correction (verbatim)

## 纠正后的判断

撤回三点：官方三次重跑（无预算且混入生成方差，不可归因）；“随机用户名”契约（E049 是同一用户名双处渲染撞上 `exact:true`，属应用/测试耦合，不是数据冲突）；“均值未升即截断修复无效”（截断修复的因变量是工具切换/恢复，不是分数）。

你的回放矩阵方向对，但 5-8 个样本乘四类分桶仍偏大。事实 3 已经给出一个更小、更能改变决策的切口：**同一 E047 产物本地 40 次全过、官方却 timeout/navigation 失败，且受控延迟已复现"退出登录标签被登录 regex 提前匹配"**。这说明至少一条官方失败是**延迟敏感的应用/测试耦合**，本地零延迟回放永远看不见。

## 更小的下一实验：先给回放加延迟，再决定矩阵

**对象**：仅 E047、E048、E049 三个已有产物，原样公开测试，现有回放工具，不重新生成。

**变量**：唯一变量是注入延迟（网络/渲染延迟 0、200、500、1000ms 各回放 3 次），其余固定。

**记录**：每条测试按四类标签落地——断言失败（确定性缺陷）、超时/导航中断（时序）、环境异常（启动/端口/进程）、生成失败。这一步等于把你的矩阵分类器先在 3 个样本上跑通。

**判据**：
- 若延迟 ≥ 某阈值即稳定复现官方那几条 timeout/navigation 失败 → 失分主因是时序耦合。决策：在生成侧加“唯一文本/唯一 test-id、登录态切换后等待稳定”类需求契约与延迟回放门禁，验收探针项继续冻结。
- 若加延迟仍全过 → 本地无法复现官方失败，扩到 5-8 样本矩阵没有意义；决策转为向官方环境侧要信息（日志、浏览器版本、并发数），不再投本地验收。
- 若延迟下失败但类别与官方不同（如本地变成断言失败）→ 分类器需修正后再做矩阵。

**探针**：只在上述回放中已被标为“时序”或“确定性”的失败上离线检验：增量检出 = 探针标出而套件未标的官方真失败数；误报 = 探针标出而官方通过的数。任一实验前不接入路径。

## 停止条件

- 三产物×四档延迟×3 次 = 36 次回放，或一个工作日，取先到者。
- 出现明确判据结论即停，不追第五档延迟。
- 截断修复单独验收：找已有截断日志，看是否发生工具切换并恢复，是/否即结论，不看分数。
- 本轮不申请官方预算；架构审查结论只写“下一次官方运行唯一变量是什么”。

一句话：**先用三个既有产物验证“延迟能否复现官方失败”，这一个是/否比 5-8 样本矩阵更早决定验收投入该增还是该砍。**
