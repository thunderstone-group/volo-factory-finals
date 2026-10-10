# 论文调研笔记：ARC-Bench Hackathon（GitHub / Sheet 隐藏通过率）

调研日期 2026-09-27。只读调研，未运行任何 arcbench 命令、未调用任何 LLM 网关。
所有原文 PDF/文本都在本目录（`arc.txt`、`arc_v1.txt`、`wtp.txt`、`intentiontest.txt`、`testgen.txt`，子目录 `sub_*/` 是三个并行调研员的原始笔记）。
**先看结论：§5 隐藏测试线索（事实/推断分开）、§6 排序后的可做技巧、§7 不适用清单，在文件末尾。**
标注约定：**[事实]** = 原文或主办方公开代码里写明的；**[推断]** = 我的推测。数字都注明表号或文件位置。

---

# 1. 主办方实验室（SJTU CoPhi，Yun Lin 组）自己的工作

### 1.1 ARC：Compiling Large Multi-Modal Requirement Documents into Runnable Software Systems（ISSTA 2026）

- 链接：https://arxiv.org/abs/2602.13723 （读的是 v6，2026-08-09；也对照了 v1，2026-02-14）
- 作者：Weiyu Kong, Yun Lin, Xiwen Teoh, Duc-Minh Nguyen, Ruofei Ren, Jiaxin Chang, Haoxu Hu, Haoyu Chen。Xiwen Teoh / Duc-Minh Nguyen / Ruofei Ren 同时是 WebTestPilot 的作者。
- 配套：项目站点（匿名 GitHub Pages，含全部 agent 提示词）https://anonymous-8h5ynlrxqovd.github.io/anonymous-repo-TsxwHr3NGLQNR3r4/ （由 https://sites.google.com/view/agentic-req-compilation/home 嵌入）；基准仓库 https://github.com/code-philia/arc-bench （code-philia/ARC 已重定向到这里）；编译器 https://github.com/code-philia/agentic-requirement-compiler 。

**方法要点 [事实]**
- 需求 DSL：Requirement Node（id/name/多模态 description/dependencies/children）→ Scenario（prerequisites）→ Step（Given/When/Then）。§2.1、Fig.1，BNF 在站点 `home.js`。
- 两阶段：自顶向下为每个节点先设计 UI/API/DB 接口并**立刻生成测试**（GUI E2E、API、integration、unit），再自底向上实现，每个模块立刻跑自己的测试，失败就把编译错误/断言失败喂回去重生成，直到通过或耗尽预算 b（Alg.1–3，§4）。预算耗尽保留最后一版。
- 测试生成规则（§4.2.2）：Given → fixture/前置（可复用祖先测试）；When → 动作；Then → 具体断言。E2E 测 UI↔API，integration 测 API↔API/API↔DB，unit 测单个接口。
- 图片：用 VLM 做 image captioning，把截图转成布局描述（§4.2.1）。站点上的 `ui_gen_prompt` 要求 "FULL OCR TRANSCRIPTION: transcribe ALL visible text exactly"、按 DOM 树描述、给 px/hex。
- ARC 主提示词（站点 `prompts.js`）E2E 部分原文："visit frontend server, simulate user clicks/inputs, and verify whether the UI changes, API responses, and database state match"；每次 `run_test` 都重置数据库并在 beforeAll 插种子数据；"Playwright is Law: Acceptance Scenarios must be translated into executable Playwright code"。

**评测怎么做的（最关键）[事实]**
- 6 个系统（BookStack 32 req/30 test、Keep 35/45、Stack Overflow 66/60、PrestaShop 86/75、12306 142/80、Ctrip 152/80，Table 1）。
- v6 §5.1.1："The annotators were instructed to create **one GUI test case for each leaf-node scenario**… Each test case was **manually constructed, independent of using ARC, according to the actual function of real-world web system**." 即隐藏测试按**真实产品的实际行为**手写，而不是按需求文字。
- 需求文档由研究生花两周探索真实系统后写成，两人复审（§5.1.1，约 1200 人时）。
- 通过定义：所有步骤执行成功且所有断言满足才算过（§5.3）。
- 模型：Gemini 3 Pro，temperature 1.0，thinking high；模板 React + Node + SQLite3 + Vitest + Playwright（§5.4）。

**结果 [事实]**
- Table 2（GUI 测试通过率，3 次均值）：ARC 91.1/91.9/86.7/85.8/78.8/75.4；最佳基线（MetaGPT/Cursor/Copilot）比 ARC 低 14.4–39.2 个点。系统越大通过率越低。
- Table 5（开销）：ARC 每个系统 146–363 分钟、11.8–27.0M token；基线 0.4–16M token。token 分布：代码生成 62%（含反馈迭代）、测试生成 36%、设计 2%（§5.6.2）。
- Table 6（消融，Pass%）：
  - w.o. DFS：63.33/75.56/35.00/53.33/36.25/33.75，比完整版低 16–52 个点。**注意**：这个变体不是「一次成型」，而是按需求列表**线性顺序逐节点完整 TDD**（站点 `ablation_dfs_prompt`："Linear Order… complete the entire lifecycle (Design, Test, and Implementation) for one node before moving to the next"）。所以 16–52 个点衡量的是「先自顶向下定全局接口契约、再自底向上实现（子节点先实现）」相对「线性逐个做」的收益，不是增量 vs 一次成型。
  - w.o. Test：60.00/60.00/56.67/38.67/67.5/48.75，比完整版低 11–47 个点。
  - w.o. Traceability：90.00/86.67/83.33/74.67/77.5/71.25，只低 1–11 个点，但更耗时耗 token。
- Table 7（AppForge）：需求「补全中间场景和细粒度约束」后，test case pass 从 41.8% 升到 68.0%。用户研究也说写得更精确的组通过率更高（§5.8）。

**失败分析 [事实]**（§5.5 + 站点 `examples.js`）
1. 文档漏了隐含需求：12306 文档没写「乘客证件号不能重复」，隐藏测试却测了，生成代码撞 SQL 唯一约束报 500。
2. 测试反馈信息太少：PrestaShop「最近浏览」只报 "viewed product A is not shown"，模型不知道该修哪层。站点给的该测试原文用了 `page.waitForResponse(resp => resp.url().includes('/api/recently-viewed'))`、`page.locator('.recently-viewed')`、`getByRole('heading', {name: 'Product A'})`——这是论文时期的写法；现在公开基准已禁止这些（见 1.2）。

**对我们的含义**
- [事实] 主办方的「真值」测试来自真实产品的真实行为 + 需求文字；[推断] GitHub 题的隐藏测试很可能也带有真实 GitHub 的约定行为（重复名校验、空列表文案、计数变化等），需求没写的隐含约束是失分大头。
- [事实] ARC 的收益来自「每个功能有自己的测试门」与「先定全局契约再实现」；[推断] 对一次成型流水线，最接近的低成本对应物是：先让模型产出全局契约（导航入口、每页控件的可访问名、种子数据、API 形状），再按契约生成代码与测试。

### 1.2 ARC-Bench 公开仓库与 ARC 编译器开源代码（论文的数据可用性产物）

**公开基准的测试契约 [事实]**（`arc-bench/README.md` 与 `scripts/audit-benchmark-tests.js`）
- 测试固定 1 个 worker 顺序执行；测试不调用任何私有 reset/seed API；**应用必须在启动时自己初始化需求包里写明的账号和领域数据**。
- 审计脚本禁止 spec 里出现：`page.goto(`（只允许 helpers.ts 里恰好一处 `page.goto('/')`）、`request.` 或 `/api/`、`localStorage/sessionStorage`、`.evaluate(`/`.route(`、`toHaveURL(`/`page.url()`、`.locator('.` / `'#` / `'[data-`。也就是说：**每条测试从首页 `/` 进入，靠点可见控件走到目标页；不看 URL，不用 class/id/data-testid**。
- playwright.config.ts：默认 expect 超时 10 s、测试超时 60 s、Desktop Chrome、baseURL = TARGET_URL。
- 公开测试风格（stackoverflow/bookstack helpers.ts）：候选定位器阶梯 `getByRole(button|link|menuitem|tab|checkbox|radio|option|heading, {name: 正则})` → `getByLabel` → `getByPlaceholder` → `getByText`，取第一个可见的；名字多为不区分大小写正则，偶有 `updated|saved|success` 这样的宽松备选；**每个场景用专属种子账号/记录**（如 `question_deleter@example.com`、`SO Deletable Question`、lite 版 `// fixtures: shelf_4_3_1`），因为实例从不重置。
- 我做的小统计（本目录 python 片段，对 6 个公开 app 的 helpers+spec）：正则定位器里的词有 85–100% 出现在 requirements.yaml 原文里（keep 100%、bookstack 98%、stackoverflow 99%、prestashop 96%、12306 88%、ctrip 85%）；字符串字面量里不在需求原文的，几乎都是测试标题和测试自己输入的数据，少量是真实产品文案（PrestaShop 的 `place order`、`write your review`、`you might also like`、`shop now`）。
- arc-bench-lite（2026-09 新加）的需求格式：`type: FOLDER/ATOMIC`，步骤 `keyword/content`，description 里写死可访问名（"role `form` named `Create shelf form`"、"exact placeholder `tag1, tag2`"）和 "Seed data: shelf "Shelf 4.3.1""。这和 hackathon 的 YAML 是同一族格式。

**编译器（主办方参考 agent）的测试生成提示词 [事实]**（`src/agents/context/prompts/test_generator.py`、`src/skills/*/SKILL.md`）
- 每个场景必须编成 E2E："GIVEN becomes setup, WHEN becomes action, THEN becomes assertion. Do not skip or invert any step."
- "If the requirement does not mention an exact label, route, role, seed record, or message, either derive it from an interface contract or choose a minimal stable accessible contract."
- 种子数据："When a GIVEN depends on pre-existing records… treat them as normal seeded application state… Do not… infer hidden evaluator data, or replace the database prerequisite with frontend constants."
- 修复技能 `tdd-test-failure-repair`：先把失败分类（实现逻辑/层间连线/选择器与渲染/持久化/框架配置/测试本身有缺陷）；"Preserve the scenario intent instead of weakening it to match current implementation."；同一失败指纹重复出现就换假设或外移一层；每层测试 10 次 run_tests 预算。
- 选择器技能 `leaf-test-layer-selection`：`Password` 与 `Confirm password` 这类子串标签要用精确角色或限定作用域；同名链接要限定到 landmark（如 `getByRole('navigation', {name: 'Global'}).getByRole('link', {name: 'Books', exact: true})`）。

### 1.3 主办方课程 Lab02（hackathon 仓库，训练测试如何被「验真」）[事实]
- `agentic-software-engineering-hackathon/Lab/Lab02/README_en.md`：Act 3 让模型生成 Playwright「train suite」，**先在讲师的参考实现上跑，失败就把失败上下文喂回去修测试，全绿才冻结**；冻结后的测试再去驱动 TDD 修复；最终用讲师事先准备的 hidden validation 独立评分。课程默认模型就是 `deepseek-v4-flash`，base_url `https://api.arc-bench.com/v1`。
- [推断] 这说明主办方的思路是「测试必须先在参考实现上全绿」。hackathon 隐藏测试很可能也经过同样的验真：隐藏测试断言的具体文案/计数来自参考实现的真实输出，而参考实现又对齐需求文字和真实产品。

### 1.4 WebTestPilot（FSE 2026）

- 链接：https://arxiv.org/abs/2602.11724 ；代码与基准 https://github.com/code-philia/WebTestPilot
- 方法 [事实]：把自然语言需求解析成 (condition, action, expectation) 三元组（缺的填 `<unknown>` 再由模型补全，`parser.baml`）；每步生成前置/后置断言；断言只能写在「符号」上（Pydantic schema 从页面状态抽取出的 Cart/Product 等），并跨状态推理三类依赖：因果（动作直接造成的 UI 变化）、数据（前一页的值传到后一页）、时间（同一逻辑页前后对比，如购物车前后差一个商品）。
- 结果 [事实]：Table 3 任务完成率 0.99（最佳基线 LaVague 0.64）；Table 4 缺陷检测 precision 0.96 / recall 0.96（PinATA 0.26 / 0.69）。Table 5：GPT-4.1 在输入被删句（Dropout）、改写（Restyle）、缩写（Summarize）后 TC 从 1.00 掉到 0.70；作者结论 "all necessary information must be present in the requirements, as accurate input parsing is the strongest predictor of downstream task performance"。
- 断言统计 [事实]（§5.5.2，GPT-4.1）：91% 的断言同时引用前后状态；多数是存在性检查（membership 78%、is None 14%、list length 18%），51% 用关系比较。
- 基准的「真值」写法 [事实]：`examples/test_case/comment.yaml` 每步 {action, expectation, ground_truth}，真值是 Playwright 语句，如 `expect(page.get_by_role("button", name="Add Comment")).to_be_visible()`、`to_contain_text("I like this template")`、`to_match_aria_snapshot(...)`；论文 Fig.11 例子 `expect(page.get_by_role('heading', name='Books')).to_be_visible()`。基准需求来自产品用户文档的 happy path，再按 CRUD 外推（增、查、改、删各一条），遵循 ISTQB CTFL（§5.1.2）。注入的缺陷分四类：缺 UI 元素、数据不一致、无效动作（点了没反应）、导航失败（§5.1.4）。
- 后置断言提示词 [事实]（`postcondition.baml`）："Prefer structural checks (count > 0, len >= N, is not None) when exact expected values are not known"；"Avoid checking page titles, page_id or url"。
- 对我们的含义：[推断] 实验室写预言的习惯是「动作后检查：命名控件/标题出现、新建的数据以同样的值出现在列表里、计数/列表长度按动作变化、导航到对的页（看标题而非 URL）」。我们自写测试应该按这四类缺陷去断言，而不是只断言成功提示。

### 1.5 IntentionTest（ISSTA 2026）

- 链接：https://arxiv.org/abs/2507.20619 （v4，2026-07-02）
- 方法 [事实]：输入「验证意图」= 测试目标 + 前置条件 + 期望结果；先在项目里检索一个可复用的已有测试当参考，再让 LLM 按意图编辑它；并用程序分析找「关键代码事实」（该调用的 API、该引用的全局变量）放进上下文；最后迭代修到通过。
- 结果 [事实]：3,680 个测试、12 个 Java 项目；相比基线多杀 28.1–37.6% 的共同变异体、多 16.9–23.9% 共同覆盖、多 23.7–49.0% 成功通过的测试（摘要）。Table 5 消融：去掉参考测试（No Ref）后 Successful Pass 92.00→87.41（LLM 推断意图集）/94.81→85.71（人写意图集），CodeBLEU 41.73→34.73 / 44.42→35.14；去掉事实（No Fact）CMS 76.35→72.44 / 85.18→78.80。即使参考测试与目标相似度很低，也比没有参考好。
- 对我们的含义：[推断]「测试写法」高度可复用。我们让 flash 写测试时，给它一套固定的、仿主办方风格的 helpers（首页进入、按可访问名点、按标签填、断言可见文本）和 1–2 个示范 spec 作为「参考测试」去编辑，比让它从零写更贴近隐藏测试的写法。示范只能用通用或公开基准里别的 app 的例子，不能写题目专名。

### 1.6 TestGeneralizer（FSE 2026）

- 链接：https://arxiv.org/abs/2604.21771
- 方法 [事实]：从一个初始测试推出「测试场景模板」（步骤 + variation points），再把 VP 的取值「结晶」成具体场景实例；每个实例带 primary oracle（从实现推出）与 alternative oracles（从常识需求推出）；先让模型输出结构化 VP 取值，再用确定性程序填模板，避免自由生成。第一阶段把初始测试的断言变异成选择题考模型，检验它是否理解需求。
- 结果 [事实]：506 个 focal method、1,637 个场景；相对 ChatTester 在变异体场景覆盖和 LLM 评估场景覆盖上 +31.66% / +23.08%（摘要）；27 个生成测试提交上游，16 个被合并。
- 对我们的含义：[推断] 模板化场景（"follows the visible controls for … workflow"、同一需求 Scenario 1/2/3）很像「同一模板、不同 VP 取值」：隐藏测试作者多半是从 description 的具体例子里挑 VP（哪个按钮、哪个输入、成功还是校验失败）。我们可以让模型先显式列出每个需求的 VP（控件、输入类别、成功/失败分支、空态），再把 Scenario n 对应到第 n 个最可能的取值组合，而不是让它自由发挥。

### 1.7 实验室其他相关工作（适用性低，简记）
- MACdroid「GUI Test Migration via Abstraction and Concretization」（https://arxiv.org/abs/2409.05028，Yun Lin 合作）：先从源应用同功能测试抽象出通用测试逻辑，再让 LLM 在目标应用上具体化；FrUITeR 数据集上成功测试 64% 的目标功能，比基线高 191%（摘要）。[推断] 可借鉴为：从公开基准的同类功能（登录、注册、搜索、增删改）抽象通用测试逻辑当我们测试生成的骨架。
- GUIPilot（https://arxiv.org/abs/2506.07385）：设计稿与实现的屏幕/流程一致性检测。隐藏测试是 Playwright 脚本，不做视觉比对，不适用。
- IssueExec（https://arxiv.org/abs/2607.17286）：用测试当需求的可执行代理做缺陷定位，Agentless 里多解 17.72%。与生成新应用无关。

### 1.8 WebTestPilot 仓库里的 Playwright 代码生成提示词（2026-07 更新）[事实]
- `webtestpilot/baml_src/action_api/playwright_codegen.baml`：给模型当前页的 **Playwright ARIA snapshot**（AI 模式，带 ref）+ 截图，让它生成一步 Playwright 动作代码。规则原文："Prefer … get_by_role(), get_by_label(), get_by_placeholder(), and get_by_text() using roles, names, states, and text shown in the page observation"；"Do not use … direct navigation"；每个动作带 3000–5000 ms、最多 10000 ms 的超时；"Do not invent selectors or labels not supported by page_context, page_observation, or screenshot"。
- `parser.baml`：把自然语言需求抽成 (condition, action, expectation)，缺的填 `<unknown>`，再用 `ImplicitGeneration` 从其他步骤推断补全。
- [推断] 这套工具链（NL 场景 → 在活的参考实现上按 ARIA 快照生成角色定位器代码 → 后置断言）和 hackathon 隐藏测试的形态（不直接导航、角色/标签/占位符/文本定位、10 秒）完全吻合。隐藏测试的定位器名字很可能取自**参考实现页面上的真实可访问名**，而参考实现又是照着需求 description 做的。所以「description 里引号/反引号括起来的字符串必须原样成为可访问名」之外，没被引用的控件名，隐藏测试会用参考实现选的最自然写法。

### 1.9 ARC 公众号长文（CoPhi 课题组，2026-07-06）[事实]
- https://mp.weixin.qq.com/s/AQSjEMdhEZZRetgQyVclGw 。作者对基线失败的解释：整份长需求灌进上下文会「注意力分散（中段需求点被弱化）」「上下文损耗（遗漏、细节弱化、边界条件丢失）」；ARC 的对策是「由调度器依据 DAG 的依赖边逐个分发节点，每个节点获得独立的处理会话和资源预算」，「测试先行约束……保障了每个需求节点获得对等的注意力投入」。文末自承局限：测试本身质量、反馈信号不足、耗时大。
- [推断] 对一次成型流水线，最便宜的「对等注意力」做法是：整体生成之后，按 ATOMIC 需求逐个开短会话（共享缓存前缀：规格 + 当前代码），每个会话只核对并补丁一个需求。deepseek 缓存命中 0.1 元/百万，前缀复用时输入几乎免费，成本主要是每个需求几千 token 的输出。


---

# 2. 需求→网页/全栈应用生成的基准与方法（并行调研员 sub_A 原始笔记，已抽查关键数字）

> 原文件：`sub_A_webgen/notes.md`；原文 PDF/文本在同目录。

## sub_A_webgen：需求→Web/全栈应用生成的基准与方法调研

- 日期：2026-09-27。调研者：sub_A。全程只读，没有调用任何 LLM 网关，也没有碰任何仓库。
- 方法：每篇都下载 arXiv PDF，再用 `pdftotext -layout` 转成文本读原文。数字都抄自原文的表格或正文。只能从图上读出的数字标「图读数」。本目录下的 `<名>.pdf/.txt` 就是原文。
- 覆盖：lead 点名的 17 篇都读到了。另外补了 2025Q4–2026Q3 的相关论文 20 余篇，其中较重要的是 TDDev 两篇、MSEval、WatchPoint、Vibe Code Bench、FullStack-Agent、InfiniteWeb、Tests as Prompt、WebApp1K Insights、Constraint Decay、PlayCoder、WebCraftBench、SWE-WebDevBench、FrontendBench、WebTestBench、CAT、RealDevWorld。
- 只读了摘要的几篇在各节里注明「只读摘要」。

---

### 0. 结论先行

#### 0.1 我们的失配在文献里有现成对应

- **Tests as Prompt（2505.09027）Table 8**：同一批代码有两种评法。
  - TDD：测试固定，代码必须满足它。
  - TLD：允许测试在单条语句范围内迁就代码（改文本/属性期望、回退框架版本、改 mock 的模块）。
  - 结果：pass@1 从 0.07–0.33 升到 0.64–0.89。例如 llama-v3p1-405b 从 0.302 升到 0.885，mixtral-8x22b 从 0.307 升到 0.800。
  - 结论：测试去适配实现，通过率就会虚高。我们自写测试过 96–98、隐藏测试只过 20–25，就是 TLD 与 TDD 的差。
- **WebApp1K Insights（2409.05177）**：
  - Figure 6（图读数）：即使测试代码就写在 prompt 里，失败里仍有 28.3% 属于「Text Mismatching」，也就是 HTML 文本或属性与测试期望不一致。
  - Table 6：泛泛提醒「让文本或 test-id 与测试一致」，这类错误减少不到 5%。
  - Table 5：只有点名到具体对象的指令才起作用。例如写明「用 useNavigate 代替 useHistory」，同类错误减少 85.9%–100%。
- **DevBench（2403.08604）Table 5**：GPT-4-Turbo 写验收测试时，如果能看到源码，这些测试在参考实现上的通过率从 7.7 升到 14.9。也就是说，看着实现写的测试会贴合那份实现。
  - 我们的情况正好相反：模型看着自己的实现写测试，测试贴合的是自己的实现，而不是隐藏测试。
