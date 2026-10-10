# github-B 校准记录（REQ-3、REQ-4，order 31–59，共 29 条）

所有数字都来自最终版测试，用 `oracle/run.sh`（官方设置：1 worker、10 秒超时、按文件顺序、同一个不重置的后端）跑出。结果文件是 `runs/final2-<app>.json`。

## 1. 通过数

| 应用 | 隐藏总分（100 条） | 隐藏在本段通过 | 本套件通过（29 条） | 与隐藏逐条一致 |
|---|---|---|---|---|
| github-13-5450c3c63fe0（sub5，app13） | 13 | 5 | 13 | **21/29** |
| github-11-7e3f4dba7736（sub4，app11） | 11 | 3 | 14 | **18/29** |
| github-25-4310823c83f3 | 25 | 未知 | 27 | — |
| github-24-433d9936fb07 | 24 | 未知 | 21 | — |
| github-22-6dd494f9556b | 22 | 未知 | 25 | — |
| github-7-95ec6880ee7f | 7 | 未知 | 4 | — |

- 隐藏在本段通过的 8 条（app13 5 条、app11 3 条），本套件也全部通过。不一致全部是「本套件通过、隐藏失败」，没有一条反过来。所以在这两份应用上，本套件不比隐藏测试严，只是更宽。
- 不一致按原因分三类，见第 2 节。其中 A 类（需要登录的场景）很可能不是测试写错，而是隐藏运行本身的状态问题。去掉 A 类后，app13 是 21/23，app11 是 18/25。
- 各测试通过时耗时都不超过 3.3 秒。最慢的是「等提交响应最多 3 秒」那一步（应用只在前端校验、不发请求时会走满这 3 秒）。

## 2. 逐条不一致与原因

### A 类：需要登录的场景，功能其实能用，隐藏失败（推断是隐藏运行的状态问题）

- 用 alice-dev 登录的场景：app13 的 REQ-3-2-1 S1、S3，REQ-4-4 S1、S2；app11 的 REQ-4-3-2 S2、REQ-4-3-3 S1。
- 用新注册非管理员的场景：两份应用上的 REQ-3-4 S2、REQ-4-3-3 S2。

证据：

1. 两份标签里，order 12 之后没有任何一条需要登录的场景通过，两份应用都一样。
2. app13 的隐藏 REQ-1-1-3 S3（order 10，「固定验证码配合合规新密码更新凭据」）是通过的。我在 app13 上用种子邮箱 `alice.dev@example.test` 走了一遍找回流程，结果旧密码立刻失效、新密码能登录。紧接着的 REQ-1-2 S1、S2（order 11–12，都要 alice 登录）在 app13 上失败。
3. app11 的 REQ-1-1-3 三条都失败，REQ-1-2 S1、S2 通过，说明 alice 这时还能登录。REQ-1-3 S1 在 order 13。我在 app11 上用 alice 改密码，改动立即生效，但页面不显示「Password updated」。所以隐藏测试很可能在检查提示时失败，而密码已经改掉了。

推断：隐藏的 REQ-1-1-3 S3 和 REQ-1-3 S1 直接改的是 alice-dev，而不是 v2 描述里说的「新注册账号」。之后所有用 `Valid-password-123!` 登录的场景都会失败，不管功能好坏。

非管理员两条：v1 官方失败记录里，这两条要求的是独立账号 fixture（`E2E_NON_ADMIN_COLLABORATOR_*`、`E2E_DEFAULT_BRANCH_NON_ADMIN_*`）。v2 用的是哪个账号，需求没给。本套件用现注册的新账号，在所有应用上都通过，所以和隐藏结果对不上是预期中的。

结论：这一类不改测试。这意味着本套件在登录场景上会系统性地比隐藏结果乐观，主会话汇总时要单独看。

### B 类：app11 上的访客场景，功能按需求契约能用，隐藏失败（6 条）

涉及 REQ-3-2-3 S1、S2，REQ-3-3 S1，REQ-4-2-3 S2、S4，REQ-4-3-1 S1。隐藏结果里，app11 在 REQ-3-1 之后的访客场景全部失败，而 app13 的 REQ-3-3 S1、REQ-4-3-1 S1 通过。

浏览器里看到的 app11 和 app13 的差别：

