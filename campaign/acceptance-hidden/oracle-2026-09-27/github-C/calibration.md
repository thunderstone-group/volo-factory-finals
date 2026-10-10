# github-C 校准（REQ-5/REQ-6，41 条，最终版 v6）

运行方式：`calibrate.sh v6`（每个应用单独起实例，端口 3451，官方同款配置），结果在 `results/<app>-v6.json`、完整报告 `results/<app>-v6.report.json`；交叉矩阵 `python3 matrix.py v6`，失败原因一行一条 `python3 why.py results/<app>-v6.report.json`，和隐藏标签逐条比对 `python3 compare.py RUN.json LABELS.json`。

## 通过数

| 应用 | 隐藏总分（100 条） | 本套件通过（41） | 其中访客场景（12 条） | 访客 + bob 场景（17 条，不用 alice-dev 登录） |
|---|---|---|---|---|
| github-25-4310823c83f3 | 25 | 24 | 5 | 6 |
| github-24-433d9936fb07 | 24 | 28 | 11 | 14 |
| github-24-99a2bc046345 | 24 | 26 | 5 | 6 |
| github-22-6dd494f9556b | 22 | 24 | 5 | 7 |
| github-7-95ec6880ee7f | 7 | 0 | 0 | 0 |
| github-13-5450c3c63fe0（标签：本范围隐藏 0/41） | 13 | 0，逐条一致 41/41 | 0 | 0 |
| github-11-7e3f4dba7736（标签：本范围隐藏 0/41） | 11 | 0，逐条一致 41/41 | 0 | 0 |

单条耗时在这些应用上都在 0.2–2.3 秒之间（最长的是 6-1 S2 里「有 Branches 链接就进」的 2 秒等待），离 10 秒上限很远。

## 最重要的发现：隐藏分被一个系统性因素压低，不是 REQ-5/6 的测试更严

四个好应用在本套件上过 24–28 条，而它们的隐藏总分只有 22–25（还要减去 REQ-1、REQ-3-1 的十来条）。github-B 在同样的应用上也是 REQ-3/4 过 17–26 条。两套独立写的测试同时「超出隐藏总分」，说明隐藏套件里有一个共同原因让大量在孤立运行时正确的测试失败。两份逐条标签指向的原因是：**隐藏套件在 REQ-1 里改掉了 `alice-dev` 的密码，之后所有用 `alice-dev` / `Valid-password-123!` 登录的场景全部失败。**

证据（`github-labels-sub*.json`）：
- app13：REQ-1-1-3 S3（order 10，用固定验证码重设密码）**通过**；紧接着 REQ-1-2 S1/S2（order 11–12，alice 登录后退出）**失败**，REQ-1-3 全失败；此后的通过项全是访客场景（REQ-2-1-1 S2、REQ-3-1 ×3、REQ-3-3、REQ-4-3-1 S1）。13 = order 10 之前的通过项 + 之后的访客通过项，一条不差。
- app11：密码找回坏了（REQ-1-1-3 全失败，密码没被改）→ REQ-1-2 S1/S2 **通过**；REQ-1-3 S1（order 13，改密码到 `New-password-456!`）隐藏失败，但我们的代理测试显示 app11 的改密码是能用的，很可能密码已改、只是后续断言没过；此后通过项只剩 REQ-3-1 的 3 条访客场景。11 条同样全部对得上。
- v2 需求里 REQ-1-1-3 和 REQ-1-3 的种子写的就是 `alice-dev` / `alice.dev@example.test`，v1 的 `E2E_PASSWORD_CHANGE_*` 夹具在 v2 被替换成这些值是最自然的解释。

推论：在任何「找回密码或改密码能用」的应用上，隐藏套件里 REQ-2 之后所有 alice-dev 场景都会挂，REQ-5/6 能拿分的只剩访客场景（可能再加 bob 场景）。所以要拿本套件预测隐藏分，应该看上表最后两列：访客 5/11/5/5/0，访客+bob 6/14/6/7/0，和主会话估计的 0–8 基本吻合（github-24-433d 偏高，见下文）。
备择解释（效果相同，现有数据分不开）：v2 的 REQ-2+ 登录场景用的是需求里没出现的角色账号（v1 是 `E2E_ISSUE_EDITOR_*` 等），应用里根本没有。区分它需要一个「找回和改密码都坏、但 REQ-2+ 登录场景能过」的应用的逐条标签。
本套件按 BRIEF 的目标（完美实现上整套 100% 通过、不破坏共享种子）刻意不复现这个效应；如果要让 oracle 直接预测隐藏分，可以让 github-A 的 REQ-1-1-3 S3 / REQ-1-3 S1 真的对 alice-dev 改密码，合并后按文档顺序跑。

## 用 app11 / app13 查「过宽」时做的收紧（都依据需求原文）

初版在 app13 上过了 12 条（隐藏 0 条），逐条查后改了这些，终版 app13、app11 都是 0 条、41/41 一致：
- 种子议题改为经 searchbox「Search issues」输入完整标题再点开（REQ-5-1-1「including when the entire seeded title is entered」）。app13 没有这个 searchbox，隐藏的议题详情类场景在 app13 上全挂，与此一致。
- 公开 Open PR 从 `Improve onboarding` 改为 `Fix search`：app13 的 `Improve onboarding` 是 Open 且 Open 筛选、刷新都正常，按旧写法 6-2-1 三条全过，而隐藏三条全挂；app13 的 `Fix search` 是 Closed。`Fix search` 也和 REQ-6-3-2 的 `src/search.ts` 对得上。
- 规则摘要、提交/文件摘要改为需求原文精确字符串：「1 approval」「Require status check test」「Commit summary」「Changed files」、「N additions, M deletions」严格唯一。
- 6-1 S1 按场景 WHEN 把「在 PR 的 Checks 里把 test 从 pending 改成 success」也做完。
- 种子草稿 PR 不再用「Draft」筛选兜底（需求没给这个控件的名字）。