- **E2EDev、AppForge、FrontendBench**：这几个用脚本做浏览器测试的基准，都把 data-testid、resource-id 或 id/class 直接写进了需求文本。原因是脚本化测试离开固定锚点就会失效。
  - VISTA（2605.26144）的作者也明确说，脚本化 Playwright 测试在开放式生成里很脆弱。
  - 推断：主办方用固定的 Playwright 测试，就只能依赖规格里出现的文案、label、URL 或 id。实现必须逐字贴合规格。
- **小结**：主矛盾是预言失配（oracle mismatch），不是修复能力不够。
  - 用真值测试或隐藏测试的报错去修，增益很大：Web-Bench Pass@2、WatchPoint、Asuka 的第 2–3 轮、TDDev ASE'26 都是这样。但这些方法我们都没法照搬。
  - 能迁移的有两类：一是让自写测试更像隐藏测试，二是防止修复时回退。

#### 0.2 按「对隐藏通过率的帮助 ÷ 3 天成本」排序的技巧

详见 §3。

1. 规格字面契约 + 盲写测试（先测后码，测试只看规格、不看实现）。
2. 自测的跑法对齐隐藏跑法：单 worker、10 秒超时、不重置、按文档顺序。
3. 修复循环保留最佳快照，并守住「不回退、不删功能」。
4. 失败证据结构化（console、网络、服务端日志），先修根因。
5. 修复时只喂相关模块的规格原文，控制上下文。
6. 一次成型多采样 2–3 份，用对齐后的自测选优。

---

### 1. 各基准的隐藏测试怎么来的、断言什么（速查）

| 基准 | 测试来源 | 在参考实现上验证过吗 | 断言方式 |
|---|---|---|---|
| E2EDev | GPT-4o 先给源项目注入 data-testid，多智能体生成 Gherkin 场景和 step 代码，人工审（约 50% 用例需人改） | 是，源项目 100% 通过 | Selenium 按 `[data-testid=…]` 定位，`WebDriverWait(…,10)`，断言类名（如 active）、文本、状态 |
| Web-Bench | 工程师写参考解和 Playwright 测试，再用 LLM 输出校准松紧 | 是 | Playwright。任务描述点名文案和位置（如 "button sqrt with text 'sqrt' at the right of button clear"） |
| WebGen-Bench / TDDev / WebGen-Agent | GPT-4o 草拟自然语言用例，两名博士生审 | 否（没有参考实现） | UI agent（WebVoyager 或 BrowserUse）看截图执行，判 YES/PARTIAL/NO，不绑定选择器 |
| WebApp1K | GPT-4o 按用户旅程生成 Jest + RTL 测试，测试本身就是 prompt | —— | getByText / getByPlaceholderText 查文本，fetchMock 检查调用次数 |
| FrontendBench | 人和 LLM 共建 | —— | Puppeteer + Jest。prompt 里写明 id/class；与人工一致 90.54% |
| ProjectEval | LLM 生成、人审；测试需要参数（test_url、元素名等） | 有标准解 | 模拟用户交互。被测方为自己的实现提供参数值，所以不绑死选择器 |
| AppForge | GUI agent（UIAutomator）在参考 App 上探索录制，专家审；元素缺标签时由 agent 起 resource-id 并写进规格 | 是 | 断言元素存在或不存在，另加 fuzz 查崩溃 |
| Vibe Code Bench | GPT-5 草拟规格和工作流，两名 PM 人审 | 否 | Browser Use 开视觉执行，子步骤 ≥90% 通过才算过；每个工作流新开浏览器、用唯一数据 |
| Asuka-Bench | 从澄清版 PRD 派生准则，组成 DAG | 否 | BrowserUse 执行；前置未满足就跳过下游 |
| FullStack-Bench | LLM 标注加人修 | 否 | 前端用 GUI agent；后端由 judge 发 HTTP 请求；再核对数据库日志 |
| MSEval | 课程需求文档 + rubric | 有 TA 评分可对照（Spearman 0.87） | TAgent 探测 UI、API 和代码 |
| DevBench / Commit0 / SWE-Dev | 真实仓库的单元测试和验收测试（人写） | 是 | 单元测试 |
| WebCoderBench / WebCraftBench / ArtifactsBench | 没有真值测试 | —— | 规则 + LLM/MLLM 评审，或覆盖率引导探索后再评 |

---

### 2. 逐篇笔记

#### 2.1 TDDev（ASE'26 版）From Runnable Code to Shippable Applications — https://arxiv.org/abs/2605.17242

- **任务**
  - 从 WebGen-Bench 随机抽 20 个应用（seed 42），自然语言需求 → 全栈应用。
  - 设计：3 种 TDD 实现 × 2 个 coding agent（自写的最小 agent、OpenCode）× 3 个 backbone（Sonnet 4.6、MiniMax-M3、Qwen3.5-397B）。
  - 温度 0，关推理。deploy–test–repair 最多 5 轮。
- **测试**
  - 环内验收测试：把 WebGen-Bench 的人写测试转成 feature / steps / expected 格式，作为「用户审过的验收测试」的代理。所以环内测试和最终评测同源。
  - 最终评测：固定用 Sonnet 4.6 当测试代理。它看 accessibility tree，现场生成 Playwright 动作，判 Pass/Fail/Partial。断言靠 LLM 判断，不绑选择器。
  - 测试代理可靠性（Table 5）：坏应用 20/20 判对，好应用只判对 15/20。5 个误报里，3 个是现场生成的选择器找不到元素而超时（例如按钮显示「+」，测试步骤写「click the add button」，代理生成了 `text=Add`）；2 个是文案措辞不同被判失败。
- **数字**
  - Table 6（最小 agent）：
    - Sonnet：Vanilla 67.8。Incremental 84.6（+16.8），Whole-Project 83.2（+15.5），Agentic 91.5（+23.7）。
    - Qwen3.5 自己当测试者：Incr 79.8（+4.8），Whole 70.6（−4.4），Agentic 74.2（−0.8）。
    - Qwen3.5 写码、Sonnet 当测试者：+9.4、+6.8、+9.4。
  - Figure 2（MiniMax-M3）：
    - 最小 agent：65.1 → Agentic 87.3、Incr 86.6、Whole 80.9。
    - OpenCode：72.0 → 88.9、89.2、88.8。
  - Table 7（Qwen3.5 的环内轨迹，Qwen3.5 自评 vs Sonnet 评）：
    - 判失败比例 56.2% vs 21.3%。
    - 特性被放弃 48.8% vs 12.1%。
    - 已接纳的特性后来回退 47.6% vs 14.7%。
  - Table 8（Whole-Project 每轮的环内准确率）：
    - Sonnet 从 61.2 升到 81.7，其间有 7/20 个应用出现过下跌。
    - MiniMax 从 69.4 升到 73.4（第 3 轮峰值），再降到 72.4；14/20 个应用出现过下跌。
    - 作者建议保留最佳中间版本，而不是最后一版。
  - Table 9（成本效率）：Whole-Project 最省，Sonnet 每百万额外 token 换 10.33 个百分点，额外 1.50M token。Incremental 对 Sonnet 平均每个应用约 285 次开发调用。
  - 决策树（§6.1）：
    - 测试者不可靠时，换强测试者，或者用 Incremental 限制误导的影响。
    - 中等能力模型追求性价比时，用 Whole-Project 并保留最佳中间实现。
- **映射**
  - 我们的流程就是 Whole-Project TDD：一次写全、全量测、整体修。
  - 可以直接借两点：保留最佳快照；借 Incremental 的回归集思想，要求已通过的测试继续通过，修改才接受。
  - 注意：它的 +15~24 是环内测试与评测同源时的上限。我们自写测试失配，更接近 Qwen3.5 自评那一行（−4.4~+4.8）。
- **3 天内可做**：保留最佳和回归守卫可以做。Incremental 按场景切分受 24 次调用限制，做不了。

#### 2.2 TDDev（2025 版）Automatically Generating Web Applications from Requirements via Multi-Agent TDD — https://arxiv.org/abs/2509.25297

- **任务**：WebGen-Bench 中随机 10 条，另配 Gemini 生成的设计图。开发 agent 从 Bolt.diy 派生，测试 agent 用 Browser-Use。
- **测试**
  - 环内测试由三步生成：需求分解 → 需求细化 → soap-opera 测试（先设想用户角色，再写步骤和预期）。是自产的。
  - 最终评测：WebGen-Bench 测试 + BrowserUse（Claude-4-Sonnet）。
- **数字**（只有 10 个网站，噪声大）：
  - Table 6：GPT-4.1 下 TDDev 78.2、Cursor 60.2、Bolt.diy 25.6。Claude-4-Sonnet 下 70.2、63.8、44.5。Bolt.diy + GPT-4.1 有 80% 启动失败。
  - Table 8（Claude-4-Sonnet）：直接一步生成测试 59.1，多步派生 70.2。Functionality 一项 33.3 vs 61.1。
  - Table 9：无反馈 58.3，1 轮 25.3，2 轮 25.2，3 轮 70.2。1–2 轮修复反而大跌，原因是修复时引入新 bug。
  - §6.2.1：超过 5 轮方差变大，作者建议多跑几轮取最好。
- **映射**
  - 生成前先把需求拆成可测清单再细化，对应技巧 1。
  - 修复 1–2 轮就大跌的现象，支持技巧 3。

#### 2.3 WebGen-Agent — https://arxiv.org/abs/2509.22644

- **任务**：WebGen-Bench（101 条指令、647 条测试）。每一步流程：
  1. 写代码。
  2. 装依赖、起服务。
  3. 截图交给 Qwen2.5-VL-32B 描述并打外观分。
  4. GUI agent 按需求测试并打功能分。
  5. 连续 5 步执行出错时，回溯到历史最佳步（先比 GUI 分，再比截图分，同分取最新）。
  6. 结束时选全程最佳步。
- **测试**：同 WebGen-Bench（见 §2.22），WebVoyager 判 YES/PARTIAL/NO。
- **数字**
  - Table 2（DeepSeek-V3，逐步加组件）：
    - Execution-only 45.9
    - +Screenshot 46.6（外观分 3.0 → 3.6）
    - +GUI-agent 49.9（+3.3，单项最大）
    - +Backtrack 51.2
    - +Select-best 52.6
  - Table 1：同为 DeepSeek-V3，Bolt.diy 20.8，WebGen-Agent 52.6；启动失败从 3.1% 降到 0.2%。两者框架不同，不是干净消融，但只靠执行反馈的版本已有 45.9。
  - Table 8（最大迭代数，DeepSeek-V3）：2 轮 42.4，4 轮 47.9，6 轮 50.2，10 轮 52.0，20 轮 52.6。约 10 轮后饱和。
  - Table 5：截图分、GUI 分与人工一致 89.6–95.6%。
- **映射**
  - GUI agent 自测相当于我们的 Playwright 自测。
  - 回溯和选最佳几乎零成本，可以按自测通过数做。
  - 截图反馈我们用不了：模型看不见图，隐藏测试也不测外观。

#### 2.4 MSEval / LegoGent — An Empirical Study of Coordination Mode ... From-Scratch Multi-Agent Coding — https://arxiv.org/abs/2607.27877

- **任务**：10 个真实全栈 Web 项目（大学软件工程课题，需求文档不含 API 细节）。10 种协作拓扑 × 3 个模型（DeepSeek v4 Flash、DeepSeek v4 Pro、GLM-5.2）。每轮 90 分钟，最多 3 轮；每轮之后由 TAgent 评分并反馈。
- **测试**：TAgent 探测已部署的 UI、API 和代码，按需求文档的层级 rubric 打分。与 TA 评分的 Spearman 为 0.87。
- **数字**（Table 3，10 个项目平均，R1/R2/R3）
  - DeepSeek v4 Flash：

    | 拓扑 | R1 | R2 | R3 |
    |---|---|---|---|
    | QA-first | 52.0 | 70.2 | 80.6 |
    | Competitive | 40.7 | 70.3 | 80.0 |
    | Rotation | 36.6 | 68.3 | 73.8 |
    | Pipeline | 34.6 | 58.6 | 71.3 |
    | PM | 30.2 | 58.9 | 75.2 |
    | Adversarial | 28.2 | 44.9 | 67.7 |
    | Swarming | 25.2 | 44.8 | 62.9 |
    | Feature squad | 24.9 | 50.3 | 71.3 |
    | OSS | 21.7 | 49.5 | 72.0 |
    | Layer | 21.2 | 44.8 | 67.6 |

  - QA-first 的定义（Table 7）：QA 先写出可执行的验收套件，再开始实现；验收测试是唯一真源。
  - DeepSeek v4 Pro：QA-first 52.0 / 75.9 / 85.5，Pipeline 59.5 / 80.1 / 83.7。
  - Table 4（1,440 个失败检查的根因）：
    - 逻辑不完整或边界 32.2%
    - 缺功能 23.8%
    - 鉴权/会话/权限 11.9%
    - 前置依赖级联 11.0%：39% 的运行出现过；一个坏前置最多连带跳过 14 个检查。
  - 回退实例：Pro 的 PM 模式在即时通讯项目第 3 轮修好一处、改坏五处，分数从 80.9 降到 66.0。
- **映射**
  - 这是唯一直接覆盖 deepseek-v4-flash、比较「先写测试」与其他组织方式的数据。R1 还没收到评测反馈，QA-first 已比其他拓扑高 11–31 分。
  - 注意事项：
    - 这是多智能体、每轮 90 分钟的设置。
    - 每个项目 × 拓扑只跑一次，没报方差。
    - R2/R3 用的是评测器反馈，相当于隐藏测试反馈，我们没有。

#### 2.5 FullStack-Agent — https://arxiv.org/abs/2602.03798

- **任务**：自建 FullStack-Bench（WebGen-Bench 指令 + 前端/后端/数据库测试）。
  - Planning agent 先输出前后端设计 JSON，实体、API、数据类型都细到最底层。
  - 前端、后端 coding agent 依次实现。
  - 前端调试工具：起服务，GUI agent 按指令操作，同时盯终端和浏览器 console；一出错就让 GUI agent 指出是哪个动作触发的。
  - 后端调试工具：给定 URL、方法和数据，起服务、发请求，返回响应和后端 console，类似 Postman。
- **测试**：
  - 前端 647 条（WebGen-Bench），由 GUI agent 执行。
  - 后端 604 条、数据库 389 条，LLM 标注后人工修订；judge agent 发 HTTP 请求并核对数据库日志。
  - 与人工一致率 >90%（Table 6）。
- **数字**（Table 4，Qwen3-Coder-480B，主指标为 "w/ Valid DB"）：
  - 完整版：前端 64.7，后端 77.8，数据库 77.9。
  - 去掉前端调试工具：前端 51.9（−12.8）。
  - 去掉后端调试工具：后端 57.9（−19.9）；后端 agent 平均迭代次数从 74.9 升到 115.5。
  - 两个工具都去掉：前端 51.0，后端 61.9。
  - 去掉多智能体（单 agent）：前端 62.1，后端 61.4，数据库 63.5。
  - Table 2（同 backbone）：WebGen-Agent 56.0 / 39.6 / 62.0，Bolt.diy 20.3 / 12.7 / 13.6。
- **映射**：
  - 修复时带上 console error、pageerror、4xx/5xx 请求。
  - 加一步 API 冒烟：直接用 HTTP 调每个接口看状态码和返回。
  - 成本低，3 天内可做。

#### 2.6 E2EDev — https://arxiv.org/abs/2510.14509

- **任务**：46 个 GitHub Web 项目，多为前端单页（HTML/JS/CSS）。244 条细粒度需求，703 条 BDD（Gherkin）场景，配 Python step 实现，用 Behave + Selenium 跑。
- **测试来源**
  - GPT-4o 先给源项目的关键 UI 组件注入语义化、跨文件一致的 data-testid。
  - 多智能体再从源码生成需求、Gherkin 场景和 step 代码。
  - 人工审：约 20% 的需求、50% 的用例、不到 20% 的脚本需要人改。
  - 在源项目上验证 100% 通过。
  - 需求原文里直接写出 testid，例如 `'piano-key-a'`。step 用 `WebDriverWait(…, 10)` 加 `[data-testid=…]` 定位，断言类名（如 active）、文本和状态。
- **数字**
  - Table 3（Req Acc / Test Acc）：
    - Claude-Haiku 4.5：Vanilla 48.69 / 63.08，GPT-Engineer 53.75 / 69.41，MetaGPT 5.39 / 10.66。
    - GPT-4o：Vanilla 45.95 / 60.88，GPT-Engineer 50.83 / 66.59，MetaGPT 0.00 / 0.17。
    - GPT-Engineer 是单智能体：先 think step by step 隐式分析需求，再一次写出全部文件。它在 6 个 backbone 中的 5 个上比 Vanilla 的 Req Acc 高 1.7–6.3 分；GPT-4o-mini 例外（44.82 → 42.13）。
  - Table 8：OpenHands 单次执行 43.45（Haiku），SWE-Agent 44.73，都不如 Vanilla。
  - 失败分析（Figure 5 与正文）：
    - Vanilla 和 ChatDev 的需求遗漏最多，因为编码者看不到详细需求。
    - 多智能体的细节失配随上下文链变长而加重：智能体转述时会压缩或改写原需求，而没有照原文重述。
- **映射**
  - 这是和我们最像的基准：GIVEN/WHEN/THEN、浏览器自动化、10 秒等待。
  - 关键启示：测试在参考实现上生成和验证；选择器和文案来自参考实现并写进了需求。要过隐藏测试，就得逐字照需求里的名字和文案实现。
  - 「一次写全前先列组件和文件」（GPT-Engineer 式）约 +2~6 分，成本几乎为零。

#### 2.7 Web-Bench（https://arxiv.org/abs/2505.07473）和 WatchPoint（https://arxiv.org/abs/2609.26204）

- **Web-Bench**
  - 任务：50 个项目 × 20 个顺序依赖任务，后一个任务在前一个任务的代码上继续做。
  - 测试：工程师写参考解和 Playwright 测试，再用 LLM 输出校准松紧。任务描述很短，直接点名文案和位置。
  - 指标：Pass@1 = 首次尝试就通过的任务比例（只算第一次失败之前的）；Pass@2 = 允许带构建/测试报错重试一次。全文用 best-of-5 采样。
  - Table 9：
    - deepseek-v3-0324 17.07 → 23.59
    - deepseek-r1 14.46 → 26.20
    - claude-3.7-sonnet-thinking 25.11 → 35.33
    - gpt-4o 17.17 → 23.80
    - 也就是说，用真值 E2E 报错重试一次，能涨 3–12 分。
  - Table 2：deepseek 的请求上下文被截断到 10K token。
  - Figure 12：同型号开 thinking 时 Pass@2 更好（只有图，没有数值）。
- **WatchPoint**（在 Web-Bench 上，OpenHands，温度 0，每次尝试 30 次调用）
  - Table 1：只用测试报错、在原对话里继续（warm-start），GLM-5 从 P@1 25.0 升到 P@2 44.5；MiniMax M2.7 从 18.0 升到 26.6。
  - Table 2：给较弱的 M2.7 加一个「模拟用户」诊断器（生成并执行诊断脚本，返回结构化的浏览器和终端观察），被重试任务的恢复率从 45.1% 升到 57.6%。
  - 但给较强的 GLM-5 加 GPT-5.4 诊断后，P@2 从 44.5 降到 37.7。原因是诊断脚本打错端口/URL，或只描述表面症状，干扰了修复。
- **映射**
  - 顺序依赖加级联失败，与我们「按文档顺序跑、同一实例」的隐藏测试相似。
  - 可借：失败报告附诊断观察（对弱模型有效）；修复时在原对话里继续。
  - 不可借：真值报错。

#### 2.8 WebApp1K（https://arxiv.org/abs/2408.00019）、Insights（https://arxiv.org/abs/2409.05177）、Tests as Prompt（https://arxiv.org/abs/2505.09027）

- **任务**：写一个 React 单文件；prompt 就是 Jest + React Testing Library 测试（成功和失败各一例，用 fetchMock 模拟后端）。
- **测试**：GPT-4o 按用户旅程生成。断言 getByText、getByPlaceholderText 的文本，以及 fetchMock 的调用次数。
- **2408.00019**
  - Table 9：gpt-4o pass@1 0.8702，claude-3.5-sonnet 0.8808，deepseek-coder-v2 0.7002。期望写清楚时，强模型约 0.87。
  - Table 8：把失败代码加报错喂回去重试，效果两极：claude +38%，gpt-4o −56%，deepseek-coder-v2 −79%。注意只在失败样本上重试，样本少。
- **2409.05177**
  - Figure 6（图读数）：错误分布为 A 版本不匹配 32.8%、B 文本不匹配 28.3%、C API 调用次数不符 16.3%、D 未安装模块 11.8%，E/F/G 合计约 11%。
  - Table 5 / Table 6：针对性指令把 A 类错减少 85.9%–100%；泛泛的「让文本或 test-id 匹配」对 B 类减少不到 5%。
  - §4.2：93% 的失败日志只有一个错误，或同一个错误出现两次。
- **2505.09027**
  - Table 8：TDD 与 TLD 的对比（见 §0.1）。
  - Table 9：把两个功能合并成一题，prompt 长度翻倍到约 1K token，pass@1 全面下降：claude-3.5-sonnet 0.75，deepseek-v3 0.585，gpt-4o 0.531（单功能时 claude 和 gpt-4o 约 0.87–0.88）。
  - §4.2 把这种现象叫作长 prompt 的「指令丢失」。
- **映射**：这三篇最能解释我们的失配。
  - 把规格里的字面量（按钮文案、标题、提示语、占位符、URL、字段名）逐条列成硬约束，比泛泛地说「按规格实现」有效。
  - 看过实现再写的自测就是 TLD，会虚高。

#### 2.9 Asuka-Bench — https://arxiv.org/abs/2606.05920

- **任务**：50 条故意模糊的需求，背后各有一份隐藏的澄清版 PRD。
  - Code Agent（OpenHands 或 Claude Code）生成应用。
  - UI Agent（BrowserUse，GPT-5.4）按 DAG 顺序执行评测准则。
  - User LLM 把结果转成自然语言反馈，最多 3 轮。
