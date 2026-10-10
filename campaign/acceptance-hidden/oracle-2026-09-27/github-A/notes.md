# github-A 测试说明（REQ-1 身份与访问、REQ-2 组织/团队/成员/仓库授权，order 1–30）

文件：`tests/10-REQ-1-1-1.spec.cjs` … `tests/21-REQ-2-3.spec.cjs`，一个需求一个文件，文件内顺序 = intents.json 的 order。

## 全局约定与假设

- 登录：首页唯一的 link「Sign in」→ textbox「Username or email」「Password」→ button「Sign in」。已登录判据：button「Account menu」可见，且用户名作为独立词可见（REQ-6「account username visible after authentication」）。【假设】用户名只要在页面上以整词出现即可，不要求一定在 Account menu 控件内部。
- 控件一律 role + 精确名。密码框在 Playwright 里也是 textbox 角色，所以统一用 `getByRole('textbox', { name, exact: true })`。
- 消息文字用需求给的完整原文，`getByText(原文)`（大小写不敏感的包含匹配，严格模式）；「123456」按需求要求用精确文本。
- 改凭据的场景（找回密码、改密码）一律先在页面上注册一个带唯一后缀的新账号再操作（需求原文：「recovery scenario uses a newly registered account」「Each password-change scenario starts with its own verified account」），保证 alice-dev 的密码在整套里不变。
- 种子假设：alice-dev 是 Acme Demo 的 Owner；bob-reviewer 是普通成员；团队 platform-team → frontend-team → frontend-child（取自 REQ-2-2-4 S2 GIVEN 里那句错位的种子说明）；acme-docs 是 Acme Demo 的公开仓库；私有仓库名只知道 `secret-research`。
- 组织入口：已登录走 Account menu →「Your organizations」→ link「Acme Demo」（非精确匹配，因为链接里可能同时带标识符）；访客走首页上的 link「Acme Demo」。【假设】需求没写访客怎么到组织页，首页链接是唯一能想到的点击路径（app13 首页有这个链接，其隐藏 REQ-2-1-1 S2 通过；app11 首页没有，两条都失败，一致）。
- 「displays the reason beside the corresponding field」写明的字段错误（注册、找回的验证码、改密码、建组织），额外断言消息与对应输入框共享一个局部容器，而不是落在和页头同级的全局状态栏里（`expectBesideField`）。
- 新建的组织、团队、账号都带 `Date.now()+随机` 后缀，重复跑不冲突。

## 逐条