1. app13 首页给访客列出仓库和组织链接（`acme-docs`、`Acme Demo`），app11 首页没有，只在侧栏有按钮「Organizations」。
2. 概览标题：app13 是「Acme Demo/acme-docs」，app11 是「acme-demo/acme-docs」。
3. app11 把文件名渲染两遍：一个链接，外加一个同文字的纯文本（`README.md`、`main-only.md`），`getByText('<文件名>')` 在严格模式下会撞两个元素。

v1 隐藏测试打开这些页面用的是 URL fixture（`E2E_PUBLIC_REPOSITORY_URL`、`E2E_CODE_REPOSITORY_URL`、`E2E_BRANCH_REPOSITORY_URL`、`E2E_COMMIT_URL`），v2 只能从首页点进去。REQ-2-1-1 S2（访客打开组织页）也是只在 app13 上通过。所以我判断最可能的是差别 1：隐藏访客测试从首页的仓库链接或组织链接进入。

需求没有规定首页要列仓库，本套件用 REQ-3-1 规定的全局搜索进入，因此复现不了这类失败。给应用的建议：首页给访客列出公开仓库和组织，链接名就是仓库名和组织名（成本低，也符合 REQ-3 里「personal/organization repository-list item」这一入口）。

### C 类：其余

- REQ-3-1 S3（两份应用都不一致；六个应用本套件全过）：两份应用都显示独立的「No results」，回首页再搜同一串也正确。原因不明。可能是隐藏版按模板以 alice 登录后搜索（登录锁死后必然失败），也可能用了别的空状态判据。描述写的是 visitor，所以没改。
- REQ-4-2-2 S1（app13）：本套件从提交历史点「Document search flow」进入。app13 的提交页有路径、「Changed files」、「4 additions, 1 deletions」和逐文件「+3 −0」，但没有 base/compare 标识，也没有逐行差异，概览或文件页上也没有最新提交的入口。描述说 “without requiring previous navigation through history”，隐藏版大概是从别的入口直接打开提交，或者检查了标识或差异行。这两样需求都没有给出可断言的精确值，所以没加。

## 3. 修掉的测试错误

1. **归属假设**：原来断言 `alice-dev/acme-docs`。两份应用都把 acme-docs 放在组织下，app13 的隐藏 REQ-3-1 S1、S4 和 REQ-3-3 S1 却是通过的，说明隐藏测试不看 owner 是谁。需求本身也有歧义（REQ-3 种子写 owner alice-dev，REQ-2 种子把 acme-docs 列在组织 Acme Demo 下）。现在一律只要求「某个 owner/acme-docs」。
2. **重名测试**：原来用 `acme-docs`。在把 acme-docs 放进组织的应用里，这一步会在个人命名空间里合法地建出第二个 acme-docs，之后所有登录场景都因为严格模式撞两个链接而失败（app13 上实际发生）。改用 `secret-research` 后，github-24 又合法地建出了 `alice-dev/secret-research`。最后改用 `acme-docs-fork`：需求明确说它在登录用户的个人命名空间里。同时比较提交前后的搜索结果数，而不是写死 1。
3. **代码搜索 S1 空过**：app13 结果页上的「Code」其实是仓库导航链接，点了回到概览；概览上恰好也有 README.md 链接和含 search flow 的描述。现在要求精确文字 `search flow`，对应描述里的 “complete text value”。
4. **空名字段错误**：原来的正则太窄。app13 显示的是 alert「Repository name is invalid」。现在接受以下任一：可见 alert、含 required/empty/blank/invalid 的文字、aria-invalid、浏览器原生 required 校验。
5. **Code 页**：REQ-4 测试原来停在概览上。github-25 的概览和 Code 页是分开的，Commits、Add file 只在 Code 页。REQ-4 文件夹定义了 Code 页，所以现在先点仓库导航 link「Code」。
6. **模态框残留**：github-25 的 Fork 表单和文件编辑器都是模态框。原来在模态框没关时就去搜索或核对，页面处于 inert 状态，操作不了。现在先回工作台或 Code 页，并 reload。
7. **默认分支**：github-24 确认后会跳回仓库页。原来的测试假定还停在设置页，直接 reload 去读下拉框。现在显式重新进入 Settings → Branches 再读。S2 的「默认分支不变」改为和本条开始时的值比较，避免被 S1 的中途失败连带。
8. **删掉需求没写的断言**：代码结果页显示仓库名；点 Code 后或 reload 后搜索框回填；tab 的 aria-selected；空名提交后 URL 不变；非管理员场景末尾的 reload（github-25 上它会触发一个与本场景无关的白屏）。
9. **REQ-4-1 内容判定**：原来取任意 pre/code 文字，可能取到页面其他位置里的 `main` 这类内联代码。现在取最长的一段，并要求不少于 10 个字符。