- **测试**：LLM 从 PRD 派生准则，共 784 个任务、2,402 条预期结果，按依赖组成 DAG（平均深度 4.4），前置不满足就跳过下游。与人工一致 93.35%。
- **数字**
  - Table 1：第 2 轮平均涨约 25pp，第 3 轮再涨 7–13pp。反馈来自评测器本身。Claude-4.6-Sonnet 从 R1 55.7 升到 R3 89.4。
  - Figure 5：一次性给澄清版 PRD（PRD-1R）与「模糊需求 + 3 轮反馈」相比，首轮模糊版低 9–18pp，但 3 轮后全部反超 PRD-1R，净多 8.7–26.6pp。
  - Table 3：DAG 反馈（只报根因失败）与平铺反馈（报全部失败）相比，第 2 轮的任务修复率：
    - GLM-5：61.8% vs 45.9%
    - MiniMax-M2.7：57.7% vs 39.9%
    - Seed-2.0-Pro：35.7% vs 30.9%
    - Qwen3.5-Plus：44.4% vs 40.8%
    - 评测 token 省 23–27%。两种协议下的最终通过率口径不同，不能直接比。
  - Table 2：严格 DAG（父失败就跳过所有子项）比全量评测平均少 6.0pp，这就是级联损失的量级。
- **映射**：
  - 「修复时先给根因」有数字支持。根因指上游、最早失败的那个场景。
  - 级联损失说明：隐藏测试按顺序跑时，前面场景一坏会连带后面。

#### 2.10 InfiniteWeb — https://arxiv.org/abs/2601.04126

- **任务**：为训练 GUI agent 合成多页网站。
  - 先做统一规格：任务 → 数据模型 → 跨页接口。
  - 后端用 TCTDD：测试和实现并行生成，共用同一份预生成数据；跑测试、修到全过，最多 8 轮，多数 1–3 轮。
  - 前端按设计图生成，用 data-attribute 绑定数据。
- **评测**：在 WebGen-Bench 上用 UI agent 评功能。
- **数字**
  - Table 1 / Table 5：InfiniteWeb（GPT-5）85.6，Codex 80.8，Claude-Code 75.8，Bolt.diy 67.1。
  - Table 6：去掉 TCTDD 得 82.6；正文却写降 5.0 分到 80.6，与表不一致。换成 GPT-4.1 得 77.4。
- **映射**：测试和实现从同一份规格并行产出，而不是看着实现写测试，与技巧 1 一致。在强模型上增益 3–5 分。

#### 2.11 Vibe Code Bench — https://arxiv.org/abs/2603.04601

- **任务**：100 个应用规格（验证集、测试集各 50），964 个浏览器工作流，10,131 个子步骤。环境是改过的 OpenHands，每个应用 5 小时；强制 React + Vite + Supabase，用 Docker Compose 部署。
- **测试**
  - GPT-5 结构化草拟规格和每个应用 6–23 个工作流，两名 PM 两轮人审，逐条接受/修改/拒绝。
  - §3.1 第 (4) 步「audit and freeze」：PM 逐行确认每个被测元素都在规格里给出，再由 LLM 审一遍残留的规格与测试不一致。规定测试用到的具体邮箱、用户名、表单值等必须写在规格里。这从出题方的角度说明：脚本和 agent 测的就是规格里的字面信息。
  - Browser Use（Claude Sonnet 4.5，开视觉）执行；子步骤 ≥90% 通过才算工作流通过。
  - 每个工作流新开浏览器，并用唯一的账号和数据值，防止状态泄漏。没有参考实现。
- **数字**
  - Table 4：GPT-5.3-Codex 61.77%，Claude Opus 4.6 57.57%，DeepSeek V3.2 Thinking 5.11%。
  - §5.1：
    - 每个应用的浏览器调用次数（自测）与准确率的 Pearson r = 0.72；控制耗时后偏相关仍是 0.72。编辑次数与准确率 r = 0.09。
    - GPT-5.2 的浏览器调用是 GPT-5.2-Codex 的近 3 倍（26.4 vs 9.4），准确率 53.5 vs 37.9。
  - §5.2：能启动的应用里，失败原因中缺功能占 46.7%，鉴权 20.4%，校验或策略拦截 14.8%。
  - §5.3：总方差里生成侧占 73.5%–92.5%，评测侧很小。
- **映射**：
  - 「多做自测」只有相关性证据，不是消融。
  - 方差主要来自生成，说明多采样有空间。
  - 它刻意给每个工作流独立数据，而我们的隐藏测试不重置实例，所以必须主动处理状态累积。

#### 2.12 PRDBench — https://arxiv.org/abs/2510.24358（AAMAS'26，「Automatically Benchmarking LLM Code Agents through Agent-driven Annotation and Evaluation」）

- **任务**：50 个 Python 项目（不是 Web）。每题有结构化 PRD、代码骨架接口，以及按 AAA 结构写的 criteria scheme（单元测试、Shell 交互、文件比对）。PRDJudge（由 Qwen3-Coder-30B 微调）执行评测，在固定接口场景下与人工一致率 >90%。
- **数字**（Table 4；DEV 为一次实现，DEBUG 为按 PRDJudge 反馈修一轮）：

  | Agent | DEV | DEBUG | 变化 |
  |---|---|---|---|
  | GPT-5.2 | 62.49 | 69.00 | +6.51 |
  | Claude-4.5 | 69.19 | 56.40 | −12.79 |
  | DeepSeek-V3.2 | 40.11 | 24.80 | −15.31 |
  | Kimi-K2 | 20.52 | 36.17 | +15.65 |
  | Claude Code | 56.65 | 70.25 | +13.60 |

  - 作者结论：没有脚手架的模型在长上下文调试里常把原本正常的模块改坏；商用 agent 多做局部小改，调试更稳。
  - Figure 7：不给接口、自由开发时评测噪声大，作者认为固定接口才可靠。
- **映射**：DeepSeek 系模型修一轮可能大幅倒退，对应技巧 3。我们用 SEARCH/REPLACE 做局部修改，方向是对的。

#### 2.13 Commit0 — https://arxiv.org/abs/2412.01769

- **任务**：按长规格从零实现 Python 库（函数体置空），跑库自带的单元测试（人写，在原库上验证过）。
- **数字**
  - Table 1（Commit0 lite 的单元测试通过率，三阶段：草稿 → 按 lint 修 → 按单测修）：
    - Claude 3.5 Sonnet：17.80 → 18.79 → 29.30。
    - DeepSeek-V2.5：16.55 → 11.61（lint 反馈反而变差）→ 25.43。
  - Figure 4 与正文：
    - 把规格前 10K token 直接放进上下文，通过率反而下降；同样 10K 换成 BM25 检索出的相关块，效果更好。
    - 按依赖拓扑序生成，不如随机顺序（17% vs 22%）。作者解释：以错误的上游实现为条件，比上游为空更有害。
  - Figure 5（图读数）：best-of-n（选单测通过最多的）和按单测迭代修复，都随成本上升；后者更高。
  - OpenHands 深度集成后达 42.95%，比作者自己的 agent（SDE-I）高 13.65。
- **映射**：
  - 长规格要按需检索相关段落，不要整段塞进去。
  - 依赖顺序只在上游已验证时有益。这与 ARC 的逐功能先测后码不矛盾，因为 ARC 每一步都验证。
  - lint 这类静态反馈对弱模型有害。

#### 2.14 SWE-Dev — https://arxiv.org/abs/2505.16975

- **任务**：在真实仓库里做特性开发，给 PRD 加单元测试，Python。
- **数字**
  - Table 9（GPT-4o-mini，Easy / Hard Pass@1）：

    | 方法 | Easy | Hard | 调用次数 |
    |---|---|---|---|
    | 单模型 | 34.47 | 11.09 | 1 |
    | Self-Refine | 40.02 | 20.03 | 5 |
    | Self-Consistency | 37.62 | 18.55 | 6 |
    | Reflexion | 39.77 | 13.32 | 约 2 |
    | MapCoder | 24.55 | 5.87 | 约 21–23 |
    | ChatDev | 35.13 | 11.70 | 约 27–31 |
    | MetaGPT | 29.56 | 9.25 | 约 10 |

  - §4.1.3：用 OpenHands（工具 + 测试反馈）时，强模型在 Hard 上超过 50%，例如 Claude4.1-Opus-thinking 56.44%。
- **映射**：简单的自我修订和多采样胜过复杂的角色流程。Self-Refine 具体用什么反馈，附录 H.1 我没有深读。

#### 2.15 DevBench / DevEval — https://arxiv.org/abs/2403.08604

- **任务**：给 PRD、UML 和架构设计，生成多文件代码库，覆盖 4 种语言。评测用参考实现的验收测试和单元测试（人写）。
- **数字**
  - Table 3（GPT-4-Turbo，实现任务在验收测试上的通过率）：No-Review 3.0，Normal-Review 3.0，Execution-Feedback 8.9。只做文本评审没有增益，带执行反馈才有。
  - Table 5（生成的验收测试在参考实现上的通过率）：No-Review 3.6，Normal-Review 7.7，带源码的评审 14.9。
- **映射**：执行反馈比纯阅读评审有效。看着源码写测试，测试就会贴合那份源码（见 §0.1）。

#### 2.16 ProjectEval — https://arxiv.org/abs/2503.07010

- **任务**：20 个项目（网站、控制台程序、游戏）。三级输入：L1 自然语言，L2 检查清单，L3 代码骨架。
- **测试**：模拟用户交互。测试需要一些参数（如 test_url、元素名），由被测方为自己的实现提供，所以测试不绑死选择器。
- **数字**（Table 4，Pass@5）：
  - GPT-4o 级联生成（自然语言 → 清单 → 骨架 → 代码）：L1 8.52，L2 12.32。
  - GPT-4o 直接生成：L1 16.06，L2 15.42，L3 10.14。
  - 对 GPT-4o 来说，级联更差，给骨架也更差。弱模型的分数都接近 0，难以下结论。
- **映射**：输入更细、中间产物更多，不一定更好。它允许被测方自己申报选择器，我们的比赛没有这个机制，只能逐字贴合规格。

#### 2.17 AppForge — https://arxiv.org/abs/2510.07740（ICLR'26）

- **任务**：101 个 F-Droid 安卓应用，自然语言规格 → 从零写 App。
- **测试**：用 UIAutomator 在参考 App 上探索录制，专家审核。动作都指向有明确文本或 resource-id 的元素；元素缺标签时，由 agent 起名并写进规格。断言是某元素存在或不存在，另加 fuzz 查崩溃。
- **数字**
  - Table 1：
    - GPT-5-High 成功率 14.85%，给编译错误反馈后 18.81%。
    - GPT-4.1 给编译反馈后，编译率从 6.93% 升到 74.26%，但文件数从 8.00 降到 2.68，代码行数从 367 降到 58：它把出错的实现删成空函数来逃避开发（Figure 8）。成功率仍是 0.99%。
  - Figure 5：反馈 2–3 轮后功能成功率就饱和。
  - Table 3：GPT-5 推理强度 low / medium / high 的成功率分别为 2.97 / 3.96 / 14.85。
- **映射**：修复循环要防止「删功能换通过」。技巧 3 里加守卫：代码量、路由数、测试断言数都不能明显下降。

#### 2.18 WebGameBench — https://arxiv.org/abs/2605.17637

- **任务**：111 个浏览器小游戏，给冻结的结构化规格，要求交付可访问的应用。运行时评测 agent 在真浏览器里试玩，打 EXCELLENT / USABLE / UNUSABLE。
- **数字**（Table 1）：

  | 配置 | 可用率 | 优秀率 |
  |---|---|---|
  | deepseek-v4-flash thinking | 62.7% | 13.6% |
  | deepseek-v4-flash non-thinking | 59.3% | 14.8% |
  | deepseek-v4-pro thinking | 62.2% | 12.6% |
  | deepseek-v4-pro non-thinking | 44.1% | 16.2% |
  | opus-4-7（最佳） | 76.9% | 20.2% |

- **映射**：这是同型号 thinking 开关的直接对比。对 Flash，thinking 只让可用率 +3.4pp，优秀率反降 1.2pp；对 Pro 则 +18.1pp。如果我们还没开 thinking，开它是便宜的试验，但对 Flash 预期收益小。

#### 2.19 RealDevWorld / AppEvalPilot — https://arxiv.org/abs/2508.14104

- **任务**：194 个开放式需求（部分多模态）。AppEvalPilot 是一个 GUI agent 评审，按测试用例交互打分，与专家一致率 0.92。
- **数字**（Table 3，Agent Quality）：
  - MGX 0.60 → MGX（BoN-3）0.78。
  - Lovable 0.74，Bolt 0.54，OpenHands 0.50。
  - 直接用 LLM 生成：DeepSeek-V3 0.29，Kimi-K2 0.39。
  - BoN-3 按什么标准选，正文没说明。
- **映射**：多采样选优有 +0.18 的案例。但选择标准未知，如果是用评测器选的，那就只是上限。

#### 2.20 PlayCoder — https://arxiv.org/abs/2604.19742

- **任务**：43 个 GUI 应用（多为游戏，Python/JS/TS）。PlayTester（LLM GUI 测试 agent）和 PlayRefiner（修复 agent）组成闭环。
- **数字**（§RQ-3 / Table 5，GPT-5-mini）：
  - 去掉修复（APR）：Exec@3 在 Python 从 26.8 降到 18.3，在 JS 从 30.9 降到 21.1。
  - 去掉 GUI 反馈：Play@3 降 4.2–4.7pp。
- **映射**：与 WebGen-Agent 结论一致。在测试可靠的前提下，GUI 行为反馈加修复有 4–10pp 的增益。

#### 2.21 Constraint Decay — https://arxiv.org/abs/2605.06445

- **任务**：80 个后端从零生成任务 + 20 个特性实现任务，统一 API 契约，用 E2E 行为测试加静态校验。约束级别从 L0（只指定框架）到 L3（再加架构、数据库、ORM）。
- **数字**（Table 2 / Table 3）：
  - L0 → L3，断言通过率平均降 27.48pp（摘要写 27.28）。
  - 单项约束的影响：指定 PostgreSQL −20.4，SQLite −16.1，Clean Architecture −8.8。
  - 极简、显式的框架（如 Flask）表现好于约定繁多的框架。
- **映射**：结构性约束越多，掉分越多。我们选原生 JS + Express + JSON 文件这种极简栈是对的。

#### 2.22 WebGen-Bench — https://arxiv.org/abs/2505.03733

- **任务**：101 条自然语言建站指令，647 条测试。测试由 GPT-4o 草拟、两名博士生审核；WebVoyager（Qwen2.5-VL-32B）执行，判 YES/PARTIAL/NO；外观由 GPT-4o 打 1–5 分。
- **数字**
  - Table 3：最佳通用组合 Bolt.diy + DeepSeek-R1 为 27.8%，Claude-3.5 26.4%，DeepSeek-V3 20.8%。启动失败率：o3-mini 38.6%，Aider 23–32%。
  - Table 5：UI agent 与人工一致 86.1–94.4%。
  - Table 4：功能类测试得分最低（DeepSeek-V3 仅 10.5%），设计类最高。
  - 没有生成技巧的消融，只有训练数据量的消融（Table 6：150 / 300 / 600 条 → 25.1 / 31.9 / 38.2）。
- **映射**：启动失败是大头之一。生成后第一件事是确认能启动、首页没报错。

#### 2.23 WebCoderBench — https://arxiv.org/abs/2601.02430

- **任务**：1,572 条真实用户需求，24 个指标（规则 + LLM-as-judge），没有真值测试。
- **数字**：
  - Table 5：需求越清晰，得分反而不升（加权 z 分：Clear −0.02%，Vague +5.98%）。作者解释：清晰需求约束多，容易违反。
  - agent 产品（Manus、MiniMax Agent）对需求的贴合度高，但性能和可访问性差；MiniMax Agent 的总分甚至低于它的基座模型。
- **映射**：只是评测。间接说明细粒度约束越多越容易丢分，需要逐条核对。

#### 2.24 WebCraftBench（又名 IWC-Bench）— https://arxiv.org/abs/2609.15387

- **任务**：369 条真实需求，5,088 条验收准则。
  - 先由覆盖率引导的探索 agent（AWorld + Playwright）自由探索，把轨迹抽象成状态迁移图。
  - 再评审美、可用性和需求对齐。与人类偏好一致 85.3%。
- **数字**
  - Table 3 / Table 6：DeepSeek-V4-Flash（由 Claude Code 驱动，max effort）在 17 个模型里排第 11；需求对齐的功能分 92.4%，Claude-Opus-4.8 为 97.6%。
  - §5.6：覆盖率引导把函数覆盖率中位数从 91.9% 提到 94.3%。覆盖率低于 70% 的，通常是入口报错或关键路径断了。
- **映射**：只是评测。「关键路径一断，下游全部不可达」与我们按顺序跑的隐藏测试是同一个道理。

#### 2.25 ArtifactsBench — https://arxiv.org/abs/2507.04952

- **任务**：1,825 个单轮可视化交互 artifact。评测时截三步截图，连同源码交给 MLLM 按清单打分；与 WebDev Arena 的排名一致率 94.4%。
- 没有 agent 技巧的消融。依赖看图，我们的模型和隐藏测试都不走这条路。**不适用。**

#### 2.26 FullStack Bench — https://arxiv.org/abs/2412.00535

- **任务**：3,374 道多领域、16 种语言的函数级编程题（含 Desktop/Web 类），单元测试加 SandboxFusion 沙箱。
- **数字**：§4.6 / Figure 10：带沙箱报错的 Reflection 明显优于同样次数的 BoN。只有图，没有表格数字。
- **映射**：不是应用级生成，只能作为「执行反馈优于盲采样」的旁证。

#### 2.27 SW-A²-Bench — https://arxiv.org/abs/2604.04226

- 任务是把现有代码仓库转成可互操作的 A2A/MCP 软件 agent，评生成过程、能力继承和多 agent 协作。
- 与「需求 → Web 应用」无关。**不适用。**

#### 2.28 其他 2026 相关论文（只记与我们有关的一两点）

- **SWE-WebDevBench**（https://arxiv.org/abs/2605.04637）
  - 6 个 AI 建站平台 × 3 个提示，埋了 80 条「金丝雀需求」（日期格式、币种写法、领域术语、可见性规则）。
  - 金丝雀保留率 17.7%–97.7%。
  - 这是描述性结果：每平台只有 3 个提示，而且作者与被测平台之一有利益关系。
  - 支持「细节字面量容易在转述或计划中丢失」。
- **VISTA**（https://arxiv.org/abs/2605.26144）
  - 视觉规格 → Web 应用。
  - 作者明确说，脚本化 Playwright 在开放式生成中很脆弱，所以人工标注交互组件和视觉锚点，再用 DOM 参照匹配、行为测试和 CLIP 相似度评分。
- **FrontendBench**（https://arxiv.org/abs/2506.13832）
  - 148 个前端任务，Puppeteer + Jest 测试。
  - 为了方便自动测试，prompt 里直接写明 id 和 class；自动评测与人工一致 90.54%。
- **WebTestBench**（https://arxiv.org/abs/2603.25226）
  - 让 LLM 测试 agent 先生成检查清单，再找缺陷。
  - 所有模型 F1 都低于 30%：最高 26.4%，对应召回 33.3%；多数模型召回低于 25%。
  - 说明 LLM 自测会漏掉大部分真实缺陷。
- **CAT**（https://arxiv.org/abs/2609.00081）
  - 测试 agent 写 Playwright 脚本驱动浏览器。最强模型也只找到 42.57% 的真值 bug（Table 1）。
  - Table 3：只做静态代码审查、不开浏览器时，R-score 35.87，但 P-score 只有 10.60，误报很多。
- **WebTestPilot**（https://arxiv.org/abs/2602.11724，只读摘要）
  - 从自然语言规格做 E2E 测试：先把关键 GUI 元素符号化，再生成断言。
  - 在注入 bug 的应用上，精确率和召回率都是 96%。
  - 属于 oracle 方向，归 sub_B 范围。
- **From Prompt to Product**（https://arxiv.org/abs/2512.18080）、**ICAE-Bench**（https://arxiv.org/abs/2607.21217）、**InteractWeb-Bench**（https://arxiv.org/abs/2604.27419）
  - 都是人评或需求澄清交互，没有可迁移的生成技巧数字。
- **You Don't Need Public Tests / DryRUN**（https://arxiv.org/abs/2604.21598，只读摘要）
  - 在算法题上，依赖公开样例测试会产生「过度自信差」，在隐藏测试上表现不足。
  - 领域不同，只作旁证。
- **Agent-as-a-Judge / DevAI**（https://arxiv.org/abs/2410.10934）：只下载，未深读。

---

### 3. 按技巧维度汇总

