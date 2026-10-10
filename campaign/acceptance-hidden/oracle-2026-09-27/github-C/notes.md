# github-C 测试说明（REQ-5 议题、REQ-6 拉取请求，order 60–100，共 41 条）

文件：`tests/50-REQ-5-1-1.spec.cjs` … `tests/70-REQ-6-6.spec.cjs`，每个需求一个文件，文件内顺序 = intents.json 的 order。
每个文件 = `src/header.cjs`（共用 helper）+ `src/body/<同名>.cjs`，由 `build.sh` 拼成，改测试请改 `src/` 再跑 `build.sh`。

## 全局约定与假设

- 定位：控件按 role + 需求引号里的精确名（`exact: true`），严格模式。只有两处有意用 `.first()`：需求明说「第一个 Add comment 按钮对应第一条可评论行」；以及需求明说会在多处出现的评审状态（`Approved`、`Changes requested`、评审摘要正文，「Conversation 和右侧评审摘要都显示」）。其余凡是需求引号给出的文字都按精确值、严格模式断言。
- 登录（G1）：首页 link「Sign in」→ label「Username or email」「Password」→ button「Sign in」→ `getByText(用户名, {exact})` 可见（严格：用户名在页面上出现两次也算失败，和隐藏测试 v1 的 helper 写法一致）。
- 打开仓库（G2）：顶部 searchbox「Search」输入 `acme-docs` 回车 → link「acme-docs」→ 等 URL 变化；之后点仓库导航 link「Issues」「Pull requests」「Settings」（精确名，不允许带计数）。与 github-B 的做法一致。**假设**：隐藏测试可能改为直接点首页列表里的仓库链接（见 calibration.md），本套件不走首页列表。
- 打开种子议题（G3）：Issues 页 searchbox「Search issues」输入完整标题 → 点精确标题链接。依据 REQ-5-1-1「filters as the user types, including when the entire seeded title is entered」。
- 打开 PR（G4）：Pull requests 页先点 link「Open」再点精确标题链接（REQ-6-2-1 契约）；种子草稿 PR 不点状态筛选、直接在列表里找（需求没给 Draft 筛选控件的名字）。
- 账号（G5）：`alice-dev` / `Valid-password-123!` = acme-docs 的 owner/Admin，也当 PR 作者和维护者；`bob-reviewer` = 非作者的 Write 协作者（REQ-6-3-3/6-3-4 写明「non-author Write reviewer」），**密码假设同为 `Valid-password-123!`**。无权限场景（5-4 S2、6-1 S2、6-6 S2）都用 bob：Write 按需求不能改议题状态、不能管分支保护、不能关别人的 PR。
- 种子（G6）：议题 `Improve onboarding`（Open，描述 `Describe the onboarding improvement.`）、`Legacy welcome text`（Closed）、`Original issue title`；标签 `bug`/`documentation`；里程碑 `Q3 launch`（场景里的 `v1.0` 是旧模板残留，GIVEN 的种子值是 `Q3 launch`）。PR：**假设 `Fix search` 是公开的 Open PR（含 `src/search.ts` 变更），`Improve onboarding` 是筛选场景里的 Closed PR**；`Draft onboarding update`（Draft，draft-feature→main，作者 alice-dev）。
- 共享种子保护（G7）：改标题、关闭、指派、标签、里程碑都先建带唯一后缀（`pw-…`）的新议题再操作；新 PR 都走 main←feature-search，测试结束 best-effort 关闭（不断言），因为完美实现会拒绝同一对分支的第二个 Open/Draft PR。
- 文档顺序依赖（G8）：6-1 S1 给 acme-docs 的 `main` 建保护规则并把 `Fix search` 的 test 设为 success → 6-3-4 S1 bob 批准 `Fix search` → 6-5 S1 合并 `Fix search`；6-2-4 S2 把 `Draft onboarding update` 转为 Open → 6-5 S2、6-6 S1/S2 用它。6-5 S1 合并后 main←feature-search 可能不再有差异，所以其后不再新建 PR。
- 只读场景用访客：模板化的 WHEN 写「signs in as alice-dev」，但 v1 失败记录显示这些测试只要 URL 夹具、不要账号（REQ-5-1-2 S2/S3、6-2-1 S2/S3、6-3-1 S2/S3），需求也写「directly viewable without sign-in」。

## 逐条