| # | 测试 | 意图 | 关键断言 | 假设 |
|---|---|---|---|---|
| 1 | REQ-1-1-1 S1 | （未知，按描述推定）注册成功 | 表单四个 textbox、复选框「Agree to the terms」初始未勾选、「Create account」可用；注册 `pw-user-<uid>` 后落到登录表单、页面不出现密码；用新邮箱立即登录，刷新后仍显示用户名 | 三条未知意图的顺序假设为 成功/重名/多字段非法；成功提示文字未规定，不断言 |
| 2 | REQ-1-1-1 S2 | （未知，推定）重名用户名 + 新邮箱被拒 | 「Username already exists」在 Username 旁；Username、Email 保留原值；仍在注册页；用该邮箱登录得「Invalid credentials」 | 同上；app13 上本条通过、S3 失败，与隐藏标签一致，支持此顺序 |
| 3 | REQ-1-1-1 S3 | 不合规字段、未同意条款或确认密码不一致时不创建账户 | 一次提交 `-bad-user-<uid>` / `not-an-email` / `short` / `different` / 不勾条款，四条消息同时出现且各在对应字段旁；用户名和邮箱保留；用该用户名登录失败 | 不断言密码框被清空（app11 保留了 short，隐藏仍判通过） |
| 4 | REQ-1-1-2 S1 | 已验证账户正确凭据登录，重新打开后保持会话 | alice-dev 登录后已登录；reload、`goto(page.url())` 后仍已登录 | — |
| 5 | REQ-1-1-2 S2 | 错误凭据只显示通用失败信息且不创建会话 | 「Invalid credentials」、仍在登录页、无 Account menu；reload 与回首页后仍是「Sign in」链接 | — |
| 6 | REQ-1-1-2 S3 | 用已验证邮箱登录 | `alice.dev@example.test` 登录后显示 alice-dev，刷新保持 | 两个带标签应用隐藏都判失败而本测试通过，原因未查明（见 calibration.md） |
| 7 | REQ-1-1-2 S4 | 未知账户与错误密码结果相同 | 两次失败都显示「Invalid credentials」，文本完全相同，都不建会话 | — |
| 8 | REQ-1-1-3 S1 | 本地重置流程显示固定验证码并直接进入下一步 | 从登录页「Forgot password」进入；注册邮箱与未知邮箱各提交一次，都直接出现独立文本「123456」和 Verification code / New password / Confirm password /「Reset password」；注册邮箱用 123456 提交得「Password updated」，未知邮箱同样提交不出现「Password updated」 | 两次在同一页面顺序进行（重新从首页进入 Forgot password）；未知邮箱的失败提示文字未规定，只断言没有成功 |
| 9 | REQ-1-1-3 S2 | 错误验证码不更新密码 | 000000 →「Verification code is invalid」在验证码字段旁；候选新密码登录失败、旧密码登录成功 | 新注册账号 |
| 10 | REQ-1-1-3 S3 | 固定验证码 + 合规新密码更新凭据 | 123456 + `Replacement-password-456!` →「Password updated」；旧密码失败、新密码成功 | 新注册账号 |
| 11 | REQ-1-2 S1 | 确认退出后受保护页要求重新认证 | Account menu →「Your organizations」（以「New organization」链接为受保护内容标志）→ Account menu → link「Sign out」→ dialog「Sign out」→「Confirm sign out」；之后「Sign in」链接可见、无 Account menu、无 New organization；浏览器后退、刷新后同样 | 受保护页选「Your organizations」；不测 Cancel 分支 |
| 12 | REQ-1-2 S2 | 退出后直接重开受保护页仍需认证 | 同上退出后 `goto(记下的 URL)`，仍是未登录状态 | 同上 |
| 13 | REQ-1-3 S1 | 用当前密码改密码后新密码可登录 | Account menu → link「Settings」→ link「Password and authentication」→ 改为 `New-password-456!` →「Password updated」；新浏览器上下文里旧密码失败、新密码成功 | Settings、Password and authentication 的角色需求未写，按 link；用新上下文代替界面退出 |
| 14 | REQ-1-3 S2 | 当前密码错误或确认不一致时不改 | 当前密码错 + 确认 `does-not-match` 一次提交；出现「Current password is incorrect」或「Password confirmation does not match」之一且在对应字段旁；无成功；候选失败、旧密码成功 | 两条消息任一即可（需求原文「current-password or confirmation error」） |
| 15 | REQ-1-3 S3 | 缺当前密码被拒 | 当前密码留空 + `Required-password-789!` →「Current password is required」在 Current password 旁；旧密码仍可用 | — |
| 16 | REQ-2-1-1 S1 | 访客筛选公共组织仓库并进入概览 | 访客：首页 link「Acme Demo」→ link「Repositories」→ textbox「Find a repository」填 acme-docs → 选「Public」筛选 → link「acme-docs」→ 标题含「/acme-docs」→ 后退后 link 仍在 | 「Public」筛选的角色未规定：button/link/radio/tab/menuitemradio/option 任一精确名「Public」或原生 select 选项都接受（实测三个应用分别用了 link、radio、button）；组织名部分不确定，标题只校验「…/acme-docs」 |
| 17 | REQ-2-1-1 S2 | 访客看不到私有仓库 | 列表先有 acme-docs、无 secret-research；按 secret-research 过滤后两者都无；从首页重新进入再查一遍 | 组织私有仓库名需求未给，用唯一出现过的私有名 secret-research |
| 18 | REQ-2-1-2 S1 | 创建唯一组织后可重开概览 | 「Your organizations」→「New organization」→ `mobile-guild-<uid>` / Mobile Guild →「Create organization」；标题含标识符，刷新保持；列表里能找到（标识符或显示名）；`goto` 记下的概览地址标题仍在 | 列表按标识符或显示名都算 |
| 19 | REQ-2-1-2 S2 | 重复组织名不创建 | 先建 `dup-org-<uid>`，再以同名、空显示名提交 →「Organization name already exists」在字段旁；仍在表单；没有该组织标题；列表里该组织最多出现一次 | 「已存在的标识符」由本测试自己先建（种子组织标识符未知） |
| 20 | REQ-2-1-2 S3 | 不合规名或空显示名被拒 | `-invalid-organization` →「Organization name format is invalid」；合规名 + 纯空格显示名 →「Display name is required」；均在字段旁；两者都不出现在列表 | 分两次提交 |
| 21 | REQ-2-2-1 S1 | Owner 建团队后归属保持 | Acme Demo → link「Teams」→ link「New team」→「Team name」`mobile-team-<uid>` →「Create team」；标题含团队名，刷新保持；重开 Teams 列表有该 link | 不填描述和父团队 |
| 22 | REQ-2-2-1 S2 | 不合规或重复团队名不生成 | `-bad-team-<uid>` →「Team name format is invalid」；`frontend-team` 提交后仍在表单；Teams 列表 frontend-team 链接恰 1 个、无 bad-team | 重复名的提示文字未规定，不断言文字 |
| 23 | REQ-2-2-2 S1 | 维护者加/删成员，列表同步 | frontend-team → link「Members」→ button「Add member」→ textbox「Username」bob-reviewer → 唯一可点的「Add member」；bob-reviewer 精确文本恰 1 处、有「Remove bob-reviewer」；点击后立即消失，刷新后仍无 | 不做 WHEN 里「在 Settings 改父团队」这一步（会破坏 S2 依赖的种子层级） |
| 24 | REQ-2-2-2 S2 | 不能把后代设为父团队 | frontend-team → link「Settings」→ combobox「Parent team」当前为 platform-team → 选 frontend-child →「Save」→「Cyclic team hierarchy is not allowed」→ 刷新后仍是 platform-team | 「仍选中原父团队」按选中项标签或 value 为 platform-team 都算 |
| 25 | REQ-2-2-3 S1 | Owner 直接加 Member，双方页面持久 | 另一上下文注册新账号；alice → People → button「Add member」→「Username or email」→ 点 combobox「Role」再点 option「Member」→ 提交「Add member」；列表显示该用户名、离它最近的角色词是 Member、无 Pending/Awaiting，刷新保持；新成员登录后「Your organizations」有 Acme Demo 链接，刷新保持，并能打开组织概览 | 提交按钮按需求「提交按钮在页面顺序上跟在打开按钮后」用 `.last()`；Role 是「可点击选项」，原生 select 会失败；不测私有仓库「Access denied」（仓库名未知） |
| 26 | REQ-2-2-3 S2 | 已有成员或未知账户不产生重复关系 | bob-reviewer →「Account is already a member」；表单不关，改填 unknown-reviewer →「Account not found」；bob 恰 1 处、unknown 不出现，刷新后相同 | 同上 |
| 27 | REQ-2-2-4 S1 | Owner 移除成员后不再出现 | 新注册账号先被加为 Member；button「Member menu <user>」→ menuitem「Remove from organization」→ button「Remove」；立即消失，刷新后仍无 | 为不破坏种子，移除的是本测试自己加入的成员 |
| 28 | REQ-2-2-4 S2 | 非 Owner 不能移除他人 | 新账号被加为 Member 后自己登录进 People：无「Member menu bob-reviewer」按钮、无「Remove from organization」菜单项；刷新后 bob 仍在 | 同上 |
| 29 | REQ-2-3 S1 | 管理员给团队授予仓库角色，重开仍在 | 新建团队 `grant-team-<uid>`；acme-docs → link「Settings」→ link「Manage access」→「Add people or teams」（打开后自身隐藏）→ textbox「Search」→ 含团队名的 option → combobox「Role」→ option「Write」→「Add」；恰一个名称含团队名的 row，行内原生 select「Role」选中 Write；刷新保持 | 用公开的 acme-docs（需求说私有组织仓库，但名字未给）；团队自建，保证之前无授权；选择器控件取行外、原生 select 外的那个 |
| 30 | REQ-2-3 S2 | 改已有团队角色替换原授权 | 新团队先授 Write（前置条件也断言）；行内「Role」选 Read → 行内「Save」；刷新后该团队恰一行且为 Read | 同上 |