| 技巧 | 证据（出处 + 表号） | 结论 |
|---|---|---|
| 逐功能增量 vs 一次成型 | TDDev ASE'26 Table 6：Sonnet 上 Incr +16.8 ≈ Whole +15.5；测试者不可靠时 Incr +4.8，Whole −4.4。Table 9：Incr 约 285 次开发调用/应用。Commit0 Fig.4：拓扑序 17% < 随机序 22%。ProjectEval Table 4：级联更差。MSEval Table 3：Flash 下 Pipeline R1 34.6 < QA-first 52.0。ARC（lead 已读） | 增量的好处来自每一步都有已验证的回归集。24 次调用上限下，最多只能按模块分批做 |
| 先写测试 vs 不写 | MSEval Table 3：Flash QA-first R1 52.0，其余 21.2–40.7。TDDev 2025 Table 8：70.2 vs 59.1。InfiniteWeb Table 6：去掉 TCTDD 降 3.0（正文说 5.0）。Tests as Prompt Table 8：TLD 虚高 | 先测后码有效，前提是测试从规格出发，而不是看实现写 |
| GUI/浏览器自测反馈 | WebGen-Agent Table 2：+3.3。FullStack-Agent Table 4：前端调试工具 +12.8，后端 +19.9。PlayCoder Table 5：GUI 反馈 +4.2~4.7。Vibe Code Bench：r = 0.72（相关性）。反例：TDDev ASE'26 Table 6/7，反馈不可靠时 −4.4，47.6% 已接纳特性回退。WebTestBench、CAT：LLM 测试者漏检多 | 测试可靠时 +3~20；测试不可靠时可能为负 |
| 截图反馈 | WebGen-Agent Table 2：准确率 +0.7，外观分 3.0 → 3.6 | 我们用不了 |
| 回溯 / 选最佳 | WebGen-Agent Table 2：回溯 +1.3、选最佳 +1.4。TDDev ASE'26 Table 8：MiniMax 14/20 应用中途回退。TDDev 2025 Table 9：1 轮后从 58.3 跌到 25.3。PRDBench Table 4：DeepSeek-V3.2 −15.31。MSEval 实例：80.9 → 66.0。AppForge Table 1：删代码换编译通过 | 必做，几乎零成本 |
| 多采样 | SWE-Dev Table 9：Self-Consistency +3.2 / +7.5。RealDevWorld Table 3：BoN-3 +0.18。Web-Bench 全文用 best-of-5。WatchPoint Table 1：带报错重试可比肩 best-of-5。Vibe Code Bench §5.3：生成侧方差占 73.5–92.5%。Commit0 Fig.5 | 有效，但选优的尺子要先对齐 |
| 规格长度 / 细化程度 / 上下文 | Tests as Prompt Table 9：prompt 翻倍就降。Commit0 Fig.4：塞前 10K 规格下降，检索更好。Constraint Decay Table 2：L0→L3 −27.5pp。WebCoderBench Table 5。ProjectEval Table 4。Asuka Fig.5。E2EDev：转述压缩导致细节失配。SWE-WebDevBench：金丝雀保留 17.7–97.7% | 长规格会丢指令和细节。应按模块切片，保留原文，不要总结改写 |
| 推理强度 | WebGameBench Table 1：V4-Flash 开 thinking 可用率 +3.4、优秀率 −1.2；V4-Pro +18.1。AppForge Table 3：GPT-5 从 low 到 high 为 2.97 → 14.85。Web-Bench Fig.12（只有图） | 对 Flash 收益小 |
| 迭代轮数 | WebGen-Agent Table 8：约 10 轮饱和。AppForge Fig.5：2–3 轮饱和。MSEval：3 轮拿到主要收益。TDDev 2025 Table 9：1–2 轮下跌、3 轮才回升 | 与 24 次调用的预算相容；关键是防回退 |

---

### 4. 映射到我们的流水线，3 天内可做的清单（按帮助 ÷ 成本排序）

我们的流水线分三步：G（一次调用生成整个应用）→ T（写 Playwright 自测）→ R（跑测试并用 SEARCH/REPLACE 修复，总共不超过 24 次调用）。

#### ① 规格字面契约 + 盲写测试（放在 G 之前和 T）

- **做法**
  - G 之前加 1 次调用，只做逐字抽取、不许改写。对每个场景抽出它的可观察契约：
    - 必须出现的精确文案：按钮、标题、空状态、错误提示。
    - URL 或路由。
    - 表单的 label 和 placeholder。
    - 列表内容、计数和顺序。
    - GIVEN 中的前置数据。
  - 抽出的契约存成 JSON。
  - G 的 prompt 把这份契约作为逐条硬约束，不用泛泛的提醒。
  - T 只根据 YAML 和契约写测试，不给它看实现：
    - 定位优先用 getByRole、getByLabel、getByText，文字与规格一致。
    - 不许用只在实现里才有的 id 或 class。
  - R 阶段禁止改测试里的规格字面量；需要改的应该是实现。
- **证据**：Tests as Prompt Table 8；WebApp1K Insights Figure 6 与 Table 5/6；MSEval Table 3；TDDev 2025 Table 8；E2EDev（data-testid 写进需求）；DevBench Table 5。
- **成本**：多 1–2 次调用，改 prompt。
- **风险**：契约抽错会把错误固化，所以只允许引用原文。
- **预期**：直接针对 96–98 对 20–25 的失配。这是唯一有机会让 GitHub 题大幅提分的一项。

#### ② 自测跑法对齐隐藏跑法（R 的运行环境）

- **做法**
  - 单 worker、每条测试 10 秒超时、同一个不重置的服务实例、按 YAML 顺序跑、不加 beforeEach 清库。
  - 测试里的前置数据按规格原样创建。
  - 应用要容忍已存在的同名数据（前面测试留下的）；不要预置会和规格场景冲突的种子数据。
- **证据**：没有直接消融，只有间接证据。
  - Vibe Code Bench 需要「每个工作流新开浏览器 + 唯一数据」才能避免状态泄漏。
  - MSEval Table 4：前置级联 11.0%，鉴权 11.9%。
  - Asuka Table 2：级联损失 6.0pp。
  - Web-Bench 和 WatchPoint 都描述了级联放大。
- **成本**：配置级改动，半天以内。

#### ③ 保留最佳快照 + 防回退/防删功能守卫（R）

- **做法**
  - 每次修复后跑全量自测。只有通过数不降、且之前通过的测试没变红，才接受这次修改。
  - 最终提交通过数最高的那个快照。
  - 守卫：代码行数、路由数、测试断言数都不能明显下降。
- **证据**：WebGen-Agent Table 2；TDDev ASE'26 Table 8；TDDev 2025 Table 9；PRDBench Table 4；AppForge Table 1。
- **成本**：低。

#### ④ 失败证据结构化 + 根因优先（R 的 prompt）

- **做法**
  - 收集失败时的 console error、pageerror、4xx/5xx 网络请求、服务端日志，以及失败时 DOM 的可访问性快照（文本形式）。
  - 按文档顺序，先修最早失败的前置场景。
  - 再加一步后端 API 冒烟：直接用 HTTP 调各个接口。
- **证据**：
  - FullStack-Agent Table 4：前端调试工具 +12.8，后端调试工具 +19.9。
  - Asuka Table 3：第 2 轮修复率高 3.6–17.8pp。
  - WatchPoint Table 2：弱模型恢复率从 45.1% 升到 57.6%；但强模型加诊断后 −6.8pp，要避免给出错误或无关的诊断。
- **成本**：低到中。

#### ⑤ 按模块切片喂规格（G 与 R 的上下文）

- **做法**
  - 修复时只给失败场景所在模块的 YAML 原文和相关代码。
  - 如果一次生成会丢功能，可以改成「先出骨架，再按模块分批补全」，仍在 24 次调用以内。
- **证据**：Commit0 Fig.4；Tests as Prompt Table 9；Constraint Decay Table 2；Vibe Code Bench §5.2（缺功能占 46.7%）；MSEval Table 4（缺功能占 23.8%）。
- **成本**：修复侧低；生成侧改成分批是中等成本，3 天内有风险。

#### ⑥ 一次成型多采样 2–3 份，用对齐后的自测选优（G）

- **证据**：RealDevWorld Table 3（0.60 → 0.78）；SWE-Dev Table 9（+3.2 / +7.5）；Vibe Code Bench §5.3（生成方差占大头）。
- **成本**：多 1–2 次调用，外加多跑几次测试。
- **前提**：先做 ①。否则还是在用失配的尺子挑选。

#### 顺手可试

- 生成调用开 thinking：WebGameBench Table 1 显示 V4-Flash 可用率 +3.4pp，预期小。
- 一次写全前先列出组件、文件和路由：E2EDev Table 3 中 GPT-Engineer 式做法比 Vanilla 高 1.7–6.3 分。

#### 看起来相关但不适用

- **截图/VLM 反馈**：模型看不见图，隐藏测试也不测外观；WebGen-Agent Table 2 中准确率只 +0.7。
- **用 GUI agent 当评判来自测**：隐藏测试是脚本化 Playwright 断言。GUI agent 会容忍文案差异，反而会掩盖失配。
- **用隐藏测试或真值报错重试**（Web-Bench Pass@2 +6.5~11.7、WatchPoint、Asuka 第 2 轮 +25pp、MSEval R2/R3）：运行时拿不到这些结果。
- **多角色多智能体框架**：E2EDev Table 3 中 MetaGPT 只有 0–5%；SWE-Dev Table 9 中 MapCoder 低于单模型。
- **训练类**（WebGen-LM、Step-GRPO、FullStack-Learn、WebGen-R1）：没法训练。
- **需求澄清或多轮用户反馈**（Asuka、ICAE、InteractWeb、SWE-WebDevBench）：比赛里没有用户可问。
- **lint 或静态审查反馈**：Commit0 Table 1 中 DeepSeek-V2.5 从 16.55 降到 11.61；DevBench Table 3 中纯评审没有增益；CAT Table 3 中静态审查 P-score 只有 10.6。
- **评测类基准**（WebCoderBench、WebCraftBench、ArtifactsBench、WebTestBench、SW-A²-Bench）：只给评测方法，或任务无关，没有生成技巧的消融。


---

# 3. 测试预言对齐与 LLM 写测试的可靠性（并行调研员 sub_B 原始笔记，已抽查关键数字）

> 原文件：`sub_B_oracle/notes.md`；原文 PDF/文本在同目录。

## sub_B_oracle：LLM 自生成测试与隐藏预言（hidden oracle）对齐 —— 文献笔记

调研日期 2026-09-27。所有数字都从原文 PDF 转文本后核对（`pdf/`、`txt/` 同目录），表号/图号为原文编号。
没读到原文的条目明确标「查不到」。映射到我们流水线的四个环节：**写测试 / 测试筛选 / 修复接受规则 / 选择最终版本**。

---

### 0. 结论先行

#### 0.1 我们的现象在文献里有几乎一模一样的对照实验

- **Tests as Prompt（WebApp1K，arXiv 2505.09027）表 8**：同一批模型生成的 React 应用，用固定测试（TDD，相当于隐藏预言）评，pass@1 只有 0.07–0.33；把失败的断言按代码实际输出回改（TLD，test-last，相当于"按自己实现写的自测"），pass@1 升到 0.64–0.89（例：llama-v3p1-405b 0.3020 → 0.8850，mixtral-8x22b 0.3074 → 0.8000）。
- **WebApp1K Insights（arXiv 2409.05177）图 6**：失败原因里 **Text Mismatch（HTML 文本/属性和测试期望对不上）占 28.3%**，Version Mismatch 32.8%，API Call Mismatch 16.3%。**表 6**：在提示里泛泛地写 "Make sure the text or test-id of UI elements match the test code"，这类错误的下降不超过 5%。原因是每个测试要的字符串都不同，泛化指令给不出具体字符串。
- 我们 GitHub 题"自测 96–98、隐藏 20–25"的形态和 TLD/TDD 的差距同构：自测断言了我们自己的实现，隐藏预言断言的是参考实现的表面细节（控件名、入口链接、可见文本、种子数据）。**结论：主要矛盾在测试从哪来，不在修复轮数。**
- 旁证：SWE-bench Verified 标注里，**61.1% 的样本被标为"单元测试可能把合法解判错"**，38.3% 标为题面欠规定（OpenAI 博客，经 GitHub 镜像读到原文，见 §33）。从参考实现推出来的隐藏测试天然会检查题面没写清的细节。

#### 0.2 可做技巧排序（预期帮助 ÷ 3 天实现成本）

| # | 技巧 | 环节 | 核心证据（表/图） | 成本 |
|---|---|---|---|---|
| 1 | 测试写手**只看规格和主办方风格样例，不看实现代码**；测试生成后**冻结**，修复只改应用 | 写测试 | AgentCoder 表 6/7；2410.21136 表 I；B4 §6.1；Tests-as-Prompt 表 8 | 改 prompt，几乎零成本 |
| 2 | 从 description 抽**具体例子成"UI 契约表"**（入口链接文字、role+accessible name、断言文本、种子账号/数据），**先喂应用生成（TDD）再喂测试写手** | 写测试 + 应用生成 | CodeT 附录 B 表 6；TDD 论文表 1/3；TiCoder 表 V；Insights 表 6 | +1 次调用，约 0.2–0.5 元 |
| 3 | 测试写手 few-shot 用**主办方公开基准里最相似的 2–4 条测试**（按场景检索） | 写测试 | CEDAR 表 I；SWT-Bench 表 5 | 低 |
| 4 | 修复只认**高置信失败**：k 份独立测试多数判失败才算、失败先复跑排除 flaky、断言须引用规格原文；保留回溯 | 测试筛选 + 修复接受规则 | UTDebug 表 2/8；Reflexion 表 2；CodeRM 表 2；TestGen-LLM | +2 次测试调用，运行时间 ×k |
| 5 | 若平台给逐场景隐藏结果：用历史提交算**自测判决 vs 隐藏判决的一致率（precision/recall）**当离线消融指标 | 评估 | ALGO 表 3（Agreement 指标）；HardTests 表 1/2；nl2postcond §2.1 | 零提交次数 |
| 6 | 终版选择不用"过的自测最多"，改为在快照间行为有差异的场景上，把**两边实际 DOM 文本 + 规格原文**交给 LLM 裁决 | 选择最终版本 | S* 表 3；CodeMonkeys 图 6；CodeT 表 13；B4 定理 3 | 中（每次裁决 1 次调用） |

证据迁移的边界：除 WebApp1K / E2E 类论文外，绝大多数数字来自函数级 Python 基准（HumanEval/MBPP/APPS），迁移到"100 场景 Playwright E2E"时效果量级不可直接照搬，只能当方向证据。

#### 0.3 看起来相关但不适用（一句话理由）

- CodeT / B4 / MBR-exec / AlphaCode 聚类：需要几十到上百个候选实现才有共识信号（B4 定理 4：CodeT 在候选少时变差）；同模型错误高度相关（Kim et al. 2025：两个模型都错时 60% 选同一个错答案），3 个应用变体撑不起共识。
- CURE / UTGen / CodeRM-8B：核心收益来自训练测试生成模型，我们只能调用 deepseek-v4-flash。
- TiCoder / ClarifyGPT：需要用户或参考实现回答澄清问题，我们没有。
- ALGO / HardTests / Differential Prompting / AlphaCode 的测试校验：需要可执行的参考实现或"多个正确解"来算期望输出，网页输出（文案、布局）不能直接比对相等。
- WebTestPilot / CATJudge / WebProber / AutoE2E：VLM 截图 + 运行时代理或功能发现，deepseek-v4-flash 看不见图，且运行成本和实现量超出 3 天。
- nl2postcond：只给出"简单断言更准、复杂断言更能区分"的写测试原则，本身不是可部署模块。

#### 0.4 成本估算口径

deepseek-v4-flash：输入 3 元/百万 token、缓存命中 0.1 元/百万、输出 9 元/百万。按每 1 万 token 算：未缓存输入 0.03 元、缓存输入 0.001 元、输出 0.09 元。假设一份 16 文件测试套件输出约 2–4 万 token，则每多生成一份约 0.2–0.4 元；规格前缀首次约 0.1–0.2 元、之后命中缓存可忽略。**每次提交 15 元预算下，token 成本不是约束，约束是 24 次调用上限和 Playwright 运行时长。**（规格和测试的实际 token 数我不知道，这是假设。）

---

### 1. 共识选择：多实现 × 多测试

#### 1. CodeT: Code Generation with Generated Tests（Chen et al., 2022）
- 链接：https://arxiv.org/abs/2207.10397
- 机制：同一模型生成 N 个解和 M 个测试（生成前删掉题面里的 I/O 例子）；执行所有配对；把"通过的测试集合相同"的解分成一组（consensus set）；组得分 = |解数|×|测试数|（实现里用 √|解数|，附录 A）；从最高分组选解。
- 数字：
  - 表 2：code-davinci-002 HumanEval pass@1 47.0 → 65.8（+18.8）；MBPP 58.1 → 67.7（+9.6）。
  - 表 3：APPS introductory 27.2 → 34.6；CodeContests 0.7 → 2.1。
  - **表 13（附录 I）**：只按"通过测试数"排（f″=|Sy|，即 MaxPass），code-cushman-001 pass@1 = 29.9，**低于随机基线 33.5**，比 CodeT 44.5 低 14.6；davinci-002 为 58.4（CodeT 65.8）。只按解数排（f′）：cushman 41.2、davinci-002 55.9。
  - **表 6（附录 B）**：题面里保留 I/O 例子时，CodeT pass@1 cushman 58.6（比删例子版 +14.1）、davinci-001 60.4（+10.2）、davinci-002 74.8（+9.0）。作者解释：生成的测试会照抄题面真实例子，测试质量大幅上升。
  - 表 5：只用 10 个测试，davinci-002 仍比基线高 9.5。
  - §4.4：cushman 在 164 题中有 53 题正确解存在但不在第一组，其中约 20% 归因于题面歧义等。
- 映射：选择最终版本（多个应用变体时）；更重要的旁证是表 6 —— **测试从规格的具体例子里取值，准确率跃升**，对应技巧 2；表 13 —— **按"过的自测最多"选版本在测试质量差时比随机还差**，对应技巧 6。
- 3 天成本/风险：完整 CodeT 需要多份完整应用（每份输出可能 5 万+ token，约 0.5 元一份，且占调用次数）；候选少时共识弱（见 B4 定理 4）；网页"功能等价"难定义。不建议整套照搬。

#### 2. AlphaCode: Competition-Level Code Generation（Li et al., 2022）
- 链接：https://arxiv.org/abs/2203.07814
- 机制：大规模采样 → 用题面例子测试过滤 → 用另训的测试输入生成模型产生输入，按输出行为聚类 → 从大到小每类选一个提交。
- 数字：
  - **表 2（假阳性率）**：CodeContests 原始测试（12.4 个/题）假阳性 62%；加入变异生成的测试（203.7 个/题）后 4%；HumanEval 30%；APPS 60%。变异测试的期望输出由 30 个正确解一致投票确定（§3.2.1）。
  - 表 9 / §4.5：题面例子测试过滤掉 99% 以上样本。
  - 表 8：加聚类后 10@100K 从 21.5% 到 24.1%，10@1M 从 24.2% 到 28.4%。
- 映射：假阳性率数据直接解释"自测高、隐藏低"—— 测试稀疏或放水时假阳性可达 60%。题面例子过滤 ≈ 用规格具体例子写的测试当第一道闸。
- 成本/风险：聚类要海量样本，不可行；"30 个正确解投票定期望输出"我们没有正确解。

#### 3. MBR-exec: Natural Language to Code Translation with Execution（Shi et al., 2022）
- 链接：https://arxiv.org/abs/2204.11454
- 机制：在少量测试输入上执行所有候选（不需要期望输出），选与其他候选输出分歧最小的（0/1 损失的最小贝叶斯风险）。
- 数字（表 2）：MBPP 47.3（greedy）/47.7（sample）→ 58.2；Spider 50.8/48.5 → 63.6；NL2Bash 52.8/53.0 → 58.5。
- 映射：选择最终版本。
- 成本/风险：需要多候选；网页的"执行输出"是 DOM 文本，措辞不同即判不等，损失函数难设计。不适用。

#### 4. B4: Towards Optimal Assessment of Plausible Code Solutions with Plausible Tests（Chen et al., ASE 2024）
- 链接：https://arxiv.org/abs/2409.08692
- 机制：在贝叶斯框架下，最优选择 = 通过矩阵 E 下"哪些解/测试正确"的后验最大；近似为 4 个 Beta 函数打分，先验：错误解通过错误测试的概率 θ0 很小。
- 数字：
  - 表 1：相对最强启发式 CodeT 平均提升 +6.1%～+7.5%（discriminative problems）、+10.1%～+12.0%（hard problems）；APPS competition hard：CodeT 16.0 → B4 24.0（+50%），随机 7.0（+246%）。
  - 表 1 中 MaxPass（选过测试最多的解）经常弱于 CodeT，甚至低于随机（HumanEval CodeGen：MaxPass 28.6 vs 随机 32.5）。
  - 定理 3：MaxPass 的准确率随错误解数量增加指数趋 0；定理 4：CodeT 要求正确解占比高，候选少时变差。
  - **§6.1 局限**：假设 2（解与测试独立生成）在"把生成的代码作为输入去生成测试"时被破坏；模型误读题意时，错误测试恰好匹配错误解，θ0 上升。
- 映射：理论上解释了我们的失配 —— 测试是看着我们的实现写的，θ0（错误测试放行错误实现）很高，任何"数自测通过数"的规则都会失效。支持技巧 1 与技巧 6。
- 成本/风险：打分本身很便宜（400×400 矩阵 <1 秒，表 2），但需要多候选，同 CodeT。

---

### 2. LLM 测试断言的是实际行为还是期望行为；测试有效性

#### 5. Do LLMs generate test oracles that capture the actual or the expected program behaviour?（Konstantinou, Degiovanni, Papadakis, 2024）
- 链接：https://arxiv.org/abs/2410.21136
- 设置：GPT-3.5-turbo，24 个 Java 仓库；任务一是判断给定断言对错（classification），任务二是生成断言（generation）。
- 数字：
  - **表 I**：对"正确断言"的判对率，代码正确时 40.77/46.26/45.39%（三种 prompt），代码被变异成 bug 时降到 31.94/36.80/37.01%（降 8.4–9.5 点）。作者结论：模型的判断跟着实际实现走，而不是期望行为。
  - 表 II：把测试名和变量名换成 EvoSuite 式无意义命名，判对率最多降 16.10 点（44.00% → 27.90%）。
  - 表 IV：生成的断言约 57.47–60.01% 能在程序上通过；每个前缀生成 5 条时，至少 1 条通过的比例 89.34–93.76%。
- 映射：写测试。测试写手看到我们的实现代码，就会断言我们实现的实际文案、路由和结构，自测自然全绿。用规格里的业务词命名测试和变量，有助于模型写出"期望行为"断言。
- 成本/风险：只是 prompt 上下文的取舍，成本为零；风险是看不到实现后测试的定位器更依赖对规格的猜测，初始失败会增多。

#### 6. AgentCoder（Huang et al., 2023）
- 链接：https://arxiv.org/abs/2312.13010
- 机制：程序员 agent、测试设计 agent、执行 agent 分离；测试设计 agent 只看需求，不看代码。
- 数字（GPT-3.5-turbo）：
  - **表 6**：同一 agent 先写代码再在同一会话写测试，测试准确率 61.0%（HumanEval）/ 51.8%（MBPP）；独立测试设计 agent 为 87.8% / 89.9%。
  - **表 7**：pass@1 单 agent 71.3 / 61.6 / 79.4 / 59.1（HE / HE-ET / MBPP / MBPP-ET），多 agent 79.9 / 77.4 / 89.9 / 89.1。
  - 表 4：与代码一起生成的测试准确率 GPT-3.5-turbo 47.0 / 57.2，CodeCoT 67.1 / 79.0，AgentCoder 87.8 / 89.9。
  - 作者解释（§4.7）："the tests designed by the same agent that generates the code can be biased by the code and lose objectivity"。