| order | 标题 | 意图 | 关键断言 | 假设 |
|---|---|---|---|---|
| 60 | REQ-5-1-1 S1 | 按状态和关键词筛选，筛选不改议题 | 访客 → Issues → link「Open」→ searchbox「Search issues」填 `Improve onboarding` → 该标题链接可见、`Legacy welcome text` 链接 0 个；reload 后同样；点标题 → 精确 heading + 精确 `Open` | 标签筛选控件没有给名字，不测 |
| 61 | REQ-5-1-1 S2 | Closed 筛选只显示匹配的已关闭议题 | link「Closed」→ 搜 `Legacy welcome text` → 它可见、`Improve onboarding` 0 个；reload 后筛选上下文仍在（结果不变）；点开 → heading + 精确 `Closed` | 「refreshing retains the chosen filter context」按字面要求刷新后不重新筛选 |
| 62 | REQ-5-1-2 S1 | 详情页可看标题、描述、状态、讨论 | 访客 → 搜索并点开 → 精确 heading、精确 `Open`、精确描述、含 `Comment` 或 `Activity` 的文字；reload 后仍在 | 讨论区只按描述的「含 Comment 或 Activity」宽松判定 |
| 63 | REQ-5-1-2 S2 | 刷新后标题和描述仍在 | 同上打开 → reload → heading、描述 | 访客（见全局） |
| 64 | REQ-5-1-2 S3 | 离开后重开仍是同一详情 | 记 `page.url()` → goto `/` → goto 该地址 → heading、描述、`Open` | 「重新打开同一地址」用 goto 记下的 URL |
| 65 | REQ-5-2-1 S1 | 创建非空议题后详情和列表都能找到 | alice → link「New issue」→ label「Title」「Description」→ button「Submit new issue」→ 精确 heading、精确描述、`Open`；点「Issues」后有同名链接 | 标题 `pw-issue-<后缀>` |
| 66 | REQ-5-2-1 S2 | 空白标题不创建议题 | 标题三个空格、描述空 → 精确「Title is required」、仍在表单；从首页重新进入 Issues 列表，链接总数与提交前相同 | 用「页面链接数不变」判定没有新增行；表单页不要求带仓库导航 |
| 67 | REQ-5-2-2 S1 | 保存新标题和描述，重开后仍是新值 | 新建议题 → button「Edit issue title」→ label「Issue title」→「Save issue title」→ 新 heading；「Edit issue description」→「Issue description」→「Save issue description」→ 新描述；reload 后都在、仍 Open；列表有新标题、无旧标题 | 编辑自建议题，不动种子 |
| 68 | REQ-5-2-2 S2 | 空白标题保存失败，重开仍是原标题 | 打开 `Original issue title` → 填三个空格保存 → 精确「Title is required」→ reload 后原 heading | — |
| 69 | REQ-5-2-3 S1 | 非空评论和作者持久化在时间线 | alice 在 `Improve onboarding` 用 textbox「Comment」+ button「Comment」→ 正文精确可见；含正文的最内层 article 含 `alice-dev`；reload 后仍在 | 评论目标用种子议题（追加评论不影响其他场景）；不测 reaction（控件无名字，意图也不含） |
| 70 | REQ-5-2-3 S2 | 纯空格评论不新增记录 | 记 article 数（等数量稳定）→ 填空格：按钮可用就点并要求「Comment is required」，禁用也算通过 → article 数不变；reload 后不变 | 应用不用 article 语义时本条退化为「无新增」 |
| 71 | REQ-5-3-1 S1 | 分配并取消分配成员，元数据同步 | 新议题 → button「Assignees」→ textbox「Search assignees」填 bob → option「bob-reviewer」→ 选择器关闭、右侧元数据区显示用户名；reload 仍在；再开选择器直接点同一 option → 元数据区不再显示；reload 后仍无 | 可分配成员用 bob（Write ≥ Triage）；「右侧元数据区」= 同时含 Assignees/Labels/Milestone 按钮中至少两个的最内层元素，按渲染文字（innerText，包含裸文本节点、忽略隐藏的已关闭选择器）判断，避开时间线里的历史记录 |
| 72 | REQ-5-3-2 S1 | 应用本仓库标签，重开后仍可见 | 新议题 → button「Labels」→ option「documentation」可见 → option「bug」→ 关闭、元数据区显示 bug；reload 仍在；再选 bug 移除 → 不显示；reload 后仍无 | 元数据区判定同上 |
| 73 | REQ-5-3-3 S1 | 归入本仓库里程碑，重开后仍在 | 新议题 → button「Milestone」→ option「Q3 launch」→ 关闭、元数据区显示；reload 仍在 | 里程碑用 GIVEN 种子 `Q3 launch`；契约只要求选中后持久，不测「None」 |
| 74 | REQ-5-4 S1 | 关闭再重开，状态转换记入活动 | 新议题 → button「Close issue」→ 精确 `Closed` + 含「Closed issue」的活动 → button「Reopen issue」→ `Open`；reload 后「Close issue」可用、`Open`、标题和描述不变、「Closed issue」活动仍在；列表仍有该议题 | 活动文字按子串匹配（大小写不敏感） |
| 75 | REQ-5-4 S2 | 无管理权限的用户不能关/开议题 | bob 打开 `Improve onboarding` → `Open` 可见，「Close issue」「Reopen issue」按钮都为 0；reload 后同样 | bob 是 Write（见全局） |
| 76 | REQ-6-1 S1 | 保存分支保护规则后重开仍可见 | alice → Settings → Branches → button「Add branch protection rule」→ label「Branch name pattern」填 `main` → 两个 checkbox → button「Create」→ 表单消失；reload 后有一个元素同时含 main/1 approval/Require status check test，且「1 approval」「Require status check test」精确可见；再打开 Open PR `Fix search`：精确「test: pending」→ combobox「test status」→ option「success」→ button「Save」→「test: success」，reload 后仍在 | 规则建在 acme-docs 的 `main`（场景原文）；按场景 WHEN 把「更新 test 为 success」也做完；「main」不用精确文字断言（设置页的默认分支下拉里也有 main 选项） |
| 77 | REQ-6-1 S2 | 非管理员不能建/改保护规则 | bob → acme-docs → 有 Settings 就进、有 Branches 就进 → 没有「Add branch protection rule」「Create」「Save changes」按钮 | bob 非 Admin |
| 78 | REQ-6-1 S3 | 把 test 更新为 success 且持久化 | alice 新建 PR → 到达详情页即见精确「test: pending」→ combobox「test status」→ option「success」→「Save」→「test: success」，reload 后仍在 | 「Checks area is available on arrival」按「不用点 Checks 标签」理解；「clickable option」按自定义下拉理解（原生 select 的 option 在 Playwright 里点不到）；未断言设置人和时间（没有可定位的容器） |
| 79 | REQ-6-2-1 S1 | 按 Open 筛选并打开目标 PR | 访客 → Pull requests → link「Open」→ link「Fix search」→ link「Closed」后它为 0 → 回 Open 点开 → 精确 heading + `Open` | Open PR = `Fix search`（G6）；作者筛选控件无名字，不测 |
| 80 | REQ-6-2-1 S2 | Open 筛选刷新后仍见同一 PR | Open → 链接可见 → reload → 仍可见 → 点开 heading | — |
| 81 | REQ-6-2-1 S3 | 离开后重进列表仍能找到 | 记列表 URL → goto `/` → goto 该 URL → 再点 Open → 链接可见 → 点开 heading | — |
| 82 | REQ-6-2-2 S1 | 比较两个分支可看提交数、文件、摘要 | alice → link「New pull request」→ combobox「base」=main、「compare」=feature-search（原生 select）→ button「Compare changes」→ 精确 `src/search.ts`、精确「Commit summary」、形如「N commit(s)」的计数、button「Create pull request」可用 | 计数格式没规定，用 `\d+ commits?` |
| 83 | REQ-6-2-2 S2 | 同一分支不能创建 PR | base=compare=main → 不点比较就显示精确「No changes」且「Create pull request」禁用；点「Compare changes」后仍然如此 | 禁用而非隐藏 |
| 84 | REQ-6-2-3 S1 | 基于有效比较创建 Open PR | Compare → button「Create pull request」→ label「Title」「Description」→ 唯一的「Create pull request」提交 → 精确 heading、`Open`、描述；reload 后仍在；从首页进 PR 列表能点开 | 结束时 best-effort 关闭（G7） |
| 85 | REQ-6-2-3 S2 | 空白标题不创建 PR | 标题空格 → 精确「Title is required」、仍在表单；PR 列表链接总数不变 | — |
| 86 | REQ-6-2-4 S1 | 草稿 PR 显示 Draft 且不可合并 | button「Create draft pull request」→ 表单 → 同名提交 → heading、精确 `Draft`、button「Merge pull request」存在且禁用；reload 后仍如此 | 结束时 best-effort 关闭 |
| 87 | REQ-6-2-4 S2 | 作者把草稿标为可评审，内容不变 | alice 打开 `Draft onboarding update`（不点筛选）→ `Draft` → button「Ready for review」（若有单个「Confirm」就点）→ `Open`、无 `Draft`、标题不变、显示 `draft-feature`、出现含 ready for review 的活动；reload 后 `Open`、无 `Draft` | 作者按 alice-dev；分支名可与 main 同在一行 |
| 88 | REQ-6-3-1 S1 | 查看概览、提交和变更文件 | 访客 → `Fix search` → link「Conversation」「Commits」「Files changed」依次：heading、`Open`、精确「Commit summary」、精确「Changed files」；reload 后仍在 | 三处 heading 相同 = 同一 PR |
| 89 | REQ-6-3-1 S2 | 刷新后标题和标签页入口仍在 | 三个 link 可见 → reload → heading + 三个 link → 点 Commits 见「Commit summary」 | — |
| 90 | REQ-6-3-1 S3 | 离开后重开同一 PR 仍可看概览和变更 | 记 URL → goto `/` → goto 该 URL → heading → Files changed → 精确「Changed files」、`src/search.ts` | — |
| 91 | REQ-6-3-2 S1 | 访客看到文件路径和增删汇总 | Files changed → 精确 `src/search.ts`、唯一一处「N additions, M deletions」；reload 后仍在；切回 Conversation 状态仍 Open | 汇总按需求给的格式，严格模式 |
| 92 | REQ-6-3-3 S1 | 行内单条评论显示在讨论中 | bob → `Fix search` → Files changed → 第一个 button「Add comment」→ textbox「Comment」→「Add single comment」→ 正文可见；reload 后仍在 | — |
| 93 | REQ-6-3-3 S2 | Start a review 的评论保持待提交 | alice 新建 PR；bob 另一个会话：第一条行评论 →「Start a review」→ 正文 + 精确「Pending review」，reload 后仍在；alice 刷新后在 Files changed 和 Conversation 都看不到该正文 | 「另一个 Open PR」用自建 PR；「不公开」用作者视角验证 |
| 94 | REQ-6-3-4 S1 | 批准后 PR 显示 Approved | bob → `Fix search` → Files changed → button「Review changes」→ radio「Approve」→「Submit review」→ 表单关闭 → Conversation 有 `Approved`；reload 后仍在 | 不填 Summary（契约说可空） |
| 95 | REQ-6-3-4 S2 | 请求修改保存意见和 Changes requested | alice 新建 PR；bob：Review changes → label「Summary」→ radio「Request changes」→ Submit → Conversation 有 `Changes requested` 和精确意见；reload 后仍在 | 用自建 PR，避免挡住 6-5 S1 的合并 |
| 96 | REQ-6-4 S1 | 请求并移除评审者 | alice 新建 PR → button「Reviewers」→ textbox「Search」→ option「bob-reviewer」→ 关闭、出现 button「Remove bob-reviewer」；reload 仍在；无 `Approved`；点 Remove → 消失；reload 后仍无 | 评审者区是否显示用户名以「Remove bob-reviewer」按钮为准（按钮名就含用户名，区域文字再查一遍没有增量信息） |
| 97 | REQ-6-5 S1 | 合并满足条件的 PR 后显示 Merged | alice → `Fix search`（若仍 test: pending 就先设 success）→「Merge pull request」可用 → 点 →「Confirm merge」→ 精确 `Merged`；reload 后仍 Merged、合并按钮消失 | 依赖 76 的规则和 94 的批准（G8） |
| 98 | REQ-6-5 S2 | 未满足保护规则不能合并 | alice → `Draft onboarding update`（若仍是草稿先 Ready for review）→「Merge pull request」禁用 + 精确「Review required by branch protection」；reload 后仍如此、仍 Open | 依赖 76 的规则 |
| 99 | REQ-6-6 S1 | 作者关闭再重开 PR | alice → `Draft onboarding update` →「Close pull request」→ `Closed` →「Reopen pull request」→ `Open`；reload 后「Close pull request」可用、`Open`、分支仍显示 | — |
| 100 | REQ-6-6 S2 | 非作者非维护者不能关/开 PR | bob → `Draft onboarding update` → 状态文字可见，「Close pull request」「Reopen pull request」都为 0；reload 后同样 | bob 是 Write、非作者 |
