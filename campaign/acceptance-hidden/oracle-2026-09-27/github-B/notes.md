# github-B 测试说明（REQ-3、REQ-4，order 31–59，共 29 条）

文件：`tests/30-REQ-3-1.spec.cjs` … `tests/43-REQ-4-4.spec.cjs`，每个需求一个文件，文件内顺序 = intents.json 的 order。

## 全局约定与假设

- 控件一律按 role + 需求引号里的精确名定位（`exact: true`），严格模式，不用 first/last/nth。只有「存在性」断言（同一文字可能在页面上合法地出现多次，例如作者名、`ago`、变更文件路径）用 `filter({ visible: true })` 再断言数量不为 0。
- 登录：首页点 link「Sign in」→ label「Username or email」「Password」→ button「Sign in」→ 登录按钮消失且页面出现用户名。账号只用种子 `alice-dev` / `Valid-password-123!`。
- 打开仓库：从首页顶部 searchbox「Search」输入仓库名回车 → 点精确名链接（REQ-3-1 规定的路径）。需求没有规定首页列出仓库，所以不走首页列表。【假设 A1】
- REQ-4 的场景都在「Code 页」上操作：到达仓库概览后再点仓库导航 link「Code」（REQ-4 文件夹描述：Code 页顶部是分支选择器、主区是文件列表、Commits 从这里进）。概览和 Code 页是同一页的应用里这一步不产生变化。
- 仓库归属：需求自相矛盾（REQ-3 种子写 owner `alice-dev`，REQ-2 种子把 `acme-docs` 列在组织 `Acme Demo` 下）。凡是要看「owner/仓库名」的地方，都只要求「某个 owner/acme-docs」，不认定 owner 是谁。【假设 A2】
- 非管理员：需求没有给第二个账号的密码，非管理员场景用 REQ-1-1-1 流程现注册一个带唯一后缀的新账号（Sign in → Create an account → Username/Email/Password/Confirm password/条款勾选 → Create account → 回到登录页再登录）。「Create an account」没写 role，允许 link 或 button。【假设 A3】
- 会改共享状态的操作：建仓库、Fork、建分支、建文件都用唯一后缀；改可见性用种子私有仓库 `secret-research`（之后没有场景依赖它保持私有）；改默认分支用 `acme-docs` 的 `release`，测试末尾改回 `main`，保证后续场景看到的仍是原状态。
- 「被拒绝」类断言在点提交后先等一次非 GET 响应（最多 3 秒，没有请求也继续），避免在应用处理前就判「没变化」。事后核对数据时先回到工作台（或仓库页）并 reload，避免模态表单残留让页面不可操作。

## 逐条