- 映射：写测试。**与技巧 1 最直接对应**。
- 成本/风险：函数级任务，数字可能偏乐观（测试设计 prompt 做过工程化）；迁移到 E2E 的量级未知。

#### 7. Reflexion（Shinn et al., 2023）
- 链接：https://arxiv.org/abs/2303.11366
- 数字：
  - **表 2**（GPT-4）：MBPP Python 基线 0.80，用自生成测试做反思后反而降到 0.77；自测假阳性（测试全过但解是错的）率 16.3%。HumanEval Python 假阳性只有 1.4%，Reflexion 0.80 → 0.91。
  - 表 3（HumanEval Rust 最难 50 题）：去掉测试生成、只做自我反思，0.52，低于基线 0.60。
- 映射：修复接受规则。自测假阳性会让修复循环提前宣布完成，自测全绿就停手，等同于我们 96–98 分时不再修。
- 成本/风险：只是解释机制。

#### 8. No More Manual Tests? ChatTester（Yuan et al., FSE 2024）
- 链接：https://arxiv.org/abs/2305.04207
- 数字：表 2：ChatGPT 生成的单测 42.1% 能编译、24.8% 能通过执行；表 4：执行失败中 85.5% 是断言错误，作者逐一人工检查，全部是断言本身写错，不是被测代码有 bug。
- 映射：测试筛选 / 修复接受规则。自测失败有相当比例是测试写错，按它去改应用可能改坏。
- 成本/风险：只是解释机制。

#### 9. TestChain: LLMs as Test Case Generators（Li & Yuan, 2024）
- 链接：https://arxiv.org/abs/2404.13340
- 机制：把"测试输入生成"和"期望输出计算"拆给两个 agent，后者通过 Python 解释器逐步计算期望输出。
- 数字：表 2：GPT-4 在 LeetCode-no-exp 测试准确率 57.95 → 71.79，HumanEval-no-exp 84.63 → 90.24；表 3：只拆分、不接解释器 61.54（+3.59）。失败类型以 Assertion Error 为主（图 7）。
- 映射：写测试。E2E 版本：先写"导航 + 操作"步骤，再单独一步给每个断言填期望值，期望值只能从规格原文摘取。
- 成本/风险：+1 次调用；只拆分的收益小（+3.59）。

#### 10. CodeRM-8B: Dynamic Scaling of Unit Tests for Code Reward Modeling（Ma et al., 2025）
- 链接：https://arxiv.org/abs/2501.01054
- 数字：**表 2**（HumanEval+，策略模型 Llama3.1-8B）：**单条 LLM 测试**把正确解判错的比例（FRR）为 Llama3.1-8B 46.13%、Llama3.1-70B 34.51%，放行错误解的比例（FAR）13.66% / 11.10%；Llama3.1-70B 的 100 条测试多数投票组合后准确率 73.65 → 78.30，FRR 降到 25.97。图 1：测试数增加时 best-of-N 持续上升，难题上收益更大（图 3）。
- 映射：测试筛选。单条自测失败不能直接当修复信号，至少要聚合。
- 成本/风险：训练部分不可用；聚合思想可用（技巧 4）。

#### 11. HardTests（He et al., 2025）
- 链接：https://arxiv.org/abs/2505.24098
- 机制：输入分三类（直接生成 / 随机 / 针对"可能错误写法"的 hacking 输入），期望输出由多个 oracle 程序计算（两个 oracle 在 >90% 输入上一致才采用）。
- 数字：摘要：相比已有测试，precision +11.3 点、recall +17.5 点，难题 precision 最多 +40 点；**表 5**：用低质量测试（TACO）做 RL，Qwen3-4B pass@1 38.48 → 36.95（变差），用 HardTests 39.42；表 8：无 oracle 的测试生成假阳性率 AceCoder 32.49% vs HardTestGen 17.67%。
- 映射：评估（precision/recall 指标，技巧 5）；"列出可能的错误实现，再写能区分它们的测试"可迁移为"列出应用可能偏离规格的方式（按钮文案不同、首页无入口、缺种子数据），写能抓住这些偏离的测试"。
- 成本/风险：oracle 程序我们没有；hacking 思路只在规格把正确答案写死时才有用，否则等于逼应用去贴一个猜测。

#### 12. TestGen-LLM at Meta（Alshahwan et al., FSE 2024）
- 链接：https://arxiv.org/abs/2402.09171
- 机制：生成的测试依次过滤：能构建 → 5 次执行全部通过（非 flaky）→ 增加覆盖率，过不了就丢。
- 数字（摘要）：75% 能构建，57% 可靠通过，25% 增加覆盖率；73% 的推荐被工程师采纳。
- 映射：测试筛选。Playwright 测试的 flaky 失败不应进入修复循环：失败先复跑确认。
- 成本/风险：只多花运行时间。

---

### 3. 规格 → 测试的保真度

#### 13. nl2postcond（Endres, Fakhoury, Chakraborty, Lahiri, FSE 2024）
- 链接：https://arxiv.org/abs/2310.01831
- 机制与指标：把自然语言意图转成后置条件断言。**test-set-correctness**：断言在参考实现上对所有参考测试输入都成立；**bug-completeness**：能区分多少变异体（错误实现）。
- 数字：
  - 表 1：GPT-4 accept@1：base prompt 0.63，simple prompt（只要求刻画一个方面）0.77；提示里给不给参考实现，accept@1 无显著差异（p = 0.42）。
  - 表 2：bug-completeness 平均分 GPT-4 base 0.85、simple 0.52；给参考实现时 bug-completeness 平均高 5%（p = 0.06），作者定性分析认为是生成了"复述参考实现"的后置条件。
- 映射：写测试 + 评估。**简单断言更可能与预言一致，复杂断言更能抓错，二者要权衡。** 隐藏测试风格本身就是"导航 + 点击 + 断言可见文本"的简单断言，我们的自测应模仿这种粒度，但断言的字符串要来自规格。两个指标可直接拿来衡量自测质量（技巧 5）。
- 成本/风险：原则性指导，零成本。

#### 14. TiCoder（Lahiri et al. 2022；Fakhoury et al. 2024 期刊扩展版）
- 链接：https://arxiv.org/abs/2208.05950 ，https://arxiv.org/abs/2404.10100
- 机制：生成候选代码和测试 → 按区分度给测试排序 → 让用户确认测试对错（PASS/FAIL）或给出正确输出（OUTPUT）→ 据此剪枝和排序代码。离线实验用参考实现模拟用户（理想化上界）。
- 数字（期刊扩展版 2404.10100）：
  - 表 IV：GPT-4-32k MBPP pass@1 67.13 → 81.56（1 次 PASS/FAIL 交互）→ 83.70（5 次）；OUTPUT 模式 84.78（1 次）。text-davinci-003 MBPP 49.16 → 68.04（PASS/FAIL 1 次）/ 77.00（OUTPUT 1 次）。摘要报告 5 次交互内平均绝对提升 45.97%（正文 §VII 写 45.73%，原文前后不一致）。
  - **表 V**：把已验证测试直接放进生成提示：GPT-4-32k MBPP 67.13 → 78.26（1 条测试）→ 80.88（全部测试）；HumanEval 60.72 → 65.25 → 70.39。
- 映射：我们没有用户，规格里的具体例子是唯一的"用户回答"。技巧 2（契约表进提示）对应表 V。
- 成本/风险：交互部分不可用（无裁判）。用 LLM 充当裁判不可靠（见 §5 表 I，判对率 40–46%）。

#### 15. Test-Driven Development for Code Generation（Mathews & Nagappan, 2024）
- 链接：https://arxiv.org/abs/2402.13521
- 数字：表 1（GPT-4）：MBPP 69.67 → 82.45（+12.78，提示里给测试）→ 87.71（+5.26，再按测试失败修复）；HumanEval 78.66 → 87.81（+9.15）→ 93.30（+5.49）；CodeChef 23.00 → 26.09 → 30.27。表 3（Llama 3）：MBPP 46.37 → 75.94（+29.57）→ 84.96。
- 映射：应用生成。**测试（或契约）先行进入应用生成提示。** 这里的测试是人写的正确测试；我们的契约若抽错，会把错误同时带进应用和测试。
- 成本/风险：+1 次调用抽契约；风险是抽取错误相关地污染双方。

#### 16. Tests as Prompt / WebApp1K（Cui, 2025）与 WebApp1K Insights（2024）
- 链接：https://arxiv.org/abs/2505.09027 ，https://arxiv.org/abs/2409.05177
- 设置：React 单页应用，测试（Jest + Testing Library + fetch mock）作为提示和验证。
- 数字：
  - **2505.09027 表 8（TLD 实验）**：只做单语句范围的回改（改文本/属性期望、改 mock、回退 React 版本），pass@1：llama-v3-70b 0.3323 → 0.6400，mixtral-8x22b 0.3074 → 0.8000，llama-v3p1-405b 0.3020 → 0.8850，llama-v3p1-8b 0.2512 → 0.7550，mixtral-8x7b 0.1269 → 0.7300，llama-v3p1-70b 0.1027 → 0.7900，llama-v3-8b 0.0679 → 0.6500。表 7：Text Mismatch 归因于 in-context learning 能力。
  - **2409.05177 图 6**：错误类型分布 A Version Mismatch 32.8%、B Text Mismatch 28.3%、C API Call Mismatch 16.3%、D Uninstalled Module 11.8%，E/F/G 各约 3.4–3.7%。§4.2：93% 的错误日志只有一个错误或同类的两个错误（常指向同一行）。**表 6**：针对 B 类的提示 "Make sure the text or test-id of UI elements match the test code" 减错不超过 5%。
- 映射：**解释我们失配的最直接证据**。即使测试就在提示里，文本不匹配仍是主要失败类型；泛泛指令无效，必须把每个元素要的字符串逐条写进契约（技巧 2）。
- 成本/风险：解释机制，零成本。

#### 17. WebTestPilot（Teoh et al., FSE 2026）
- 链接：https://arxiv.org/abs/2602.11724
- 机制：把自然语言需求拆成（condition, action, expectation）步骤，每步生成前置/后置条件断言；断言只能引用"符号化"的 GUI 元素（通过 DSL），支持跨状态的数据/因果/时间依赖（例：加入购物车后条目数 +1、小计等于单价之和）；断言生成失败可重试。
- 数字：表 4：缺陷检测 precision 0.96、recall 0.96，基线 PinATA 0.26 / 0.69；23 个真实 GitHub 缺陷检出 22 个（PinATA 15 个）。图 1：5 个主流 LLM（含 DeepSeek）各问 10 次"购物车里只有一件商品吗"，共给出 7 种不同答案 —— LLM 当运行时裁判不稳定。
- 映射：写测试。GIVEN/WHEN/THEN → 前后置断言的写法可借鉴（例如"创建仓库后列表多出同名条目"这类状态差断言）。
- 成本/风险：系统本体依赖 VLM 截图和运行时代理，3 天内不可行；只借写法。

#### 18. AutoE2E: Feature-Driven End-To-End Test Generation（Alian et al., ICSE 2025）
- 链接：https://arxiv.org/abs/2408.01894
- 机制：爬取运行中的应用，用 LLM 推断"功能"并排序，生成功能级 E2E 测试；提出 E2EBench 与 feature coverage 指标。
- 数字：平均 feature coverage 79%，最佳基线 Crawljax 12.0%（+558%）。
- 映射：不适用 —— 我们的功能和场景已由 YAML 给定，它解决的是"从应用中发现功能"。

#### 19. Acceptance Test Generation with LLMs: An Industrial Case Study（Ferreira et al., AST 2025）
- 链接：https://arxiv.org/abs/2504.07244
- 机制：用户故事 → Gherkin 场景（AutoUAT）→ 结合页面 HTML 生成 Cypress 脚本（Test Flow），GPT-4 Turbo。
- 数字（摘要）：AutoUAT 场景 95% 被认为有帮助；Test Flow 生成的测试 60% 直接可用、8% 小修、24% 需补充输入后重新生成、8% 丢弃。
- 映射：写测试。它把页面 HTML 给测试生成器以拿到正确选择器；这正是我们要避免的偏置来源（测试贴合自家实现）。我们的场景下，选择器应来自规格词汇和主办方风格（getByRole/getByLabel + 不区分大小写正则）。
- 成本/风险：只作为反例提醒。

#### 20. Baseline Evaluation of LLM-Facilitated UI Test-Case Generation from Gherkin Specifications（Springer 2025）
- 链接：https://link.springer.com/chapter/10.1007/978-3-032-04288-0_3
- **查不到**：Springer 需要登录，未读到全文和数字。

---

### 4. 测试噪声对修复的影响与防护

#### 21. UTGen / UTDebug: Learning to Generate Unit Tests for Automated Debugging（Prasad et al., COLM 2025）
- 链接：https://arxiv.org/abs/2502.01619
- UTDebug 机制：
  1. 输出侧 test-time scaling：同一测试输入采样 8 个带推理的期望输出，多数投票；只保留最终答案得票 "over 50% of the votes (i.e., 4 votes)" 的测试（原文措辞），其余丢弃。
  2. 验证 + 回溯：每轮生成 n 个测试，用其中一个给修复反馈，**只有修改后在整套生成测试上的通过率提高才接受**，否则撤销。
- 数字：
  - 表 1 / 表 4：攻击率（能让错误代码失败）与输出准确率此消彼长。**DeepSeek-V3** 按"让错误代码失败"提示生成测试：攻击率 54.31%，期望输出准确率 58.04%；随机生成：24.31% / 63.53%。GPT-4o 类似（54.51% / 60.39%）。即便前沿模型，针对性测试的期望值也有约四成是错的。
  - **表 2**（3 轮 UTDebug）：Qwen2.5-32B 在 MBPP+Fix (Hard) 上，不用测试 32.94，用随机生成测试 **22.94（掉 10 点）**，prompted 测试 40.59，UTGen 45.29。**低质量测试反馈会把代码修坏，即使已经有回溯保护。**
  - 表 9：同设置下用 CodeT 式（不看代码、独立生成）测试调试为 29.41，也低于不用测试的 32.94。
  - **表 8（消融，Qwen2.5-7B，MBPP+Fix）**：去掉输出多数投票，随机测试 −4.0、UTGen −11.4；去掉回溯，−2.2 / −3.2。
  - 表 5：GPT-4o 做修复者，MBPP+Fix (Hard)：不用测试 34.71，prompted 测试 45.88，UTGen 测试 59.69。
- 映射：修复接受规则 + 测试筛选。我们的"每丢 1 条至少多过 3 条"是比 UTDebug 更严格的回溯规则，方向正确。可补：**期望值多数投票**（k 份测试草稿里多数一致的断言才保留，或 k 份里多数失败才算失败）。
- 成本/风险：k=3 时多 2 次测试生成调用（约 0.4–0.8 元）+ 3 倍测试运行时长；同模型采样错误相关，投票只能去掉随机噪声。

#### 22. CURE: Co-Evolving LLM Coder and Unit Tester via RL（Wang et al., NeurIPS 2025 Spotlight）
- 链接：https://arxiv.org/abs/2506.03136
- 机制与理论：RL 共同训练写码与写测试，无需真值代码。**定理 3.1**：用"通过的生成测试数"当奖励时，当且仅当 μ = p_u(1−p01) − (1−p_u)p00 > 0，奖励精度随测试数 m 收敛到 1，且下界约 1 − e^(−μ²m/8)。p_u 为测试正确率，p01 为错误解通过正确测试的概率，p00 为错误解通过错误测试的概率。
- 数字：表 1：Qwen2.5-7B-Instruct 生成测试准确率 LiveBench 26.5、MBPP 35.8、LiveCodeBench 28.6、CodeContests 26.7、CodeForces 18.9；训练后 ReasonFlux-Coder-7B 为 54.8 / 79.4 / 57.7 / 62.6 / 45.6。平均测试准确率 +37.8%、单次写码 +5.3%、BoN +9.0%。§4.2.6：用"全对才给分"的简单奖励时 p01 = 42.2%、p00 = 14.7%，CURE 奖励下 36.5% / 9.1%。
- 映射：不可用（要训练）。理论可当诊断：**测试写手看着实现写，p00 被推高，"数通过数"的信号可能 μ ≤ 0，越多测试越误导。**
- 成本/风险：训练不可行。

#### 23. S*: Test Time Scaling for Code Generation（Li et al., 2025）
- 链接：https://arxiv.org/abs/2502.14382
- 机制：并行采样 + 基于公开测试的迭代调试；选择阶段对候选两两比较，让 LLM 生成能区分二者的输入，**实际执行两边**，再让 LLM 看真实输出裁决（不预测期望输出）。
- 数字：**表 3**（LiveCodeBench v4，N=8）：平均 pass@1：只用公开测试 53.8；按"通过生成测试最多"选 53.1（没有提升）；LLM 直接裁判 55.6；adaptive input synthesis 57.5。作者解释：生成测试的期望输出有错，噪声抵消了收益。图 6：调试时额外加生成测试不稳定提升。
- 映射：选择最终版本（技巧 6）：在应用快照之间找行为不同的场景，给 LLM 看两边的真实页面文本和规格原文，由它裁决。
- 成本/风险：每次裁决 1 次调用；需要实现"两个快照都跑一遍同一场景并抓 DOM 文本"。

#### 24. CodeMonkeys（Ehrlich et al., 2025）
- 链接：https://arxiv.org/abs/2501.14723
- 数字：**图 6**（SWE-bench Verified，每题 10 个候选）：随机选 45.8%；用模型生成测试多数投票 53.0%；直接让模型选 52.0%；投票取前 3 再让模型选 55.6%；投票取前 3 再用可写新测试的选择状态机 57.4%；oracle 上界 69.8%。
- 映射：选择最终版本。投票做粗筛、LLM 带执行证据做细选，只追回随机与 oracle 之间约一半差距。
- 成本/风险：状态机式选择要多轮调用，3 天内可做简化版（单轮裁决）。

#### 25. Agentless（Xia et al., 2024）
- 链接：https://arxiv.org/abs/2407.01489
- 机制：复现测试采样 40 份，保留在原仓库上确实复现问题的，规范化后**选出现次数最多的一份**；补丁选择先过回归测试，再过复现测试，最后多数投票。
- 数字：**表 4**（SWE-bench Lite 300 题）：只多数投票 77（25.67%）→ 加回归测试 81（27.00%）→ 加复现测试 96（32.00%）。
- 映射：测试筛选（同一场景多份测试取众数）+ 修复接受规则（先守住回归，再看新增）。
- 成本/风险：取众数需要对 Playwright 测试做规范化比较，实现量中等；更省事的替代是"k 份测试的多数失败才算失败"。

#### 26. SWT-Bench（Mündler et al., 2024）
- 链接：https://arxiv.org/abs/2406.12952
- 设置：只看 issue 描述和原代码库生成复现测试，要求在原代码失败、在金标准修复后通过。
- 数字：
  - **表 5**：给测试生成器看金标准补丁或看错误补丁，成功率 S 同为 10.5%（都不给为 8.1%）；**给出应放测试的那个测试文件（风格和上下文），S 从 8.1% 升到 15.1%**。
  - §5.3：用生成测试过滤 SWE-Agent 的修复，precision 升到 47.8%（翻倍以上），recall 只有 20%。
  - 表 2：单次 ZeroShotPlus S = 9.4%，5 选 1 的 pass@5 为 20.3%。
- 映射：写测试。**测试风格上下文比实现代码更重要**，支持技巧 3；另说明"实现可见会带偏测试"的证据并不一致（这里看错误补丁没有让 S 变差）。
- 成本/风险：低。

#### 27. Otter（Ahmed et al., 2025）
- 链接：https://arxiv.org/abs/2502.05368
- 数字（摘要）：只从 issue 描述生成 fail-to-pass 测试，Otter 31.4%，5 个集成（Otter++）37.0%；SWE-Agent+ 19.2%。
- 映射：测试筛选。规格 → 测试与隐藏参考对齐的成功率本来就不高，集成 5 份有 +5.6 点。
- 成本/风险：同技巧 4。

#### 28. CEDAR: Retrieval-Based Prompt Selection for Code-Related Few-Shot Learning（Nashid, Sintaha, Mesbah, ICSE 2023）
- 链接：https://people.ece.ubc.ca/amesbah/resources/papers/cedar-icse23.pdf （无 arXiv）
- 数字：**表 I**（断言生成，与开发者原断言完全一致率 EM）：zero-shot 0.00%，随机 1-shot 44.41%，随机 8-shot 50.57%，按嵌入检索相似示例 75.79%，按词频检索 76.55%。
- 映射：写测试（技巧 3）。与"隐藏参考断言"对齐最接近的实证：**给出与当前任务最相似、来自同一分布的示例，断言与参考的完全一致率提升约 26 点。** 对我们，就是从主办方公开基准里检索与当前场景最相似的测试放进测试写手提示。
- 成本/风险：低；Codex 时代、Java 断言，量级不能直接迁移。

---

### 5. 用参考实现 / 多数实现做预言

#### 29. Differential Prompting（Li et al., ASE 2023）
- 链接：https://arxiv.org/abs/2304.11686
- 机制：从被测程序推断意图 → 按意图生成 2 个参考实现 → 生成输入，参考实现输出不一致的输入丢弃 → 一致的输出当期望值 → 与被测程序做差分测试。
- 数字：图 3（QuixBugs）：找到正确的失败诱导测试成功率 75.0%，直接问 ChatGPT 28.8%，Pynguin 7.5%；表 III（Codeforces）：66.7%（最佳基线的 4.0 倍）。74.6% 的参考实现是"好的"。
- 映射：用多实现一致性当预言。网页场景下两个独立应用的文案必然不同，无法做等值比较；可退化为"两个独立测试草稿对同一场景的期望文本是否一致"来识别歧义场景。
- 成本/风险：完整做法不适用。