## 4. 各应用的典型失败与判断

- **app13（13/29）**
  - 应用缺陷：
    - 没有 Fork 按钮，也没有 `acme-docs-fork` 种子；
    - 克隆协议用的是切换按钮，不是 tab；
    - 目录链接叫「src/」；
    - 作者和时间合在一段文字里「alice-dev · 2 days ago」；
    - 代码结果页没有结果类型的 Code 链接；
    - 分支搜索无匹配时不显示「No matching branch」，反而给访客提供「Create branch: …」；
    - 不显示「Invalid branch」；
    - 下拉框嵌在按钮里，展开后按钮的可访问名被污染，建分支后读不到「Branch <新名>」；
    - 改默认分支不生效。
  - 种子歧义：alice 能看到两个 `secret-research`（组织下一个、个人名下一个），REQ-3-4 S1 在严格模式下撞两个元素。
- **app11（14/29）**
  - 契约偏差：「New repository」是按钮，不是链接；设置页没有「General」链接；没有「Create new file」menuitem。
  - 应用缺陷：
    - 没有 Fork 按钮；
    - 目录页不列文件；
    - Code 页没有 Commits 链接；
    - 代码结果只给文件名，没有匹配文字；
    - 分支搜索无匹配时同 app13；
    - 新分支没有文件；
    - 改密码不显示结果。
- **github-25（27/29）**
  - 应用缺陷：作者和时间合在一段；新建分支后文件列表为空（「No files.」）。
- **github-24（21/29）**
  - 应用缺陷：
    - 克隆地址里带空格（`https://github.com/Acme Demo/acme-docs.git`），不是可粘贴的 URL；
    - 提交页没有增删数字；
    - 代码结果没有精确匹配文字；
    - 新分支没有文件；
    - 文件页有两个名为 Commits 的链接，违反「each expose one」；
    - 作者和时间合在一段，作者显示为 `alice`。
- **github-22（25/29）**
  - 应用缺陷：
    - 作者和时间合在一段；
    - 代码搜索不限于当前仓库：本套件前面建的 fork 里的 README.md 也出现在结果里，严格模式撞两个链接，这正是需求明令禁止的跨仓库泄漏；
    - 新分支没有文件。
- **github-7（4/29）**
  - 应用缺陷：点搜索结果进入仓库页时 JS 报错（`Cannot read properties of undefined (reading '0')`），页面停在搜索结果上，所有依赖仓库页的场景都失败。

两条在六个应用上全失败的测试，我复核过都是应用问题：

- REQ-4-2-1：凡是有提交历史页的应用，都把作者和时间合成一段文字，没有把作者作为独立文本显示。需求要求 “displayed in full as distinct readable text values”。
- REQ-4-3-2 S1：新分支没有继承基准提交的文件。需求写的是新分支指向基准提交，浏览上下文要随之切过去。

## 5. 最不确定的假设

1. **进入仓库的路径**：本套件用全局搜索。隐藏版很可能走首页列表或组织页（见 B 类），这是本套件和隐藏结果偏差最大的来源。
2. **登录锁死推断**：A 类。如果推断不成立，就说明隐藏登录场景另有我们没看到的失败原因。
3. **非管理员账号**：用现注册的新账号，需求没给第二个账号的凭据。
4. **REQ-4-1 的目录、文件和期望内容**：需求没有公开，取了 `src/search.ts`，内容只判非空且刷新后不变。
5. **精确文字**：REQ-4-2-3 的精确 `search flow`、REQ-4-2-1 的独立作者文字 `alice-dev`、REQ-4-2-2 增删汇总的格式（原文 “described below” 没有下文）。