## 典型失败逐条归因（v6）

| 应用 | 失败 | 原因 | 判断 |
|---|---|---|---|
| github-25 | 6-1 S1、6-2-1 ×3、6-3-1 ×3、6-3-2、6-5 S1 | 种子 `Fix search` 是 Closed（它把 `Improve onboarding` 当 Open PR） | 测试假设可能不对（种子角色需求没写死），但与 app13 的隐藏标签一致 |
| github-25 | 5-4 S2、6-3-3 S1/S2、6-3-4 S1/S2、6-6 S2 | bob 打开 Issues / Pull requests 时页面仍显示仓库概览（非 owner 看不到列表） | 应用缺陷 |
| github-25 | 6-1 S3 | 新 PR 详情页上看不到「test: pending」，要点 Checks 标签才有 | 取决于「Checks area is available on arrival」的读法，测试假设可能不对 |
| github-25 | 6-2-2 S2 | base=compare=main 仍显示「1 commit」和可用的 Create 按钮，无「No changes」 | 应用缺陷 |
| github-24-433d | 6-1 S1 | 规则只显示长句「at least 1 valid Approve …」「required check test is success」，没有「1 approval」「Require status check test」 | 应用缺陷（没按契约字符串） |
| github-24-433d | 6-2-1 S1 | 有两个都叫 `Fix search` 的 PR（一个 Open 一个 Closed），Closed 筛选下仍有同名链接 | 应用缺陷（种子标题不唯一） |
| github-24-433d | 6-2-2 S1 | 比较页没有「Commit summary」字样 | 应用缺陷或测试假设（把 Commit summary 当字面文字） |
| github-24-433d | 6-2-4 S1 | 草稿 PR 没有（禁用的）「Merge pull request」按钮 | 应用缺陷 |
| github-24-433d / 99a2 | 6-3-3 S2 | bob 的待提交评论对 PR 作者可见 | 应用缺陷 |
| github-24-433d | 6-3-4 S1、6-5 S1 | Files changed 上没有「Review changes」，因此无批准，合并按钮禁用 | 应用缺陷（6-5 S1 是连带失败） |
| github-24-433d | 6-2-4 S2、6-5 S2、6-6 ×2 | 默认 PR 列表里找不到草稿 PR `Draft onboarding update` | 应用缺陷或测试假设（未给 Draft 筛选名，测试只在默认列表里找） |
| github-24-99a2 / 22 | 5-4 S2、6-6 S2（99a2） | Write 用户 bob 能看到「Close issue」/「Close pull request」 | 应用缺陷（需求要求隐藏） |
| github-24-99a2 | 6-2-4 S2 | 「Ready for review」事件在时间线里出现两次，再加一处同文字 | 应用缺陷（重复记录，严格模式失败） |
| github-22 | 5-2-1 S2 | 空白标题没有显示「Title is required」 | 应用缺陷 |
| github-22 | 5-2-3 S1 | 评论正文在页面上出现两次（严格模式） | 应用缺陷 |
| github-22 | 6-5 S2 | 没有「Review required by branch protection」 | 应用缺陷 |
| github-7 | 全部登录场景 | 登录后 `alice-dev` 文字出现两次，登录判据严格模式失败 | 应用缺陷（隐藏 v1 helper 同样判据；其隐藏总分只有 7） |
| github-7 | 全部访客场景 | 仓库页没有渲染出仓库导航（找不到 Issues / Pull requests 链接） | 应用缺陷 |
| app13 | 全部 | 无「Search issues」searchbox、新建议题无「Title」标签、比较页无 base/compare、bob 用 `Valid-password-123!` 登录失败、`Fix search` 为 Closed | 应用缺陷为主；bob 密码是测试假设 |
| app11 | 全部 | 无「Search issues」、无「Title」、PR 列表无「Open」链接、无「New pull request」 | 应用缺陷 |

## 仍然最不确定的测试假设

1. 公开 Open PR 是 `Fix search`（依据 app13 标签反推）。若隐藏用的是 `Improve onboarding`，github-25/99a2/22 的 PR 访客场景会多过 4–7 条。
2. 种子议题经「Search issues」打开（同样由 app13 标签反推）。
3. 「Checks area is available on arrival」= 不点 Checks 标签。
4. `bob-reviewer` 是 Write、非作者、密码 `Valid-password-123!`，并当所有「无权限」场景的用户（隐藏用的是 Read 账号，身份不明）。
5. 仓库经全局搜索进入（与 github-B 一致）。我观察到 app11 的访客首页不列仓库（其余 6 个应用都列出 `acme-docs` 链接），而 github-B 的搜索式测试在 app11 上能过的仓库访客场景（REQ-3-3、REQ-4-3-1 S1 等），隐藏全判失败；隐藏测试有可能是点首页列表里的 `acme-docs` 链接进入仓库。本套件未改，以免与 github-B 分叉。
6. 文档顺序链：6-1 S1（main 保护 + Fix search 的 test=success）→ 6-3-4 S1（bob 批准）→ 6-5 S1（合并）；6-2-4 S2（草稿转 Open）→ 6-5 S2、6-6。前一条的应用缺陷会连带后一条。