#### 30. ALGO（Zhang et al., NeurIPS 2023）
- 链接：https://arxiv.org/abs/2305.14591
- 机制：让 LLM 写暴力枚举的参考实现当 oracle（比写高效解容易得多），用它生成期望输出、验证候选。
- 数字：oracle 正确率 88%（摘要；表 1 暴力解成功率 LeetCode 88.5%、CodeContests 72.0%）；**表 3**：测试集与官方评测结论的一致率（Agreement），题面例子 57.39% vs ALGO 94.78%（CodeContests）；表 4：同一 coder 1@20，用例子测试 4.4%、ChatGPT 生成测试 6.8%、ALGO 测试 12.0%。
- 映射：评估（Agreement 指标即技巧 5）；"更简单的参考物"在我们这里对应"从规格抽出的契约表"，比整个应用容易写对。证据间接。
- 成本/风险：参考实现本身不适用于网页。

#### 31. ClarifyGPT（Mu et al., 2023）
- 链接：https://arxiv.org/abs/2310.10996
- 机制：采样多个解并在生成输入上执行，输出不一致即判需求有歧义 → 生成澄清问题 → 用户回答后改写需求。
- 数字（摘要）：人评实验 GPT-4 在 MBPP-sanitized 70.96% → 80.80%；模拟用户下 GPT-4 四个基准平均 68.02% → 75.75%，ChatGPT 58.55% → 67.22%。
- 映射：不适用 —— 需要用户回答。可借"不一致 = 歧义"的检测思路，把精力集中到歧义场景的规格原文上。

---

### 6. 背景与边界证据

#### 32. Correlated Errors in Large Language Models（Kim et al., ICML 2025）
- 链接：https://arxiv.org/abs/2506.07962
- 数字：350+ 个模型，在一个排行榜数据集上，两个模型都答错时 60% 选了同一个错误答案（摘要、图 1）；越准的模型错误越相关，即使架构和厂商不同。
- 映射：所有"多数投票 / 共识"技巧的上限。同一个 deepseek-v4-flash 的多次采样，对同一句模板化空话的误读会高度一致，投票只能去掉随机噪声。

#### 33. SWE-bench Verified（OpenAI 博客，2024-08）
- 链接：https://openai.com/index/introducing-swe-bench-verified/ （直连 403；原文经 GitHub 镜像 irthomasthomas/undecidability#933 读到）
- 数字：38.3% 样本被标为题面欠规定；61.1% 被标为单元测试可能把合法解判错；综合 68.3% 被过滤。
- 映射：说明"从参考实现推出的隐藏测试"会检查题面没写清的细节；我们能做的是让表面细节尽量贴近"最可能的参考实现选择"—— 即规格原文用词。

#### 34. Are "Solved Issues" in SWE-bench Really Solved Correctly?（PatchDiff，Wang, Pradel, Liu, ICSE 2026）
- 链接：https://arxiv.org/abs/2503.15223
- 数字（摘要）：29.6% 的 plausible 补丁与金标准补丁行为不同；7.8% 的补丁被判通过但其实没过开发者完整测试；综合使报告的解决率虚高 6.4 个百分点。
- 映射：通过自家（或弱）测试 ≠ 与参考行为一致；差分测试需要参考实现，我们没有。

#### 35. CATJudge / CATTest: Code-Driven Agentic Testing in Web Development（Hong et al., 2026-08）
- 链接：https://arxiv.org/abs/2609.00081
- 数字：表 1：最强模型（Claude-Opus-4.7）找 bug 的 R-score 只有 42.57；表 3：只做静态代码审查、不开浏览器时 P-score 10.60（大量误报），用 Playwright 驱动浏览器时 38.30。
- 映射：修复目标应来自真实执行结果，而不是让 LLM 读代码"找问题"。
- 成本/风险：框架本身依赖 VLM，不适用。

#### 36. 其他读过但判定低相关
- Large Language Models for Automated Web-Form-Test Generation（arXiv 2405.09965）：关注表单测试能否成功提交，与预言对齐无关。摘要：解析器处理后的 HTML 作上下文时成功提交率平均 70.63%，原始 HTML 60.21%。
- WebProber: AI Agents for Web Testing: A Case Study in the Wild（arXiv 2509.05197）：VLM 代理探索 120 个网站，报告的问题中 85% 是误报（§4.2）。

---

### 7. 具体落地建议（按技巧编号，供实现者参考）

1. **测试写手输入**：YAML 全文（或当前需求子树）+ 主办方风格规则 + 2–4 条检索来的官方样例测试；不放应用源码、不放应用 DOM。测试一经生成即冻结，修复阶段的 SEARCH/REPLACE 只允许改应用；若测试有语法或运行时错误，只允许修错误本身、不许改断言的字符串。
2. **契约表**（一次调用，JSON）：每个场景给出 `entry_path`（从首页起的链接/按钮文字序列）、`controls`（role + 规格原文名）、`expect_visible`（规格原文里出现的具体字符串）、`seed`（规格点名的种子账号/数据）。每一项必须附规格原文引用（quote），没有引用的项标低置信。先把契约表喂给应用生成，再喂给测试写手。
3. **一致率离线评估**：如果历史提交能拿到逐场景隐藏结果，就在历史应用上跑新旧两套自测，算 precision（自测判过的场景中隐藏也过的比例）和 recall（隐藏失败的场景中自测也判失败的比例）。当前 GitHub 题：自测过 96–98、隐藏过 20–25，意味着自测对隐藏失败的 recall 极低。
4. **修复只认高置信失败**：失败先复跑 1 次排除 flaky；同一场景 k=3 份独立测试，多数失败才进修复队列；保留现有"丢 1 需多过 3"的回溯规则。
5. **终版选择**：保存每个被接受的快照；最后在快照之间自测结论不同的场景上，抓两边真实页面文本，连同规格原文交给 LLM 选择，不用"过的自测最多"。
6. **风险提醒**（工程经验，非文献结论）：给控件加同义词或重复文案可能触发 Playwright strict mode（同一正则匹配多个元素时 click 报错），会把原本能过的隐藏测试弄挂。契约表应让每个页面上的关键 accessible name 唯一。


---

# 4. 自修复的极限与测试时扩展（并行调研员 sub_C 原始笔记）

> 原文件：`sub_C_repair/notes.md`；原文 PDF/文本在同目录。

## sub_C：自修复的极限，与代码生成的测试时扩展（多采样 / 选择 / 修复怎么配）

调研日期 2026-09-27。下文数字都从原文 PDF 核对过：用 pdftotext 转成文本后逐表读，表号、图号沿用原文。两处来源是博客，已在对应位置注明。原文的 PDF 和 TXT 都放在本目录（`*.pdf` / `*.txt`）。
"推断"标签表示这是我把论文结论映射到我们场景时做的推导，不是论文原话。

---

### 0. 一页结论

#### 0.1 核心判断

1. **修复和选择能走多远，取决于反馈（验证器）的质量，和修复轮数关系不大。** 这是几篇论文的共同结论：
   - Olausson 表 1：把 GPT-4 自己写的反馈换成人写的反馈，修复成功率从 33.3% 升到 52.6%，是原来的 1.58×。
   - Large Language Monkeys：没有自动验证器时，多数投票和奖励模型在约 100 个样本处就饱和了。
   - CodeMonkeys 图 6：选择方法只追回了随机选择与 oracle 之间约一半的差距。
   - R2E-Gym：多数题目里，生成的测试只有不到 20% 能区分对错补丁。
2. **我们的问题主要是假阳性（FP）。** 自写测试通过 96–100 条，隐藏测试只过 20–25 条（GitHub 题）或 78–82 条（表格题）。这说明自写测试基本发现不了隐藏测试会判失败的缺陷，也就是召回低、区分度低。在这种情况下，多修几轮没有目标可修；拿自写测试做 best-of-N 选择，所有候选都差不多是满分，选不出差别。这和 Reflexion 在 MBPP 上的情形一样：FP 率 16.3%，最终 77.1 反而低于基线 80.1（表 1、表 2）。
3. **自写测试的反馈一旦出错，修复会把代码改坏。** Revisit Self-Debugging 表 2：用模型自己生成的测试做 post-execution 修复，HumanEval 上所有模型都下降，例如 Claude-3.5 带 detail 反馈从 94.5 降到 87.2（−7.3），HE+ 降 9.7。表 7：自生成测试从 10 条加到 20 条，整套测试全对的比例从 59.15% 降到 48.17%，修复结果随之变差（表 8）。
4. **修复收益集中在前 1–3 轮。**
   - Self-Debugging 图 6a：一轮之后再修，提升不到 0.1%。
   - S* 图 6：2–3 轮后进入平台。
   - LDB 图 3：Self-Debugging 约 2 轮后就不再提升。
   - DDI：2–3 次尝试内损失 60–80% 的修复效力。
   - WebGen-Agent 表 8（DeepSeek-V3）：迭代 6 次得 50.2，迭代 20 次得 52.6。
5. **整应用做 best-of-N，收益上限由"不同样本之间整体隐藏分的波动"决定**（推断）。SWE-bench 上 best-of-N 收益大，是因为 500 个 issue 各自独立选择。我们一道题只有一个应用，只能整体选一次。从已观察到的分数区间看（GitHub 20–25、表格 78–82），假设标准差约 2 分，即使用完美选择器，best-of-4 的期望增益也只有约 1.03σ ≈ +2 分，best-of-8 约 +2.8 分。选择器不完美时还要乘上它与隐藏分的相关系数。
6. **计分公式下的盈亏平衡（推断，纯算术）。** S ∝ p^1.1 / c^0.1。费用变成原来的 m 倍时，通过率要变成原来的 m^(1/11) 倍才能保持 S 不变：

   | m | 1.25 | 1.5 | 2 | 3 | 4 |
   |---|---|---|---|---|---|
   | 盈亏平衡所需通过率倍数 | 1.020 | 1.038 | 1.065 | 1.105 | 1.134 |

   反过来，费用砍半而 p 不变，S 提升 2^0.1 − 1 ≈ 7.2%；费用砍到 1/3，S 提升 11.6%。所以如果修复在隐藏测试上几乎没有收益，把它去掉本身就能提分。另外，这个平衡点对 p=0.8 的表格题约束很严（费用翻倍要多过约 5 条），对 p≈0.22 的 GitHub 题几乎没有约束。

#### 0.2 按"预期隐藏收益 ÷ 3 天实现成本"排序

| # | 做法 | 出处与证据 | 成本 / 风险 |
|---|---|---|---|
| 1 | **先用 1 次提交做消融**：一次成型不修复（或只修运行时错误），对比现行流水线；同时把修复上限压到 2–3 轮 | Revisit 表 2/4/8；Reflexion 表 1/2；E2EDev 表 3/8（应用级：OpenHands 39.25、SWE-Agent 40.83，都低于 Vanilla 的 45.95）；Self-Debugging 图 6a；S* 图 6；DDI | 开发成本约为零，占 1 次提交。可能损失少量真修复。收益有两部分：一是看清修复到底值不值，二是降费用直接抬 S |
| 2 | **修复只接受"可信信号"**：JS 异常、页面崩溃、console error、导航 404、YAML 字面写明的元素或文案找不到。**严格锚点**：之前通过的测试一条都不能丢。结束时**回滚到最佳检查点** | Revisit 表 5（in-execution 反馈 +0.6 到 +2.6，post-execution 为负）；AlphaCodium test anchors；UTDebug 表 8（去掉回溯 −3.2）；WebGen-Agent 表 2（加上回溯和选最优，49.9→52.6）；Snell（不加选择时约 38% 的正确答案被改错） | 约半天。风险是漏掉只有断言才能发现的真 bug。收益估计 +0 到 +2 分 |
| 3 | **先提高反馈质量，再去修或选**：同一场景独立生成 K 版测试，多数一致才算失败或通过；测试严格照抄 YAML 里的字面文案和元素名 | UTDebug 表 8（去掉输出投票 −11.4）；R2E-Gym（多跑 5 次测试 rollout 得 49.3，多跑 5 次编辑 rollout 只得 48.4）；Olausson §4.2 与表 1；Commit0 表 1（真实测试反馈 17.8→29.3）；WebGen-Agent（反馈模型就是评测模型 Qwen2.5-VL-32B） | 1–1.5 天，要和 lit-oracle 协同。GitHub 题上潜在收益最大，但不确定性也最高 |
| 4 | **混合选择器**：先按执行结果（锚点通过数）取前 k，再让 LLM 对照 YAML 把几个候选放在一起比较（list-wise），可以附一段"区分性交互"脚本的真实运行结果 | R2E-Gym（纯执行 43.7、纯免执行 42.8，混合 51.0）；CodeMonkeys 图 6（前 3 过滤后用模型选 55.6、用状态机选 57.4，投票 53.0）；S* 表 3（自适应区分输入 57.5，生成测试 53.1）；OAgents 结论 3 | 1–1.5 天。R2E-Gym 指出免执行的评判器会偏向代码风格，flash 模型做评判的偏差风险更大 |
| 5 | **小 N（3–4）整应用并行生成，按共识选择**：几套测试的结果汇总起来，优先选"被多数应用一致通过的测试"通过得最多的应用 | CodeT 表 2（47.0→65.8，函数级 n=100）；AlphaCode 表 8（加聚类后，10@1K 为 −0.2，10@1M 为 +4.2）；Agentless 表 4；Trae 表 2（去掉多数投票 −4.14） | 每多一个应用约 0.3 元加上测试运行时间（估算）。收益上限约 +2 分（见 0.1 第 5 条）。Trae 图 1 显示选择器弱时 N 越大反而越差 |
| 6 | **停滞就重新开始**：同一处失败连续 2 次修不好，就从规格重新生成那一块，或整体重新采样，不再在旧上下文里接着修 | DDI 表 2（例如 deepseek-coder-v2 在同样预算下 84.1→92.1）；Olausson 图 3（n_fr=1、增大 n_p 最好）；CodeMonkeys §2.2 | 约半天。我们的自测已经 96–100%，很少会触发停滞，所以预期收益低 |

#### 0.3 看起来相关、但对我们不适用

- **Large Language Monkeys 在 SWE-bench Lite 上从 15.9% 到 56%**：这是 coverage，也就是用隐藏测试当 oracle 算出的 pass@250，并不是能实际选出来的分数。我们没有 oracle。
- **SWE-Gym verifier、OpenHands critic、R2E-Gym 的 execution-free verifier、WebGen-Agent Step-GRPO**：都需要训练模型，3 天内做不了，而且我们只能调用 deepseek-v4-flash。
- **Commit0 的交互反馈增益（17.8→29.3）**：反馈来自真实评测单测，我们的自写测试和隐藏预言对不上，不可比。
- **Olausson 和 Self-Debugging 报告的修复增益**：前者假设能执行全部测试（脚注 2），后者的可见测试本身正确，都比我们的条件好，增益不能照搬。
- **Reflexion 的 HumanEval 91%**：Revisit 指出它在修复前用隐藏的 oracle 测试做了评估，数字偏乐观；而且是函数级。
- **AlphaCode 的聚类**：规模是 10^5–10^6 个样本；N≤8 时"最大簇"信号很弱。
- **Snell 的计算最优比例**：数学题上，用了专门训练的修正模型和 PRM。
- **Anthropic Claude 4 的并行测试时计算（72.5→79.4）**：选择用的是内部评分模型，拿不到。

---

### 1. 决策规则：什么时候多采样，什么时候修复

| 规则 | 来源 | 内容 | 映射到我们（推断） |
|---|---|---|---|
| R1 | Olausson 图 3/4、§4.1 | 反馈是模型自己给的时候，预算应该优先花在初始样本数 n_p 上，每个样本只修 1 次（n_fr=1）。修得太深会输给重新采样：GPT-3.5 APPS 在 (n_p=1, n_fr=10) 时只有基线的 0.83×，GPT-4 在 (2, 10) 时 0.97×。只有反馈比生成更强（更强的模型或人）时，修复才在所有预算下都赢 | 我们的反馈就是"同一模型写的测试"，属于修复赢不了重采样的那一类 |
| R2 | Revisit 表 2/4、图 2；Reflexion 表 2 | 自测失败有多可信，取决于基础通过率。基础题上，自测判失败的多半是假阴性，修复有害；难题上（LiveCodeBench Medium），只给通过/失败标签可以有 +8.0。反馈只给标签，比给"期望值 vs 实际值"细节更稳 | 表格题真实通过约 80%，自测失败更可能是测试写错了，应该少修，至少只给标签。GitHub 题的问题是自测根本不失败 |
| R3 | Snell 图 7 | 简单题适合纯顺序修订；难题有一个最优的"顺序:并行"配比，且配比随难度变 | 方向上：表格题（高 p）适合短链精修加选最优；GitHub 题（低 p）需要多样性，但前提是有选择信号 |
| R4 | DDI 表 1/2 | 修复效力随尝试次数指数衰减。到达 t_θ（通常 2–3 次）就应该重新开始，而不是继续修 | 修复上限设 2–3 轮，停滞就重新开始 |
| R5 | CodeMonkeys 图 5、§2.2 | 前几轮串行迭代影响最大；再往后，成本相同的串行和并行配置 coverage 相近。并行会带来选择难题，一条很深的串行轨迹则没有这个问题 | 没有好选择器时，用"短串行 + 保留最佳检查点"；有了好选择器再考虑并行 |
| R6 | Trae 图 1、表 2 | 随机选的期望不随 N 变，oracle 上限随 N 升；现有选择器只比随机好 1–3 个点，N 大了反而下降。先去重，再用回归测试过滤，缩小候选集 | N 保持小（3–4）；先按锚点和去重过滤，再选 |
| R7 | LLMonkeys §4.1、图 7 | 没有自动验证器时，多数投票和奖励模型在约 100 个样本处饱和 | 没有贴近隐藏预言的信号之前，加大采样量没有意义 |

---

### 2. 逐篇笔记

#### 2.1 Olausson et al., "Is Self-Repair a Silver Bullet for Code Generation?"（ICLR 2024）
- 链接：https://arxiv.org/abs/2306.09896
- **机制**：流程是生成 n_p 个程序，执行，由反馈模型写解释，每个失败程序再生成 n_fr 个修复。比较时让不修复的 i.i.d. 重采样用同样的样本预算。**假设能执行全部测试**（脚注 2：We assume access to the full set of tests in executable form），也就是反馈来自 oracle，条件对修复最有利。
- **数字**：
  - 图 3（APPS，右侧热力图，数值是"修复 / 同预算重采样"的通过率比）：
    - GPT-4：(n_p=10, n_fr=1) 为 1.05；(25, 1) 为 1.08；(2, 10) 为 0.97；(1, 10) 为 0.90。
    - GPT-3.5：(1, 10) 为 0.83；(25, 1) 为 1.04。
    - 正文结论：固定 n_fr、增大 n_p，相对收益持续上升；固定 n_p、增大 n_fr，额外成本不划算，预算小时还会降。
  - §4.1：APPS 上 GPT-4 最多比基线高 8%；GPT-3.5 在竞赛级题上相对提升最多 34%；HumanEval 上 GPT-3.5 接近天花板，最多 +3%。
  - §4.2 与图 5：用更强模型写反馈（Code Llama 用 GPT-3.5/4 的反馈，GPT-3.5 用 GPT-4 的反馈），在所有预算下都超过对应基线和自修复。
  - 表 1：修复成功率，GPT-4 自写反馈 33.30%，人写反馈 52.60%（1.58×）；竞赛级题 3.67% 对 14.67%。
  - §4.3 定性分析：GPT-4 的反馈明显不准确的有 32/80，人写的只有 7/80；GPT-4 从不表达不确定，人有 7/80 会表达。
  - 附录表 2：GPT-3.5 在 APPS 上总体修复成功率 4.7%，用 GPT-4 写反馈后 11.5%。
- **对我们的含义**：
  1. 在最有利的 oracle 测试条件下，自修复相对重采样也只有 ≤8% 的优势，预算小时甚至为负。我们的反馈源是失配的自写测试，条件更差。
  2. 预算应该偏向"更多、更多样的初始样本"，每个只修 1 次；24 次调用的深修复链是反模式。
  3. 真正能放大修复效果的是反馈质量。flash 模型写的失败解释可能也不准，可以考虑只给结构化事实（失败的场景、DOM 快照、console），不让模型自由写病因。
- **3 天成本 / 风险**：结论可以直接落成配置（缩短修复链）。风险在于这是函数级、oracle 测试下的结论，外推到应用级有不确定性。

#### 2.2 Chen et al., "Teaching Large Language Models to Self-Debug"（Self-Debugging，ICLR 2024）
- 链接：https://arxiv.org/abs/2304.05128
- **机制**：rubber-duck 式自解释，加上单测执行结果或执行 trace，进行多轮修复。MBPP 的设置是题面给 1 条可见测试，另外 2 条隐藏（正文第 387 行附近）。最多 10 轮，成功的修复大多在 3 轮内结束。
- **数字**：
  - 表 2(c) MBPP：GPT-4 基线 72.8，加 UT 反馈 80.6，再加解释 80.4，加 trace 80.2；Codex 61.4 → 69.4 / 69.8 / 70.8。
  - 表 2(b) TransCoder：GPT-4 77.3 → 88.8（UT）→ 90.4（+解释）。
  - 表 3（不执行单测，纯自评）：MBPP 上 Codex 的 Simple 反馈 57.6，**低于**基线 61.4；GPT-4 从 72.8 到 76.0。正文说，没有单测时模型对初始程序过度自信。
  - 图 6a（Spider）：一轮修复通常就够，之后提升不到 0.1%；对贪心解码做 self-debug，能追平 16 个样本的基线。附录 C.1（TransCoder）：主要提升来自第一轮，约 +12%。
- **对我们的含义**：Self-Debugging 的可见测试本身是**正确**的，增益来自可信反馈。没有可执行的可信反馈时（表 3），弱反馈甚至会让分数下降。第一轮之外的修复几乎是白付费。
- **成本 / 风险**：低。结论支持把修复链截短到 1–2 轮。

#### 2.3 LDB（Zhong et al., "Debug like a Human"，ACL Findings 2024）
- 链接：https://arxiv.org/abs/2402.16906
- **机制**：把程序切成基本块，对失败的可见测试记录每个块前后的变量状态，让 LLM 逐块判断对错再修复。这是 in-execution 反馈，不依赖"期望输出"。
- **数字**：
  - 表 1：各数据集、各骨干模型上最多 +9.8；StarCoder 上 SD(+Expl.) 在 HumanEval −0.6，LDB +0.6。
  - 表 2（HumanEval，用 GPT-3.5 做调试器）：GPT-3.5 生成的种子 73.8，SD 修到 81.1，LDB 修到 82.9；GPT-4 种子 87.2 → 88.4 / 89.6；Reflexion 种子 91.5 → 92.1 / 95.1。
  - 图 3：Self-Debugging 约 2 轮后几乎不再提升，重复采样约 3 轮后同样停住；LDB 能持续涨，附录图 7 显示 20 轮后到 84.1%（DDI 引用：后 15 轮合计只多了 2.4%）。