| order | 标题 | 意图 | 关键断言 | 假设 |
|---|---|---|---|---|
| 31 | REQ-3-1 S1 | 访客搜索可见仓库并从结果打开概览 | 搜 `acme-docs` → link「acme-docs」可见、结果里有「<owner>/acme-docs」；无 secret-research 链接；点击 → heading 含 `acme-docs`；reload 后仍在 | 不点「Repositories」类型过滤（描述写明不需要）；owner 不限（A2） |
| 32 | REQ-3-1 S2 | 访客搜索时不出现无权访问的私有仓库 | 访客搜 `secret-research` → 显示「No results」，没有名为 secret-research 的链接、没有「/secret-research」文字 | 对访客来说私有仓库就是「无匹配」，所以要求「No results」 |
| 33 | REQ-3-1 S3 | 无匹配搜索显示空结果、不展示无关仓库 | 访客搜随机串 → 「No results」，无 acme-docs 链接；回首页（goto `/`）再搜同一串 → 同样 | 以访客身份（描述写 the visitor returns home）；「回首页」用 goto `/` |
| 34 | REQ-3-1 S4 | 公开仓库搜索结果刷新后仍可见 | 搜 `acme-docs` → 结果链接可见 → reload → 链接和「<owner>/acme-docs」仍在 → 点击后 heading 含 acme-docs | 访客身份 |
| 35 | REQ-3-2-1 S1 | 登录用户以 Private + README 初始化建仓库 | link「New repository」→ label「Repository name」「Description」(= Repository created by Playwright)、radio「Private」、checkbox「Add a README file」、button「Create repository」→ heading 含新名、`Private` 精确文字、link「README.md」、描述文字；reload 后全部仍在 | Owner 用默认值；README 链接名为 `README.md` |
| 36 | REQ-3-2-1 S2 | 重复仓库名不会建出半成品 | 先以 alice 搜 `acme-docs-fork` 记下结果数；回工作台 → link「New repository」→ 只填名字 `acme-docs-fork` 提交 → 仍在表单（「Create repository」按钮可见）、没有含该名的 heading；回工作台 reload 再搜，结果数不变 | 重名对象用 `acme-docs-fork`：需求（REQ-3-2-2）明确说它在登录用户的个人命名空间里。`acme-docs`、`secret-research` 的归属在需求里有歧义，实测 app13、github-24 把它们放在组织下，用它们会在个人命名空间里合法地建出同名仓库并污染后续场景 |
| 37 | REQ-3-2-1 S3 | 空仓库名不会建仓库并显示字段错误 | 名字为空直接提交 → 仍在表单；出现字段错误：可见 alert，或含 required/empty/blank/invalid 的文字，或字段 aria-invalid，或浏览器原生 required 校验 | 错误文案需求没给，接受以上任一形式 |
| 38 | REQ-3-2-2 S1 | Fork 到个人命名空间后可见来源链接 | alice 打开 acme-docs → button「Fork」→ label「Repository name」填 `acme-docs-fork-<后缀>` → button「Create fork」→ heading 含新名、文字「Forked from (…/)acme-docs」、指向来源的链接；reload 后都在 | 来源名显示为 `acme-docs` 或 `<owner>/acme-docs` 均可 |
| 39 | REQ-3-2-2 S2 | 目标命名空间已有同名 Fork 时不建第二个 | 先搜 `acme-docs-fork` 记数；Fork 表单填 `acme-docs-fork` 提交 → 仍在 Fork 表单、无该名 heading；回工作台 reload 再搜，数量不变 | 冲突种子 `acme-docs-fork` 在 alice 个人命名空间 |
| 40 | REQ-3-2-3 S1 | 访客复制 HTTPS 克隆地址，仓库不变 | 授予剪贴板权限；button「Code」→ tab「HTTPS」→ button「Copy clone value」→ 「Copied」可见、heading 仍在；剪贴板内容匹配 `https://…/<owner>/acme-docs(.git)`；reload 后 heading 和 README.md 仍在 | 剪贴板权限由测试授予（描述说是浏览器前置条件） |
| 41 | REQ-3-2-3 S2 | 选择 SSH 时复制 SSH 地址 | 同上换 tab「SSH」；剪贴板匹配 `user@host:<owner>/acme-docs.git` | 访客身份（描述：visitor-readable public repository） |
| 42 | REQ-3-3 S1 | 访客打开公共仓库概览 | heading 含「<owner>/acme-docs」、`Public` 精确文字、link「Code」「Issues」「Pull requests」「README.md」；reload 后 heading 与 Public 仍在 | A2 |
| 43 | REQ-3-4 S1 | 管理员确认改为公开后访客规则同步 | alice 打开 secret-research（先确认显示 Private）→ link「Settings」→ link「General」→ button「Change visibility」→ radio「Public」→ button「Confirm visibility」→ 对话框关闭；回到仓库地址显示 Public 且 reload 后仍在；新的未登录上下文打开同一地址能看到 heading，全局搜索也能搜到 | 私有仓库用种子 `secret-research`；后续没有场景依赖它私有 |
| 44 | REQ-3-4 S2 | 非管理员看不到可执行的可见性入口 | 新注册账号打开 acme-docs；有 Settings 就点进去，有 General 就点进去；页面上没有「Change visibility」「Confirm visibility」按钮 | A3；「有入口就进」用 400ms 短等待避免空判 |
| 45 | REQ-4-1 S1 | 逐级浏览目录并查看文件内容 | 访客在 acme-docs 的 Code 页点 link「src」→ 目录页有 link「search.ts」且显示分支 main → 点文件 → 页面有文件名，pre/code/textarea/table 里最长的一段文字至少 10 个字符；reload 后 URL、分支、这段文字完全一致 | 需求没公开目录/文件名和期望内容：取唯一已知的嵌套文件 `src/search.ts`（REQ-4-2-2 种子），内容只校验非平凡且刷新不变 |
| 46 | REQ-4-2-1 S1 | 查看提交历史里的消息、作者、时间 | link「Commits」（允许带数字）→ `Document search flow` 精确文字可见、`alice-dev` 精确文字可见、含「ago」的相对时间；reload 后仍在 | 作者假定为 `alice-dev`；不做文件范围历史（描述说直接看分支历史） |
| 47 | REQ-4-2-2 S1 | 打开提交可见变更文件和增删 | 历史页点 link「Document search flow」→ 精确文字 `src/search.ts`、「Changed files」、增删数字（`+N`/`-N` 或 `N additions`/`N deletions`）；reload 后仍在 | 假定 `Document search flow` 就是改了 `src/search.ts` 的种子提交；增删汇总格式需求原文缺失（“described below” 没有下文），两种写法都接受 |
| 48 | REQ-4-2-3 S1 | 仓库范围搜代码并打开匹配文件 | Code 页 searchbox「Search」输入 `search flow` 回车 → link「Code」→ link「README.md」、精确文字 `search flow`；结果里没有 secret-research；打开 README.md 后精确文字 `search flow` 仍可见 | 「Code」必须是结果类型链接（点了回到仓库概览的实现会因为概览上没有精确的 `search flow` 而失败）；精确文字对应描述里的 “complete text value” |
| 49 | REQ-4-2-3 S2 | 无匹配显示空结果并保持仓库范围 | 搜 `no-such-token` → Code → 「No code results」、搜索框值精确等于 `no-such-token`、没有 README.md 链接 | 「保持仓库范围」没有可见的判据，不另加断言 |
| 50 | REQ-4-2-3 S3 | 代码搜索结果刷新后保留文件上下文 | 搜 `search flow` → Code → README.md 链接 + 精确 `search flow`；reload 后 README.md 链接和精确文字都还在 | 把描述里 “refreshing preserves the file context, text, and a link named exactly after the file” 读成结果页刷新；不要求刷新后搜索框回填 |
| 51 | REQ-4-2-3 S4 | 空代码搜索回到仓库后重复仍为空 | 搜 `no-such-token` → 「No code results」；回首页重新打开 acme-docs 再搜 → 仍「No code results」、无 README.md、搜索框值不变 | 「回到仓库」用首页搜索重新进入 |
| 52 | REQ-4-3-1 S1 | 分支选择器切换分支 | button「Branch main」→ option「main」可见 → textbox「Find branch」填 feature-search → option「feature-search」→ button「Branch feature-search」、link「main-only.md」；再切回 main 后 main-only.md 消失 | 访客身份 |
| 53 | REQ-4-3-1 S2 | 分支搜索无匹配时保持当前分支 | 填不存在的分支名 → 「No matching branch」、无 option「main」；Escape 后 textbox 隐藏、仍是「Branch main」；reload 后仍是「Branch main」 | 访客身份 |
| 54 | REQ-4-3-2 S1 | 有写权限用户从当前修订建分支并切换 | alice → Branch main → Find branch 填 `pw-branch-<后缀>` → option「Create branch: <名>」→ 按钮变「Branch <名>」、有 README.md、无 main-only.md（基于 main）；reload 后仍选中；再次打开能搜到该 option | 名字按描述用 `pw-branch-<后缀>` 而不是场景里的 `feature/api-v2` |
| 55 | REQ-4-3-2 S2 | 非法分支名不会建分支 | 填 `invalid..branch` → 「Invalid branch」、无「Create branch: invalid..branch」option；回车 + Escape 后仍是 Branch main；reload 后再搜仍无该分支 option | — |
| 56 | REQ-4-3-3 S1 | 管理员改默认分支，旧分支保留 | alice → Code 页 → Settings → Branches → combobox「Default branch」selectOption `release` → button「Update」→ button「Confirm」→ 对话框关闭；重新打开（goto + reload）Code 页显示「Branch release」，选择器里仍有 option「main」；再进 Settings → Branches 并 reload，下拉仍选中 release；最后改回 main 并确认 | 目标分支按场景用 `release`；不假定确认后停留在设置页；末尾复原 |
| 57 | REQ-4-3-3 S2 | 无管理权限用户不能改默认分支 | 新注册账号 → acme-docs 的 Code 页，记下「Branch <x>」→ 有 Settings/Branches 就进去 → 不存在 combobox「Default branch」和 button「Update」；重新打开仓库，分支按钮与开始时相同 | A3；「不变」按本条开始时的值比较，不依赖上一条是否成功复原 |
| 58 | REQ-4-4 S1 | Web 编辑器提交新文件并保留历史 | alice → acme-docs 的 Code 页 → button「Add file」→ menuitem「Create new file」→ label「File name」`pw-file-<后缀>.md`、textbox「File contents」、「Commit message」初始为空，填 `Add <文件名>` → button「Commit changes」→ 精确显示内容 → link「Commits」→ 精确显示提交信息，reload 后仍在 → 回到 Code 页有该文件链接 | 写到默认分支（main） |
| 59 | REQ-4-4 S2 | 空提交信息或非法路径不改变分支 | 记下 Code 页「Commits」链接文字；新建文件填 `../invalid.md`、内容 `must not be saved`、提交信息留空 → 出现「Invalid file path」或「Commit message is required」，仍在编辑器；重新打开 Code 页并 reload：无 invalid.md 链接，「Commits」链接文字不变，历史里有 `Document search flow`、没有 `must not be saved` | 「Commits」链接文字带提交数时能直接看出历史是否变化，不带数时这一项等于不检查 |

## 调试工具（不属于测试套件）

- `debug-run.sh`：与 `../run.sh` 同配置，但保留 report.json 和 error-context 快照。
- `explore.sh`：起一个应用副本，跑一段只读 Playwright 脚本，用来看测试失败时页面的真实结构（不读应用源码）。
- `compare.py`：把一次运行结果和隐藏标签逐条比对，用法 `python3 compare.py runs/final2-<app>.json ../github-labels-<sub>.json`。
- `why.py`：从 debug 运行的 report.json 里列出每条失败停在哪一步。
- `runs/final2-*.json`：最终版在六个应用上的官方设置结果（calibration.md 的数字来源）。`runs/debug-*`：定位失败原因用的 debug 运行（略早于最终版，个别条目后来有改动，以 calibration.md 为准）。`runs/probes/`：只读探查脚本。