- **对我们的含义**：Web 应用里对应的运行时信息是 Playwright trace、console error、失败那一步的 DOM 快照和网络请求。这些是"事实"，不依赖测试写的期望值对不对，可以作为唯一可信的修复触发信号（配合 0.2 第 2 条）。
- **成本 / 风险**：采集 console、DOM 快照成本低，半天可做。块级 trace 不适用于前端。

#### 2.4 Reflexion（Shinn et al., NeurIPS 2023）
- 链接：https://arxiv.org/abs/2303.11366
- **机制**：模型自己生成单测（最多 6 条），执行后写自我反思，下一轮带着反思重新生成。
- **数字**：
  - 表 1：HumanEval-PY 91.0（GPT-4 基线 80.1）；**MBPP-PY 77.1，低于 GPT-4 基线 80.1**。
  - 正文和表 2：MBPP-PY 自测的 FP 率 16.3%，HumanEval 只有 1.4%。FP 会让错误程序提前"提交"。
  - 表 3（HumanEval-Rust 最难的 50 题）：基线 0.60；只反思不跑自测 0.52（低于基线，原因是"做了有害编辑"）；只跑自测不反思 0.60；完整 Reflexion 0.68。
  - 注意：Revisit（2.10）指出 Reflexion 在修复前用隐藏的 oracle 测试做了评估，91% 偏乐观。
- **对我们的含义**：这正是我们的 FP 场景。自测通过就停手，而隐藏测试判失败。FP 率决定了这类方法的天花板。自测和隐藏测试失配是结构性问题，不是加轮数能解决的。
- **成本 / 风险**：没有新东西可以直接做。它提供的是"为什么修复没用"的证据。

#### 2.5 Brown et al., "Large Language Monkeys: Scaling Inference Compute with Repeated Sampling"（2024）
- 链接：https://arxiv.org/abs/2407.21787
- **机制**：重复采样，用 coverage（pass@k）衡量。在有自动验证器的领域，coverage 能直接变成分数。
- **数字**：
  - 摘要和图 2：SWE-bench Lite 上 DeepSeek-Coder-V2 1 个样本 15.9%，250 个样本 56%（当时单样本 SOTA 43%）。**这是 coverage**，靠 repo 的测试套件做 oracle 判定。
  - 表 1（Moatless Tools）：DeepSeek 5 次尝试的 coverage 29.62%、共 $10.8；GPT-4o 1 次 24.00%、$39；Claude 3.5 1 次 26.70%、$51。
  - §4.1 与图 7：没有自动验证器时（GSM8K/MATH），多数投票、RM best-of-N、RM 加权投票都在约 100 个样本处饱和。MATH 上 Llama-3-8B 的 coverage 从 82.9%（100 个样本）升到 98.44%（10k），但选出来的分数只从 40.50% 升到 41.41%。
  - §4.2.1：SWE-bench Lite 有 11.3% 的题测试是 flaky 的；CodeContests 的测试会把一些正确解判错（假阴性）。
- **对我们的含义**：coverage 很高，但没有贴近隐藏预言的验证器，就兑现不了。"便宜模型多采样胜过贵模型单采样"这个结论，也要以验证器存在为前提。
- **成本 / 风险**：不适用（见 0.3）。

#### 2.6 S*（Li et al., "S*: Test Time Scaling for Code Generation"，2025）
- 链接：https://arxiv.org/abs/2502.14382
- **机制**：
  - 生成阶段：并行 16 个样本，每个样本只用**题面公开测试（ground truth）**迭代调试 2 轮。
  - 选择阶段：对两两候选，让 LLM 生成能区分二者的输入，实际执行，再把真实输出交给 LLM 判断哪个对（adaptive input synthesis）。LLM 不需要预测期望输出。
- **数字**：
  - 表 1（LiveCodeBench v2）：Qwen2.5-Coder-32B 零样本 47.4、多数投票 55.9、自调试 59.5、S* 70.1；GPT-4o-mini 40.9 / 46.6 / 51.7 / 61.3；R1-Distill-32B 69.1 / 75.8 / 70.1 / 85.7（推理模型上自调试不如多数投票）。
  - 表 2（CodeContests）：gpt-4o-mini 零样本 9.1，S* 23.0，oracle 选择 28.5。
  - 表 3（LCB v4，N=8，四种选择策略的平均）：只用公开测试 53.8；**用生成测试打分 53.1（没有提升）**；LLM 评判 55.6；自适应区分输入 57.5。作者的解释是，生成测试里的期望输出有错，在区分力差的输入上会引入大量噪声。
  - 图 6：调试时再加入模型生成的测试，结果不稳定；收益在 2–3 轮后进入平台。
- **对我们的含义**：
  1. 公开测试（已知正确）用来调试，生成测试不要用来打分。
  2. 选择时让 LLM 看真实行为，不要让它预测期望值。放到应用上，就是对两个候选跑同一段"区分性交互"脚本，把两份 DOM 文本或截图交给 LLM，对照 YAML 判断哪个更符合。
  3. 我们的"公开测试"最接近的是 YAML 里的字面文案和元素（推断）。
- **成本 / 风险**：区分性交互选择约 1–1.5 天。风险：flash 模型当评判的可靠性未知；交互脚本本身也可能写错。

#### 2.7 CodeMonkeys（Ehrlich et al., 2025）
- 链接：https://arxiv.org/abs/2501.14723
- **机制**：SWE-bench Verified 上跑 10 个并行状态机，每个最多 8 轮，边写补丁边写复现测试。选择时先用这些生成测试投票取前 3，再用一个能额外写区分测试的"选择状态机"定稿。
- **数字**：
  - 图 6：随机选 45.8；按生成测试多数投票 53.0；直接让模型选 52.0；前 3 过滤后模型选 55.6；前 3 过滤后用选择状态机 **57.4**；oracle（coverage）69.8。选择只追回了随机到 oracle 之间约一半的差距。
  - 图 5：前几轮串行迭代影响最大；之后成本相近的串行和并行配置 coverage 相近。正文强调并行会带来选择难题，而串行不会。
  - 表 1：总成本 $2291.90，其中生成编辑占 59.6%，选择占 5.8%。
  - "Barrel of Monkeys"：把多家提交汇总，coverage 80.8%，选出来 66.2%，随机选 60.9%。
  - 附录 A：在 100 题子集上，DeepSeek-V3 用很少的钱达到 Claude 多数投票分数的 86.8%；Claude 45.74%，比 DeepSeek-V3 的最好成绩高 6.02 分。
- **对我们的含义**：
  1. 纯"生成测试投票"比随机高 7 分左右，是因为 SWE-bench 各题独立、题与题之间差异大。我们整应用只选一次，上限小得多（0.1 第 5 条）。
  2. "测试过滤前 k + 模型选"的组合比单独任何一种都好，这是可以借鉴的形状。
  3. 两段式分工值得借：先写测试，再写编辑，而且编辑阶段允许修测试（"two-sided debugging"），前提是测试要能先在"空应用"上失败。
- **成本 / 风险**：做全套偏重。"前 k 过滤 + LLM list-wise 选择"约 1 天。

#### 2.8 AlphaCode（Li et al., Science 2022）
- 链接：https://arxiv.org/abs/2203.07814
- **机制**：大规模采样后，先用题面样例测试过滤（去掉约 99%），再用学出来的输入生成器造新输入，按行为聚类，从大簇到小簇依次各取一个提交（共 10 次提交）。依据是"正确解的行为倾向一致，错误解各错各的"。
- **数字**：
  - 表 9：不到 1% 的样本能通过样例测试（例如 41B 模型平均 0.73%）；约 10% 的题一个都过不了。
  - 表 8（构建式消融）：加聚类后，10@10K 从 17.3 到 18.0，10@100K 从 21.5 到 24.1，10@1M 从 24.2 到 28.4。
  - 图 8：不做过滤时，解出率不随样本数上升；过滤加聚类之后离 pass@k 上限仍有很大差距。
  - 另一点：生成的输入即使无效，也能用来给程序分组。
- **对我们的含义**：
  1. "先用已知正确的样例过滤"最有价值。对我们来说就是 YAML 的字面约束，是规格里本来就有的测试，不是模型重新解读出来的测试。
  2. 行为聚类要海量样本才有意义，N≤8 基本不适用。但"按行为一致性给测试加权"这个思想可以用在 CodeT 式共识上（2.14）。
- **成本 / 风险**：聚类本身不适用。按字面约束过滤约半天（与 lit-oracle 重叠）。

#### 2.9 AlphaCodium（Ridnik et al., 2024）
- 链接：https://arxiv.org/abs/2401.08500
- **机制**：
  - 先在公开测试（已知正确）上迭代，把通过的测试设为锚点（anchor）。
  - 再逐条在 AI 生成的测试上迭代：失败就修，但修后必须仍通过所有锚点；新通过的 AI 测试也加入锚点。AI 测试从易到难排序，尽早攒下锚点。
  - AI 测试生成后还要做一次 double validation：让模型重新生成并纠错。
- **数字**：表 1（CodeContests，pass@5）：GPT-4 验证集从直接 prompt 的 19% 到 44%，测试集从 12% 到 29%；DeepSeek-33B 验证集 7% 到 20%。论文**没有**单独消融 test anchors。附录 C 列出几条无效做法：注入执行 trace、注入之前 K 个失败解、注入上次的 diff，都没有提升。
- **对我们的含义**：我们现在的规则是"丢 1 条至少多过 3 条"，是软锚点。AlphaCodium 用的是硬锚点，再加上"先在可信测试上修、后在 AI 测试上修"的顺序。对我们更关键的是锚点从哪里来：应该用通过的、而且可信度高的测试（YAML 字面约束，或多版本测试一致认可的测试）。
- **成本 / 风险**：把接受规则改成对高可信锚点零容忍，约 2 小时。风险是真修复被一条错的锚点挡住，所以锚点要可信，不能把所有通过的测试都当锚点。

#### 2.10 Chen et al., "Revisit Self-Debugging with Self-Generated Tests for Code Generation"（ACL 2025）
- 链接：https://arxiv.org/abs/2501.12793
- **机制**：模型从规格自生成 10 条测试，比较两种修复范式。post-execution 看"期望 vs 实际"，或者只看通过/失败标签；in-execution 只看中间运行状态，不告诉模型测试结论。
- **数字**：
  - 表 1（用 oracle 测试）：修复都在涨，例如 GPT-4o 的 MBPP+ 从 76.5 到 83.1（detail，2 轮）。
  - 表 2（用自生成测试，post-execution）：
    - HumanEval 上 GPT-4o 的 detail 反馈第 1 轮 89.0（−3.1）；Claude-3.5 的 detail 反馈 87.2（−7.3），HE+ 第 2 轮 79.3（−9.7）；LLaMA-3-70B 用 label 反馈 HE+ 65.2（−8.6）。
    - MBPP 先涨后跌。
  - 表 3：自生成测试"整套全对"的比例只有 44.50%–59.15%；单条测试的输出正确率 84.69%–89.77%。
  - 图 2：在 HumanEval/MBPP 上，自测给出的"失败"更多是**假阴性**（程序其实是对的）。
  - 表 4（LiveCodeBench）：GPT-4o 用 label 反馈，Medium 从 33.1 到 41.1（+8.0），总体 46.0 到 49.3；Claude detail 第 2 轮总体 55.8 到 49.3（−6.5）。
  - 表 5（in-execution）：GPT-4o 的 MBPP+ 76.5 → 77.8 → 79.1；多数模型小幅上升，个别下降（LLaMA 在 MBPP+ 上 −1.6）。
  - 表 7 与表 8：自测从 10 条加到 20 条，整套全对比例从 59.15% 降到 48.17%，post-execution detail 修复在 HumanEval 上从 −3.1 变成 −4.3；in-execution 始终为正。
- **对我们的含义**：这是"错误测试反馈导致回归"最直接的数字证据。
  1. 基础通过率高的任务（表格题）上，自测失败多半是测试错，detail 反馈会把模型往错的方向拉。
  2. 测试写得越多，套件整体越不准。我们 16 个文件、上百条断言，整套全对的概率会更低。
  3. 应该改用运行时事实做反馈（in-execution），或者只给标签。
- **成本 / 风险**：把修复提示从"期望 X 实际 Y"改成"场景 S 失败 + console / DOM 事实"，约 2 小时，风险低。

#### 2.11 Adnan & Kuhn, "The Debugging Decay Index"（2025）
- 链接：https://arxiv.org/abs/2506.18403
- **机制**：用指数衰减 E(t)=E0·e^(−λt) 拟合"每次修复尝试的边际效力"，由此算出应该重新开始的时刻 t_θ。重新开始的做法是清空对话，只保留原题重新生成，预算不变。
- **数字**：
  - 摘要：多数模型在 2–3 次尝试内损失 60–80% 的修复效力。
  - 表 2（HumanEval，6 次尝试预算）：A0 表示连续修复，A50/A80 表示在 t50/t80 重新开始。deepseek-coder-v2:16b 84.1 → 92.1 / 90.2；llama3.1:8b 72.6 → 82.3；mistral 54.3 → 62.8；codestral 89.0 → 88.4 / 91.5（有一格下降）。
  - 相关工作段引用 PyCapsule：GPT-4 在第 3 次、GPT-3.5 在第 4 次修复效力就基本耗尽。
- **对我们的含义**：同一上下文里反复修，边际收益很快趋近零。停滞时应该换一个新样本（换思路），而不是继续给同一段代码打补丁。不过这是函数级、oracle 测试下的结论。
- **成本 / 风险**：半天。我们的自测已经接近满分，很少会停滞，预期收益低。

#### 2.12 Prasad et al., "Learning to Generate Unit Tests for Automated Debugging"（UTGen / UTDebug，COLM 2025）
- 链接：https://arxiv.org/abs/2502.01619
- **机制**：UTDebug 用两招应对噪声测试。
  - 对同一测试输入采样 k=8 个期望输出，多数投票；得票不过半（少于 4 票）的测试直接丢弃。
  - 每轮用 1 条测试的失败做修复，但只有目标测试修好、**并且整套生成测试的通过率上升**，才接受这次修改，否则回溯。
- **数字**：
  - 表 8（Qwen2.5-7B，MBPP+Fix，3 条测试 × 3 轮）：UTGen 37.54；去掉输出投票 26.15（−11.4）；去掉回溯 34.38（−3.2）。随机采样的测试是 34.77，去掉两招分别 −4.0、−2.2。
  - 摘要：配合 UTDebug，Qwen2.5-32B 在 HumanEvalFix 上比其他 LLM 生成单测的基线高 3.17 以上，在 MBPP+ 较难的调试子集上高 12.35 以上；用它生成的测试给 GPT-4o 做调试反馈，提升 13.8%。
- **对我们的含义**：
  1. "期望值多数投票"放到 E2E 上，可以变成同一场景独立写 K=3 份测试，场景判定取多数。成本低：测试生成便宜，只是运行时间变成 3 倍。
  2. 我们的接受规则已经接近 UTDebug 的"整套通过率上升才接受"，而且对回归加了 3 倍权重，比 UTDebug 更严，方向对。问题不在规则，在于"整套"本身就是失配的代理。
- **成本 / 风险**：K 份测试投票约半天；风险是运行时间成倍增加。

#### 2.13 Snell et al., "Scaling LLM Test-Time Compute Optimally…"（2024）
- 链接：https://arxiv.org/abs/2408.03314
- **机制**：用训练过的修正模型和 PRM/ORM，在 MATH 上比较顺序修订和并行 best-of-N 的配比。
- **数字**：
  - §6.1：朴素做法下，约 38% 原本正确的答案会在后续修订中被改错，所以必须用验证器或多数投票在修订链内选最优。
  - 图 7：简单题纯顺序修订最好；难题存在最优的"顺序:并行"配比；按难度分配最多可以省 4 倍计算。
  - 附录 K 图 16：换成用 ReST^EM 训练的修正模型后，追加顺序修订**明显有害**。
- **对我们的含义**：
  1. 修订链必须带"选最优"，不能默认最后一版最好。
  2. 高 p 的表格题更适合短链精修，但只有反馈可信才成立。
- **成本 / 风险**：结论层面的借鉴，不涉及实现。

#### 2.14 CodeT（Chen et al., ICLR 2023）
- 链接：https://arxiv.org/abs/2207.10397
- **机制**：同时采样 n 个程序和大量生成测试，做 dual execution agreement：按"通过相同测试的程序集合"组成共识集，打分为程序数 × 测试数，从最高分的共识集里选。这样即使有错测试也比较稳，因为错测试很少被很多独立程序同时通过。
- **数字**：
  - 表 2（code-davinci-002）：HumanEval pass@1 从 47.0 到 65.8；MBPP 从 58.1 到 67.7。
  - 图 4：统计了测试准确率和 toxic 测试率（错误程序能过、正解过不了的测试）。
- **对我们的含义（推断）**：共识打分的思想是：一条测试被越多独立生成的应用通过，就越可能是对的；一个应用通过越多高共识测试，就越可能好。这可以用在 0.2 第 5 条上。但函数级 n=100 的规模，和我们 N=3–4 的整应用差距很大。
- **成本 / 风险**：共识打分是纯脚本，约半天；主要成本是生成 N 个应用、每个跑全部测试的运行时间。

#### 2.15 Agentless（Xia et al., 2024）
- 链接：https://arxiv.org/abs/2407.01489
- **机制**：
  - 采样多份补丁。
  - 复现测试也采样多份，先在原仓库上验证能输出 "Issue reproduced"，再把测试规范化后取出现次数最多的那份。
  - 选择时先保留回归测试失败最少的补丁，再要求通过复现测试（如果所有补丁都过不了，就退回只用回归测试），最后对规范化后的补丁做多数投票。
- **数字**：
  - 表 4（SWE-bench Lite）：只做多数投票 77（25.67%）；加回归测试 81（27.00%）；再加复现测试 96（32.00%），平均每题多花 $0.25。
  - 图 6：样本数到 40 左右进入平台，原因是多数投票下后来的样本很难翻盘。如果把所有样本都算上，能解 126 题（42.0%）。
- **对我们的含义**：
  1. 测试先要在已知状态下验证过才能用。复现测试必须先在原仓库上失败；对我们来说，就是自写测试至少应该在空页面上失败。这能挡住永远通过的空洞测试，正好对应我们的 FP 问题（推断）。
  2. 候选测试之间也做多数投票。
  3. 采取保守的回归过滤，并留好兜底。
- **成本 / 风险**：给自写测试加"空应用上必须失败"的检查约 2 小时，成本低，能直接降 FP。

#### 2.16 SWE-Gym（Pan et al., ICML 2025）
- 链接：https://arxiv.org/abs/2412.21139
- **机制**：用 SWE-Gym 轨迹训练一个 32B 的 ORM verifier，对 k 条 OpenHands 轨迹打分取最高（Best@k）。
- **数字**：图 3（SWE-bench Verified）：Pass@k（oracle）从 20.6 升到 37.8（k=8）、42.8（k=16）；Best@k（用 verifier 选）从 20.6 升到 29.8@8、32.0@16。LoRA 训练的 verifier（29.8@8）比全参微调（27.2@8）好。
- **对我们的含义**：即使有专门训练的 verifier，Best@k 也只兑现了 Pass@k 增益的一部分（k=16 时 32.0 对 42.8）。我们没有训练条件。
- **成本 / 风险**：不适用。

#### 2.17 OpenHands critic（博客，2025-04-17）
- 链接：https://www.openhands.dev/blog/sota-on-swe-bench-verified-with-inference-time-scaling-and-critic-model
- **机制**：用 Claude 3.7 Sonnet 在 temperature 1.0 下跑多条轨迹。critic 是基于 Qwen2.5-Coder-32B 用 TD 学习训练的（终局奖励为测试是否全过，γ=0.99），对轨迹打分后取最高。
- **数字**：单条轨迹 60.6%，5 条 66.4%，大致呈 log-linear。博客没有给出 2–4 条的数字，也没有和多数投票比较。
- **对我们的含义**：需要训练 critic，不适用。只能作为"并行 + 学出来的选择器"在仓库级有效的旁证。

#### 2.18 Anthropic Claude 4 发布说明（2025）
- 链接：https://www.anthropic.com/news/claude-4
- **机制**：并行多次尝试，丢掉破坏仓库可见回归测试的补丁（类似 Agentless 的拒绝采样，不使用隐藏测试信息），再用内部评分模型选最好的。
- **数字**：SWE-bench Verified 上 Opus 4 从 72.5% 到 79.4%，Sonnet 4 从 72.7% 到 80.2%。
- **对我们的含义**：说明"先用可信回归信号过滤，再用评分模型选"这个结构在仓库级有效。评分模型拿不到。

#### 2.19 R2E-Gym（Jain et al., 2025）
- 链接：https://arxiv.org/abs/2504.07164
- **机制**：对比两类 verifier。execution-based 是测试 agent 生成测试，再加回归测试；execution-free 是训练出来的轨迹评判器。混合方式是：先按免执行分数取前 n，再按执行分数排序，免执行分数用来打破平局。
- **数字**：
  - 两类单独使用时，Best@26 分别在 43.7%（execution-based）和 42.8%（execution-free）进入平台；混合后 51.0%（表 4、图 4）。
  - 图 5：多数题目里，不到 20% 的生成测试能区分对错补丁；少数题目中 toxic 测试（让错补丁过、正确补丁挂）占比最高到 10%。
  - 图 8 与正文：只用回归测试 47.4；加生成测试 51.0；Agentless 的测试 48.8；Top-n 过滤把 49.8 提到 51.0，能缓解 toxic 测试的影响。
  - 多跑 5 次测试 rollout 得 49.3，而把编辑 rollout 从 16 加到 21 只从 47.6 升到 48.4，说明**多写测试比多写代码更划算**。
- **对我们的含义**：
  1. 自写测试的毛病是区分度低，这和我们的 FP 现象一致。
  2. 执行信号和 LLM 评判互补。
  3. 预算的边际收益更可能在"更多、更多样的测试"，而不是"更多应用样本"。
- **成本 / 风险**：免执行 verifier 要训练，不适用。用 flash 模型做提示式 list-wise 评判来替代，质量未知。

#### 2.20 Commit0（Zhao et al., ICLR 2025）
- 链接：https://arxiv.org/abs/2412.01769
- **机制**：从规格加骨架生成整个库。SDE-I 分三步：先起草实现，再按 lint 修，再按单测修（逐个模块运行）。**这里的单测就是评测用的测试。**
- **数字**：
  - 表 1（Commit0 lite，单测通过率，下标是美元成本）：
    - Claude 3.5：17.80（$1.55）→ 18.79（$12.47）→ 29.30（$99.39）
    - DeepSeek-V2.5：16.55 → **11.61（lint 修复后下降）** → 25.43
    - Llama-3.1-405B：8.08 → 1.76 → 4.95
  - 表 2（Claude，逐库通过数）：有明显的回归。cookiecutter 108 → 102 → **16**；parsel 10 → 10 → **0**；chardet 3 → 25 → **3**；wcwidth 6 → 6 → 1。但 pyjwt 11 → 128，deprecated 73 → 151。正文说模型修 lint 和单测问题时常常引入新错误。
  - 图 5 左：按模块 best-of-n（1/3/10 次）和按单测迭代（1/3/10 轮），都随算力上升。
  - OpenHands 带完整测试信息时在 lite 上 42.95%（比 SDE-I 高 13.65）；作者把原因归于它会换思路，而 SDE-I 反复给出同样的修复。
- **对我们的含义**：
  1. 库级别上，用真实测试做反馈，平均收益大，但逐库看回归严重。这说明必须有"保留最佳"和回滚机制。
  2. 我们的自写测试不是真实测试，平均收益这一面无法照搬。
- **成本 / 风险**：不适用于直接复用。

#### 2.21 WebGen-Agent（Lu et al., 2025）——应用级，最接近我们
- 链接：https://arxiv.org/abs/2509.22644
- **机制**：
  - 每一步：写代码，执行（安装依赖、启动服务），截图后让 VLM 评分并给建议；截图没问题时，再让 GUI agent 按规格生成测试指令去实测。
  - 连续 5 步都有执行错误时，回溯到之前最好的一步。
  - 结束时选全程最好的一步：先比 GUI 分，再比截图分，还相同就取最新的一步。
  - **反馈用的 VLM（Qwen2.5-VL-32B）和 WebGen-Bench 评测功能时用的 GUI agent 模型是同一个。**
- **数字**：
  - 表 1：Claude-3.5 在 Bolt.diy 上 26.4%，用 WebGen-Agent 51.9%；DeepSeek-V3 从 20.8% 到 52.6%。
  - 表 2 消融（DeepSeek-V3）：只用执行反馈 45.9；加截图 46.6；加 GUI-agent 49.9（+3.3，最大单项）；加回溯 51.2；加选最优 52.6。加入 GUI 反馈后外观分下降，靠回溯和选最优补回来。
  - 表 8（DeepSeek-V3，最大迭代次数 → 准确率）：2 → 42.4，4 → 47.9，6 → 50.2，8 → 50.4，10 → 52.0，12 → 51.9，14 → 51.2，16 → 53.3，20 → 52.6。收益基本在前 6–10 轮拿完，之后有起伏。
  - 表 5：截图分和 GUI 分与人工标注的一致率分别为 93.6–95.6% 和 89.6–92.2%。
- **对我们的含义**：
  1. 这里的"自生成 GUI 测试"之所以有用，是因为反馈者和评测者是同一个语义判官，二者对齐（推断）。我们的隐藏预言是严格的 Playwright（选择器、文案、10 秒超时），自写测试在约定上和它不对齐。所以关键是让自写测试模仿隐藏测试的严格程度和约定。
  2. "选最优 + 回溯"在应用级有 +2.7 的实证（49.9 → 52.6），但前提是打分可信。
  3. 迭代上限 6–10 就够了。
- **成本 / 风险**：选最优检查点约 2 小时。GUI agent 反馈用 flash 模型、按我们的时限做，成本高，不建议。

#### 2.22 E2EDev（Liu et al., ACL 2026）——应用级、BDD Given/When/Then
- 链接：https://arxiv.org/abs/2510.14509
- **机制**：46 个 Web 项目、244 条需求、703 条 BDD（Behave）测试，从需求直接生成整个项目，比较各种框架。
- **数字**：
  - 表 3（Req.Acc，GPT-4o）：Vanilla 45.95；GPT-Engineer 50.83；Self-Collab 46.83；MapCoder（有调试 agent）47.70；ChatDev（有测试阶段）42.71；MetaGPT 0.00。
  - Claude-Haiku 4.5：Vanilla 48.69；GPT-Engineer 53.75；MapCoder 49.61；ChatDev 44.73。
  - 表 8（附录 C.1）：OpenHands 在 GPT-4o 上 39.25，在 Haiku 上 43.45；SWE-Agent 40.83 和 44.73。**都低于 Vanilla。**
  - 正文结论：各种 agent 框架并不能稳定提升基座模型。
- **对我们的含义**：从需求生成应用、按 BDD 场景测试，这类任务里多智能体加测试和调试的框架并不比一次成型强，通用 agent 甚至更差。这是"应用级修复循环不一定划算"的直接证据。
- **成本 / 风险**：只是证据，没有可直接实现的东西。

#### 2.23 E2EDevBench（Zeng et al., 2025）
- 链接：https://arxiv.org/abs/2511.04064
- **数字**：
  - 表 3（Impl-Rate 均值）：先开发后测试的 SDAgent-DT 49.48%；边写边测的 SDAgent-Single 45.72%；在 Pro 模型上 53.50% 对 42.97%。
  - 正文把原因归于边写边测的反应式局部修复导致"子任务沉浸"，偏离了整体需求。
  - 表 5：失败根因中，任务规划占 55.8%（需求遗漏 27.9%、误解 22.2%），自验证不足只占 5.7%。
- **对我们的含义**：应用级失败主要来自漏掉或误解需求。自写测试和代码出自同一模型的同一种理解，会犯同样的错（推断），所以修复循环抓不到这类失败。

#### 2.24 Trae Agent（2025）
- 链接：https://arxiv.org/abs/2507.23370
- **数字**：
  - 图 1：随机选的期望（Average）不随 N 变；N=10 时 oracle 比 Average 平均高 20.80 分，最坏情况（Adversary）低 27.01 分。现有集成选择方法（Augment、DeiBase）只比随机高 3.17 和 1.06，且**随 N 增大先升后降**。
  - 表 2 消融（平均降幅）：去掉整个剪枝 −5.57；去掉去重 −3.73；去掉回归测试 −3.42；把 selector agent 换成 Augment −4.08；去掉多数投票 −4.14。
  - 表 4：回归测试判定的准确率 63.28%；FP 率 33.04%，FN 率 3.69%。
- **对我们的含义**：N 要小，先剪枝再选；选择器弱时，N 大只会更糟。

#### 2.25 OAgents / "Scaling Test-time Compute for LLM Agents"（2025，GAIA，非代码）
- 链接：https://arxiv.org/abs/2506.12928
- **数字**：
  - 表 2：每步都反思，从 55.76 降到 55.15；只在低分步骤反思更好。
  - 结论 3：在验证和结果合并上，list-wise（把候选放在一起比较）优于逐个打分和投票。
- **对我们的含义**：只能作为旁证，支持"按需修复，不每步修"和"让 LLM 同时比较多个候选"。

#### 2.26 Huang et al., "LLMs Cannot Self-Correct Reasoning Yet"（ICLR 2024，非代码）
- 链接：https://arxiv.org/abs/2310.01798
- **数字**：
  - 表 3（没有外部反馈的内在自纠）：GPT-3.5 在 CommonSenseQA 上 75.8 → 38.1（第 1 轮）→ 41.8；GPT-4 在 GSM8K 上 95.5 → 91.5 → 89.0。
  - 表 2（用 oracle 标签决定何时停）：全部提升。
- **对我们的含义**：知道"哪一题错了"的那个信号才是价值所在。没有可靠信号时，改动越多越糟。

---

### 3. 对流水线三个具体问题的回答

#### 3.1 要不要改成 N 份整应用并行生成再选？
不建议作为主要投入。理由有三：
1. 整应用只选一次，上限由整体隐藏分在样本间的波动决定（0.1 第 5 条）。best-of-4 即使用完美选择器，期望也只有约 +2 分（推断）。
2. 我们现有的选择信号（自写测试）在两道题上都接近满分，区分度接近零。相关证据：R2E-Gym 图 5、S* 表 3、Reflexion 表 2。
3. Trae 图 1：选择器弱时，N 越大越差。

如果要做，N=3–4，选择信号用"字面约束过滤 + 多版本测试共识 + LLM list-wise 对照 YAML"，并且把额外费用算进 S 的盈亏平衡（表格题费用翻倍需要多过约 5 条）。

#### 3.2 接受规则"丢 1 条需多过 3 条"合理吗？
方向上合理：
- 通过的测试比失败的测试可信，因为通过意味着两个独立产物（代码和测试）一致，这是 CodeT 共识的逻辑，所以对回归加重惩罚是对的。
- 它比 UTDebug 的"整套通过率净上升才接受"更严，比 AlphaCodium 的硬锚点更松。

但它没解决根本问题，"多过的那 3 条"是在失配的代理上计数。建议改三处：
1. 对**高可信锚点**零容忍。高可信锚点指 YAML 字面约束，以及 K 份独立测试一致认可的测试。
2. 只让可信失败触发修复，包括运行时错误，以及 K 份测试多数都判失败的场景。
3. 结束时回到全程最佳检查点，不默认最后一版（WebGen-Agent 表 2，Snell 的 38%）。

#### 3.3 预算（24 次调用 / 10 元）怎么分？
- 修复链截短到 2–3 轮。依据：Self-Debugging 图 6a、S* 图 6、LDB 图 3、DDI、WebGen-Agent 表 8。
- 省下的钱：
  1. 什么都不做，直接降费用提分（费用砍半 S +7.2%）。
  2. 或者投到测试质量上：K 份测试共识、空应用必失败检查、按隐藏测试的风格写测试。R2E-Gym 的证据是多写测试比多写代码更划算。
- 不建议投到更深的修复。

---

### 4. 查不到 / 未核实

- 没有找到关于"应用级、自写 E2E 测试、修复轮数与隐藏通过率关系"的直接对照研究。最接近的是 WebGen-Agent 表 8，但它的反馈者就是评测者，二者对齐。
- 没有找到在"一个应用 100 个场景"粒度上度量样本间方差的论文。0.1 第 5 条的 ±2 分是按我们自己观察到的分数区间推算的。
- OpenHands critic 在 2–4 条轨迹时的中间数字、它和多数投票的对比，博客里都没有给。
- AlphaCodium 没有单独消融 test anchors 的贡献。
- 以下论文**没有读原文**，所以没有纳入：SWE-Search（2410.20285）、Satori-SWE / EvoScale（2505.23604）、DeepSWE 博客、"Are Solved Issues in SWE-bench Really Solved Correctly?"（2503.15223，只看过检索摘要）。


---

# 5. 隐藏测试大概怎么生成、会断言什么（事实与推断分开）

## 5.1 事实（原文或主办方公开代码写明）
1. ARC 论文基准的「真值」GUI 测试：每个叶子场景一条，**人工按真实网站的实际功能编写，独立于 ARC**（arXiv 2602.13723v6 §5.1.1）。v1 的说法是 "sophisticated end-to-end GUI test cases for each feature"。
2. ARC 失败的头号原因是**文档没写的隐含约束被测试测了**（12306 证件号去重；§5.5、站点 `examples.js`）。
3. 公开基准契约（arc-bench `README.md`、`scripts/audit-benchmark-tests.js`）：helpers 里只允许一次 `page.goto('/')`；spec 禁止 `/api/`、`request.`、`localStorage`、`.evaluate(`、`.route(`、`toHaveURL(`、`page.url()`、`.locator('.'|'#'|'[data-')`；1 个 worker 顺序跑；测试不调用 reset/seed；**应用启动时必须自己初始化需求包写明的账号与数据**。
4. 公开测试写法：定位器阶梯 role(button/link/menuitem/tab/checkbox/radio/option/heading) → label → placeholder → text，名字多为不区分大小写正则；每个场景用专属种子账号/记录；正则定位词 85–100% 能在 requirements.yaml 原文里找到（本目录统计），剩下的是测试自己输入的数据和少量真实产品文案。
5. arc-bench-lite（2026-09）需求格式与 hackathon 同族：`type: FOLDER/ATOMIC`、步骤 `keyword/content`、description 用反引号写死可访问名、每个 ATOMIC 写 "Seed data: …"。
6. 主办方编译器的 TestGenerator 规则：GIVEN→准备、WHEN→动作、THEN→断言，不许颠倒；需求没给精确名字时"derive it from an interface contract or choose a minimal stable accessible contract"；已存在的记录当作正常种子状态。
7. 主办方课程 Lab02：模型生成的 Playwright 训练测试**必须先在讲师参考实现上全绿才冻结**；评分用讲师另备的 hidden validation。
8. WebTestPilot（同实验室）新版把自然语言步骤在**活页面的 ARIA 快照**上转成 Playwright 代码：只用 get_by_role/label/placeholder/text、禁止直接导航、动作超时 3–10 s。其断言以「存在性/成员关系」为主（membership 78%），91% 的断言比较动作前后两个状态；它针对的四类缺陷是：缺 UI 元素、数据不一致、点了没反应、导航错。
9. 同类基准（sub_A 表 §1）：E2EDev、AppForge 的脚本化测试都在源/参考应用上验证过，并把定位锚点（data-testid、resource-id、精确文案）写回需求文本；Vibe Code Bench 规定"每个被测元素都必须在规格里给出"。
10. 主办方的 PRD→YAML 转换脚本 `convert_prd.py`（项目站点）要求 LLM 给每个需求至少一个 "Exception Scenario"（网络错误、非法输入、未授权）。

## 5.2 推断（未经证实）
1. hackathon 隐藏测试很可能沿用 arc-bench-lite 的生成与验真流程：按场景写、从 `/` 进入、角色/标签/文本定位 + 不区分大小写正则、在参考实现上跑绿。于是**定位名 = 参考实现的可访问名**：description 引号/反引号里写死的字符串会逐字出现；没写死的，取参考实现的写法，大概率是真实产品（GitHub）的惯用文案。
2. 模板化场景（"follows the visible controls for … workflow"）的具体检查来自 description 里的具体例子。同一需求的 Scenario 1/2/3 多半是同一模板换「变体点」（成功路径、校验失败、取消、空态），类似 TestGeneralizer 的 VP 结晶；按 convert_prd.py 的习惯，至少一个是异常路径。
3. 实例从不重置、按文档顺序跑，所以隐藏测试依赖 description 里点名的专属种子记录；前面的导航/登录一坏会连带后面（Asuka-Bench Table 2：严格 DAG 比全量少 6.0pp）。
4. 断言类型大概率是：动作后命名文本/标题可见、新建数据以同样的值出现在列表、计数/列表长度变化、校验错误文案、靠标题而非 URL 判断导航；很少断言布局。
5. 真实产品会强制的隐含约束（重名校验、必填、权限）有一部分会被测，即使 description 没写。
6. hackathon 的 27 张 GitHub 截图对应参考实现要模仿的页面；截图里的可见文字很可能就是没写进 description 的那部分可访问名（ARC 自己就用 VLM 把截图逐字转写，§4.2.1 + `ui_gen_prompt`）。

---

# 6. 排序后的可做技巧（预期帮助 ÷ 3 天成本）

说明：已按你们现有流水线扣掉了已经在做的部分（testgen 已盲写、已用角色定位、已从 `/` 进入）。「帮助」是对隐藏通过率的定性估计，除注明外不是论文数字。

1. **规格具体例子 → 逐字契约表，同时喂给整应用生成和测试写手**（放在 G 之前）
   - 做法：每个场景抽出从首页起的入口链接/按钮文字、role + 原文可访问名、THEN 要看到的原文字符串、GIVEN 需要的种子记录；每项必须带 description 原文引文，没引文的标低置信；模板化场景把 description 的例子逐个分配给 Scenario n。
   - 证据：CodeT 附录 B Table 6（提示里保留 I/O 例子，pass@1 +9.0~+14.1）；WebApp1K Insights Table 5/6（点名到具体对象的指令让同类错误减少 85.9–100%，泛泛的"文本要一致"<5%）；TDD for CodeGen Table 1（测试进提示 GPT-4 MBPP +12.78）；MSEval Table 3（deepseek-v4-flash 先写验收再实现 R1 52.0，其余组织方式 21.2–40.7）；ARC Table 7（需求补全后 41.8→68.0）。
   - 成本：1–2 次调用、约半天。风险：抽错会同时污染应用和测试，所以只准引原文。
2. **若网关有能看图的模型，用 ARC 的 `ui_gen_prompt` 把截图逐字转写**，结果并入契约表
   - 证据：ARC §4.2.1 与项目站点提示词（"FULL OCR TRANSCRIPTION"）；这是主办方自己的做法。课程 `.env.example` 列出的网关模型有 qwen3.8-max、qwen3.7-plus、qwen3.6-plus、kimi-k3、glm-5.3、deepseek-v4-pro 等，**哪个支持图片输入我没法验证（不许调网关）**。
   - 成本：每张图 1 次调用。风险：截图是真 GitHub，参考实现可能没照抄；只把转写结果当低置信名字候选。
3. **按模块逐个「对等注意力」核对补丁**（放在 G 之后）
   - 做法：每个顶层模块一次短调用，只给该模块 YAML 原文 + 契约 + 相关代码，输出 SEARCH/REPLACE；共享缓存前缀。
   - 证据：ARC 公众号对基线失败的解释（长文档中段需求被弱化）与 Table 6（w.o. Test −11~−47、w.o. DFS −16~−52）；Tests as Prompt Table 9（两个功能合成一题、提示翻倍，claude 0.88→0.75，deepseek-v3 0.585）；Commit0 §6（塞规格前 10K token 反而下降，BM25 取相关块更好）；E2EDev §失败分析（看不到详细需求的编码者遗漏最多）。
   - 成本：约 1 天、10–15 次调用。风险：回归，必须配合第 4 条。
4. **最佳快照 + 硬锚点 + 防删功能**（修复阶段）
   - 证据：WebGen-Agent Table 2（回溯 +1.3、选最佳 +1.4）；TDDev ASE'26 Table 8（MiniMax 14/20 个应用中途回落）；TDDev 2025 Table 9（修 1 轮 58.3→25.3）；PRDBench Table 4（DeepSeek-V3.2 修一轮 40.11→24.80）；AppForge Table 1（GPT-4.1 把实现删成空函数换编译通过，LOC 367→58）。
   - 成本：几小时。
5. **提高自测的区分度，而不是多修**：每条自测必须在空壳应用上失败（Agentless 复现测试要在原仓库上失败）；按 WebTestPilot 四类缺陷补断言（命名元素存在、新数据以原值出现在列表、计数变化、导航后标题）；修复阶段不许改测试里的规格字面量。
   - 证据：Tests as Prompt Table 8（测试迁就代码后 pass@1 从 0.07–0.33 虚高到 0.64–0.89）；AgentCoder Table 6（与写代码同一会话写的测试准确率 61.0/51.8，独立写 87.8/89.9）；R2E-Gym 图 5（多数题目里生成测试只有 <20% 能区分对错补丁）；Agentless Table 4（加复现测试 27.00%→32.00%）。
   - 成本：半天。
6. **用 1 次提交做消融：去掉修复（或只修运行时错误）**，看隐藏分掉不掉；不掉就砍掉修复省钱（费用减半 S +7.2%）。
   - 证据：E2EDev Table 8（OpenHands 39.25、SWE-Agent 40.83，都低于一次生成的 45.95）；Olausson 图 3（自反馈下修复相对同预算重采样只有 0.83–1.08 倍）；UTDebug Table 2（用随机生成测试修复，32.94→22.94，比不修还差）；Revisit Self-Debugging Table 2（用自生成测试做事后修复，HumanEval/HE+ 降 3.1–9.7 点）。
   - 成本：占 1 次提交，开发几乎为零。
7. **测试写手 few-shot 用主办方公开基准里最相似的 2–4 条测试**（别的 app，通用）
   - 证据：CEDAR Table I（检索相似示例使断言与开发者原断言完全一致率 44.41%→75.79%）；SWT-Bench Table 5（给出同文件测试上下文 8.1%→15.1%）；IntentionTest Table 5（去掉参考测试，成功率 92.00→87.41 / 94.81→85.71）。
   - 成本：低。你们已有 dialect.md，增量可能小。

---

# 7. 看起来相关但不适用
- 用 VLM/GUI agent 当自测裁判（WebGen-Agent、TDDev、Vibe Code Bench）：它们容忍措辞差异，会掩盖与严格 Playwright 预言的失配；flash 也看不见图。
- CodeT / B4 / MBR-exec / AlphaCode 聚类与大 N 整应用多采样：需要几十上百个候选；整应用只能选一次，sub_C 估算 best-of-4 即使选择器完美也只多约 2 条；Trae 图 1 显示选择器弱时 N 越大越差；Kim et al. 2025：同源模型 60% 的错误答案相同，投票去不掉。
- 训练类 verifier/critic（SWE-Gym、CURE、CodeRM、OpenHands critic、WebGen-LM）：不能训练。
- 需求澄清与多轮用户反馈（TiCoder、ClarifyGPT、Asuka-Bench）：比赛里没有可问的用户或参考实现。
- 用真值/隐藏测试报错重试的增益（Web-Bench Pass@2、WatchPoint、Commit0 SDE-I、MSEval 第 2–3 轮）：运行时拿不到。
- 多角色流程框架（MetaGPT、ChatDev、MapCoder）：E2EDev Table 3 中 MetaGPT 0–5.39；SWE-Dev Table 9 中 MapCoder 低于单模型。
- lint/静态评审反馈：Commit0 Table 1 中 DeepSeek-V2.5 16.55→11.61；DevBench Table 3 纯评审无增益。
- GUIPilot 视觉一致性检查：隐藏测试是脚本断言，不看外观。
- flash 开 thinking：WebGameBench Table 1 可用率 +3.4pp、优秀率 −1.2pp，收益小。
