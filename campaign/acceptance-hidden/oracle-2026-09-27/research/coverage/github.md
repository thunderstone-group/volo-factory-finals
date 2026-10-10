# GitHub — 隐藏意图 vs 自写测试覆盖率逐条核对

对每条隐藏意图，在同一顶层需求（REQ-N）文件组的**全部**自写测试里找最佳匹配（不限同编号 #k），按 full / partial / none 三档判定；`hidden_intent_zh` 为 unknown 的记为 skip，不计入三档统计。

档位：**full**=有一条自写测试执行了同样的操作并断言了同样的关键结果；**partial**=操作相近但漏了意图的关键部分（理由前用 `[标签]` 标注漏测类型）；**none**=没有任何自写测试测这件事；**skip**=隐藏意图未知，不评估。

类别标签：PERSIST 持久化缺刷新/重开验证｜REJECT_STATE 拒绝路径完全未触发｜CROSS_FEATURE 跨功能交互未测｜ISOLATION 多实体隔离未测｜PERMISSION 权限拒绝路径未测或测反｜BOUNDARY 边界值/极端输入未测｜DUP_ONE_VARIANT 多种同类情况只测一种｜OTHER 其他。

自写测试文件：`.../dda185fd-2611-4346-bf8a-2f0f7bee4f92/scratchpad/gh/orig/t0N-REQ-X.spec.cjs`（`suite.json` 为清单）。

## REQ-1 Identity and Access

| req | n | hidden_intent_zh | 档位 | 理由 |
|---|---|---|---|---|
| REQ-1-1-1 | 1 | (unknown；三选一模糊提示：不合规字段/未同意条款/确认密码不一致时不创建账户) | skip | 意图未知，不评估。 |
| REQ-1-1-1 | 2 | (unknown，同上) | skip | 意图未知，不评估。 |
| REQ-1-1-1 | 3 | (unknown，同上) | skip | 意图未知，不评估。 |
| REQ-1-1-2 | 1 | 已验证账户使用正确凭据登录，重新打开后保持会话 | full | 邮箱登录成功后 reload，Account menu 与用户名仍在。 |
| REQ-1-1-2 | 2 | 错误凭据只显示通用失败信息且不创建会话 | full | 密码错测试断言仅显示 "Invalid credentials" 且无 Account menu。 |
| REQ-1-1-2 | 3 | 使用已验证邮箱而非登录名也能建立会话 | full | 用邮箱登录成功并 reload 保持会话。 |
| REQ-1-1-2 | 4 | 未知账户与错误密码显示相同的通用失败结果 | partial | [OTHER] 未知账户、密码错误分别断言同一句 "Invalid credentials"，但没有测试把两者放在同一流程里直接比较，未验证"不可区分性"这个比较性主张本身。 |
| REQ-1-1-3 | 1 | 本地重置流程显示固定验证码并直接进入下一步 | full | 对已注册与未知邮箱都验证了直接显示 123456 和重置表单。 |
| REQ-1-1-3 | 2 | 错误验证码不会更新密码，旧密码仍可登录 | full | 用错误码 000000 断言 "Verification code is invalid"，随后旧密码登录成功。 |
| REQ-1-1-3 | 3 | 固定验证码配合合规新密码更新凭据 | full | 验证正确码+合规新密码后 Password updated、旧密码失效、新密码可登录。 |
| REQ-1-2 | 1 | 已登录用户确认退出后，受保护页面重新要求身份验证 | full | 登出确认后直接 goto 已记录的受保护 URL，断言仍是未登录态。 |
| REQ-1-2 | 2 | 退出后直接重新打开受保护页面仍需重新认证 | full | 同一条测试以"直接 goto 记录的 URL"方式覆盖；套件里没有单独用刷新或浏览器后退这两种重入方式复测，但核心断言已命中。 |
| REQ-1-3 | 1 | 使用当前密码修改密码后，新密码可用于后续登录 | full | 改密后登出，旧密码登录失败、新密码登录成功。 |
| REQ-1-3 | 2 | 当前密码错误或确认密码不一致时，密码不会被修改 | partial | [DUP_ONE_VARIANT] 只测了"当前密码错误"，没有任何自写测试测"确认密码不一致"分支。 |
| REQ-1-3 | 3 | 缺失当前密码时拒绝更新，旧密码保持有效 | full | 清空当前密码断言 "Current password is required"，随后旧密码仍能登录。 |

full=10 partial=2 none=0 skip=3（共15）

## REQ-2 Organization and Governance

| req | n | hidden_intent_zh | 档位 | 理由 |
|---|---|---|---|---|
| REQ-2-1-1 | 1 | 访客可筛选公共组织仓库并进入所选仓库概览 | full | 创建私有仓库后登出变访客，筛选 acme-docs，选 Public，点开验证标题，reload 后仍持久。 |
| REQ-2-1-1 | 2 | 访客不会在公共组织仓库列表中看到私有仓库 | full | 同一条测试里断言私有仓库 link count 为 0，精确覆盖隔离检查。 |
| REQ-2-1-2 | 1 | 已登录用户创建唯一组织后可重新打开其概览 | full | 创建组织后验证 heading，reload 持久，再查 People 页 Owner 角色，再从 Your organizations 重新打开。 |
| REQ-2-1-2 | 2 | 重复组织名不会创建新的组织 | full | 只填已存在的 Organization name，断言 "already exists" 且未跳转到成功页。 |
| REQ-2-1-2 | 3 | 不合规组织名或空显示名会被拒绝且不创建组织 | full | 同一条测试后半段用非法名+空白 display name，两条错误消息都有断言。 |
| REQ-2-2-1 | 1 | 组织所有者创建团队后，团队归属在重新打开后保持 | full | 创建团队后 reload 验证 heading，再从 Teams 列表重新打开验证 link 存在。 |
| REQ-2-2-1 | 2 | 不合规或重复团队名不生成团队 | partial | [DUP_ONE_VARIANT] 只测了格式不合规一种拒绝原因，没有测试用已存在团队名重复创建来验证"重复"这条路径。 |
| REQ-2-2-2 | 1 | 团队维护者添加并移除成员，成员列表会同步更新 | full | 加成员可见，移除后 count 0，reload 后仍为 0，且验证 parent 设置不受影响。 |
| REQ-2-2-2 | 2 | 不能把团队的后代团队设为父团队形成循环层级 | full | 构造 parent→child→descendant 三级链，把 child 的 parent 改成 descendant，断言 "Cyclic team hierarchy is not allowed" 且 reload 后 parent 仍是原值。 |
| REQ-2-2-3 | 1 | Owner 直接添加 Member 后成员关系在双方页面持久化 | full | Owner 侧 People 页 reload 验证，再切换成 member 身份在 Your organizations 里验证可见且 reload persists，双边都测了。 |
| REQ-2-2-3 | 2 | 已有成员或未知账户不会产生重复成员关系 | none | [REJECT_STATE][DUP_ONE_VARIANT] 对应槽位是 `test.skip` 空壳（模板文本太泛无法断言），整组测试没有任何一条尝试添加重复成员或未知账户。 |
| REQ-2-2-4 | 1 | 组织所有者移除成员后，该成员不再出现在组织人员列表 | full | 移除后 count 0，reload 后仍 0，还验证被移除者自己的 organizations 列表和个人仓库不受影响。 |
| REQ-2-2-4 | 2 | 非组织所有者不能移除其他组织成员 | full | 非 owner 身份下 "Member menu" 按钮和菜单项均 count 0，reload 后 owner 仍在列表。 |
| REQ-2-3 | 1 | 管理员向团队授予仓库角色后，授权在重新打开时仍可见 | full | 授予 Write 后 reload 验证 row 存在，且重复授予同角色不产生第二行。 |
| REQ-2-3 | 2 | 修改已有团队角色会替换原授权而不会生成重复记录 | full | 把 Write 改成 Read，断言仍只有 1 行且内容为 Read，reload 后再次验证。 |

full=13 partial=1 none=1 skip=0（共15）

## REQ-3 Repository Asset Management

| req | n | hidden_intent_zh | 档位 | 理由 |
|---|---|---|---|---|
| REQ-3-1 | 1 | 访客搜索可见仓库并从结果打开仓库概览 | partial | [OTHER] 断言了公开仓库链接可见、点开后标题正确、reload 持久，但意图明确要求结果页同时显示 description 和 update time，测试只核对了 owner/name 文本；也没有测试"直接访问未授权私有仓库地址应被拒绝"这一半。 |
| REQ-3-1 | 2 | 访客搜索时不会得到无权访问的私有仓库结果 | full | 同一条测试里断言私有仓库 link count 为 0（混合搜索和精确搜索私有名两次都验证），精确命中。 |
| REQ-3-1 | 3 | 无匹配搜索显示空结果而不会展示无关仓库 | full | 同一条测试搜索不存在的仓库名，断言 "No results" 且公开仓库不再残留，精确命中。 |
| REQ-3-1 | 4 | 公开仓库搜索结果在刷新后仍然可见 | none | [PERSIST] 全部 4 条搜索测试的 reload 都发生在"点开仓库详情页之后"，没有一条测试是停留在搜索结果列表页时直接刷新——测的对象是仓库详情持久化，不是"搜索结果列表"本身的持久化。 |
| REQ-3-2-1 | 1 | 已登录用户以指定可见性和 README 初始化创建仓库 | full | 创建 Private+README+description 仓库，核对 overview，reload 复核，再验证可搜索，精确命中。 |
| REQ-3-2-1 | 2 | 重复仓库名不会创建半完成的仓库 | none | [REJECT_STATE] 三条创建测试全部使用随机唯一名，没有一条尝试用已存在的仓库名重复创建；需求描述明确给了"同命名空间已有仓库"这个专用种子用于该场景，自写测试完全没用上。 |
| REQ-3-2-1 | 3 | 空仓库名不会创建仓库并显示字段错误 | none | [REJECT_STATE] 三条创建测试都提交了合法名称，没有一条尝试提交空仓库名。 |
| REQ-3-2-2 | 1 | 用户将可访问仓库 Fork 到个人命名空间后可查看来源链接 | full | Fork acme-docs 后核对标题与 "Forked from acme-docs" 来源文本，reload 复核两者，再验证可搜索，精确命中。 |
| REQ-3-2-2 | 2 | 目标命名空间已有同名 Fork 时不创建第二个 Fork | none | [REJECT_STATE][DUP_ONE_VARIANT] 该测试只是把前一个场景重复了一遍（同样生成随机唯一 fork 名），完全没有使用需求描述里指定的冲突种子名 `acme-docs-fork` 去触发"已存在同名 Fork"的拒绝路径。 |
| REQ-3-2-3 | 1 | 访客复制 HTTPS 克隆地址时得到可粘贴 URL 且仓库内容不变 | partial | [OTHER] 访客身份点 Code→HTTPS→Copy，断言 "Copied" 提示和仓库标题不变、菜单可重新打开，但从未读取剪贴板实际内容来验证复制的确实是合法可粘贴的 HTTPS URL。 |
| REQ-3-2-3 | 2 | 用户选择 SSH 时复制 SSH 克隆地址 | partial | [OTHER] 选中 SSH 标签并点击复制、断言 "Copied" 提示和 reload 后标题仍在，但同样从未读取剪贴板验证复制的是 SSH 格式（含冒号和 .git 后缀）的值。 |
| REQ-3-3 | 1 | 访客打开公共仓库概览可查看身份、可见性和内容入口 | full | 访客身份核对标题、Public 标记、Code/Issues/Pull requests/README 链接，点开 README 核对内容，reload 复核，还额外验证访客搜索私有仓库得 0 结果，覆盖全面。 |
| REQ-3-4 | 1 | 仓库管理员确认变更可见性后，访客访问规则同步更新 | full | 管理员把新建私有仓库改成 Public 并确认，reload 复核，随后登出以访客身份重新搜索打开该仓库，验证访客确实能看到 Public 内容，精确命中"访客规则同步更新"。 |
| REQ-3-4 | 2 | 无管理员权限的用户不能看到可执行的可见性修改入口 | none | [PERMISSION] 测试签入的是仓库所有者/管理员本人，断言的是"管理员能看到 Change visibility 按钮"，这与"无权限用户看不到该入口"的意图完全相反；自写测试从未建立过一个真正的非管理员身份来验证按钮缺失。 |

full=6 partial=3 none=5 skip=0（共14）

## REQ-4 Code and Version Control

| req | n | hidden_intent_zh | 档位 | 理由 |
|---|---|---|---|---|
| REQ-4-1 | 1 | 用户可逐级浏览目录并查看所选分支中的文件内容 | full | 完整走 src→search.ts、切到 feature-search 后文件消失、reload 后仍消失。 |
| REQ-4-2-1 | 1 | 用户可查看分支提交历史中的消息、作者和时间 | partial | [OTHER] 测了 message 文本和相对时间，点开 commit 也验证了 Changed files；但从未断言作者字段，意图明确要求"消息、作者和时间"三项。 |
| REQ-4-2-2 | 1 | 用户打开提交后可查看变更文件和新增/删除差异 | full | 完整验证 Changed files、路径、additions/deletions 文本，并点击变更文件跳转。 |
| REQ-4-2-3 | 1 | 用户在仓库范围搜索代码并打开匹配文件 | partial | [ISOLATION] 只测了基本搜索+开文件；意图明确要求测路径过滤和"不泄露未授权私有仓库内容"，两者均未测。 |
| REQ-4-2-3 | 2 | 仓库代码无匹配项时显示空结果且保持仓库搜索范围 | full | 空结果文案、搜索框保留原查询词、reload 后仍空。 |
| REQ-4-2-3 | 3 | 代码搜索结果在刷新后仍然保留当前文件上下文 | full | 搜索并打开 README.md 后 reload，内容仍可见。 |
| REQ-4-2-3 | 4 | 空代码搜索在返回代码页后仍保持空结果 | partial | [OTHER] 只测了 page.reload() 下空结果保持，意图点名"返回代码页"这条导航路径未覆盖。 |
| REQ-4-3-1 | 1 | 用户从分支选择器切换分支，浏览上下文随之变化 | full | 切到 feature-search 显示专属文件、选择器列出两个分支、切回 main 文件消失。 |
| REQ-4-3-1 | 2 | 分支搜索无匹配项时保持当前活动分支不变 | full | "No matching branch"、Escape 关闭、reload 后仍是 main。 |
| REQ-4-3-2 | 1 | 有协作权限的用户从现有修订创建并切换到新分支 | partial | [OTHER] 创建并切换、reload 持久化都测了；但意图明确要求验证新分支初始内容/commit 与原 main head 一致、原分支未被重写，测试完全没碰。 |
| REQ-4-3-2 | 2 | 非法分支名不会创建分支 | none | [BOUNDARY] 自写测试用的是合法格式的随机分支名，只验证"创建选项出现"然后 Escape 取消，从未尝试任何非法字符，完全没测拒绝路径。 |
| REQ-4-3-3 | 1 | 管理员修改默认分支后，新打开的仓库使用新分支且旧分支保留 | full | 改默认分支、设置页 reload 持久化、重新打开仓库显示新默认分支、旧分支仍在选择器中。 |
| REQ-4-3-3 | 2 | 没有仓库管理权限的用户不能修改默认分支 | none | [PERMISSION] 对应测试是 `test.skip(...)`，注释写明没有已知凭据的非 Admin 协作者账号，整条测试从未执行。 |
| REQ-4-4 | 1 | 有写权限的用户通过 Web 编辑器提交文件变更并保留提交历史 | full | 建文件、reload 持久化、Commits 历史显示提交信息、reload 后仍在。 |
| REQ-4-4 | 2 | 空提交消息或非法文件路径不会改变分支内容 | none | [REJECT_STATE][BOUNDARY] 测试只检查表单字段/按钮可见，从未真正提交空 commit message 或非法路径，完全没碰验证/拒绝逻辑。 |

full=8 partial=4 none=3 skip=0（共15）

## REQ-5 Work Planning and Issue Management

| req | n | hidden_intent_zh | 档位 | 理由 |
|---|---|---|---|---|
| REQ-5-1-1 | 1 | 用户按状态和关键词筛选议题，筛选不改变原议题 | full | 组合 Open状态+关键词+bug标签筛选，切到 Closed+另一关键词验证切换正确，点开议题确认内容未被筛选动作改变。 |
| REQ-5-1-1 | 2 | 按关闭状态筛选时只显示匹配的已关闭议题 | full | Closed+关键词筛选，只显示匹配项，reload 后持久，精确命中。 |
| REQ-5-1-2 | 1 | 用户打开议题详情可查看标题、描述、状态和讨论 | partial | [OTHER] 核对了标题/描述/Open状态/Assignees·Labels·Milestone字段标签，但没有一条检查任何评论作者、评论内容或活动时间线，"讨论"部分完全没测。 |
| REQ-5-1-2 | 2 | 议题详情在刷新后仍保持标题和描述可见 | full | 3 条测试都做了 reload 后重新核对标题+描述，精确命中。 |
| REQ-5-1-2 | 3 | 离开后重新打开议题仍显示同一详情 | none | [PERSIST] 3 条测试全部只用 `page.reload()` 原地刷新，没有一条测试是"离开到列表页再重新点进来"这条路径。 |
| REQ-5-2-1 | 1 | 已登录用户创建非空议题后，详情和列表均可找到该议题 | full | 创建后验证详情页显示、返回列表页验证可见，精确命中。 |
| REQ-5-2-1 | 2 | 空白标题不会创建议题 | partial | [REJECT_STATE] 验证了空白标题提交后报错"Title is required"，但没有回到议题列表确认确实没有新增一条空标题的议题，只测了报错没测状态未变。 |
| REQ-5-2-2 | 1 | 有编辑权限的用户保存新标题和描述，重新打开后仍显示新值 | full | 依次编辑标题、描述，reload 后都保持，列表页也显示新标题，完整覆盖。 |
| REQ-5-2-2 | 2 | 空白标题保存失败且重新打开后仍保留原标题 | full | 空标题保存被拒绝报错，reload 后确认原标题仍在，精确命中。 |
| REQ-5-2-3 | 1 | 已登录用户发布非空评论后，评论和作者持久化在时间线中 | none | [OTHER] 对应的自写测试本身被 `test.skip()` 跳过（作者备注看不懂反应菜单的可访问名称需求），另一条测试只测了空白评论被拒绝，全组没有一条真正提交过有效非空评论并核对其内容/作者出现在时间线。 |
| REQ-5-2-3 | 2 | 空白或纯空格评论不会新增时间线记录 | full | 纯空格评论被拒绝（按钮禁用或报错），reload 后评论条数前后一致，精确命中。 |
| REQ-5-3-1 | 1 | 用户分配并取消分配可用成员，议题元数据会同步更新 | partial | [ISOLATION][PERMISSION] 分配→持久→取消分配→持久的核心机制完整覆盖，但"可用成员"暗示的资格过滤（不可分配的外部账号搜不到）和"无维护权限用户不能保存"两条都没有测试触及。 |
| REQ-5-3-2 | 1 | 用户为议题应用当前仓库标签，重新打开后标签仍可见 | partial | [ISOLATION] 应用标签→持久→移除→持久核心机制完整，但"当前仓库"暗示的跨仓库隔离（另一仓库同名标签不该出现在选择器里）从未构造第二个仓库验证。 |
| REQ-5-3-3 | 1 | 用户将议题归入当前仓库里程碑，关联在重新打开后仍存在 | partial | [ISOLATION][PERMISSION] 选择里程碑→持久→移除→持久核心机制完整，但跨仓库隔离（另一仓库的里程碑不该可选）和权限边界都未测。 |
| REQ-5-4 | 1 | 有权限的用户关闭并重新打开议题，状态转换会记录在活动中 | full | 关闭→活动记录"Closed issue"→重新打开→该活动仍保留在时间线→其他字段不变→reload 持久，覆盖非常完整。 |
| REQ-5-4 | 2 | 没有议题管理权限的用户不能关闭或重新打开议题 | full | 用全新注册的低权限账号打开同一议题，Close/Reopen 按钮均不可见，reload 后依然不可见；是全审计里少数真正构造了"权限更低的新账号"来测权限边界的测试。 |

full=9 partial=5 none=2 skip=0（共16）

## REQ-6 Change Review and Merge Control

| req | n | hidden_intent_zh | 档位 | 理由 |
|---|---|---|---|---|
| REQ-6-1 | 1 | 管理员保存分支保护规则后，规则在重新打开时仍可见 | full | 创建规则后经 Settings→Branches 重新进入并 reload，断言 "1 approval"/"Require status check test" 仍可见。 |
| REQ-6-1 | 2 | 非仓库管理员不能创建或修改分支保护规则 | none | [PERMISSION] 对应测试是 `test.skip(...)`，作者自陈缺非管理员账号种子，整条测试从未运行。 |
| REQ-6-1 | 3 | 管理员将当前比较提交的 test 检查更新为 success 且结果持久化 | full | 更新 check 为 success 后 reload 并重新点开 Checks，断言 "test: success" 仍在。 |
| REQ-6-2-1 | 1 | 用户按打开状态筛选拉取请求并打开目标提案 | full | 按 Open+author 筛选、打开详情、返回列表切到 Closed 验证原 PR 消失。 |
| REQ-6-2-1 | 2 | 打开状态筛选在刷新后仍保持相同提案可见 | partial | [PERSIST] 直接 reload 列表页，从未先点击 "Open" 筛选再断言持久化，测的是默认列表刷新而非筛选状态持久化。 |
| REQ-6-2-1 | 3 | 离开后重新进入拉取请求列表仍能找到打开状态提案 | partial | [PERSIST] 组内测试都用 page.reload() 代替"离开再重新进入"，也未先应用 Open 筛选就检查持久化。 |
| REQ-6-2-2 | 1 | 协作者比较两个不同分支后可查看提交数、文件和差异摘要 | full | 选择 main/feature-search 比较，断言文件路径可见且创建按钮可用，再切回同分支验证按钮变禁用。 |
| REQ-6-2-2 | 2 | 基础分支和比较分支相同时不能创建拉取请求 | full | 同分支比较，断言 "No changes" 且创建按钮禁用。 |
| REQ-6-2-3 | 1 | 协作者基于有效比较创建打开状态的拉取请求 | full | 完整走创建流程并 reload+从列表重新进入验证持久化。 |
| REQ-6-2-3 | 2 | 空白标题不会从比较结果创建拉取请求 | full | 先空标题提交断言 "Title is required"，未跳转即未创建，随后补标题才创建成功。 |
| REQ-6-2-4 | 1 | 协作者创建草稿拉取请求后显示 Draft 且不可合并 | full | 创建草稿后断言 Draft 标记+Merge 按钮禁用，reload 及从列表 Draft 筛选重新进入均验证。 |
| REQ-6-2-4 | 2 | PR 作者可将草稿标记为可评审且不改变其内容 | full | 点击 Ready for review 后断言 Draft 消失/Open 出现，reload 及登出后以另一身份重新打开均验证 Open 持久。 |
| REQ-6-3-1 | 1 | 评审者可在拉取请求查看概览、提交和变更文件上下文 | full | 依次打开 Conversation/Commits/Files changed 三个标签并断言各自内容，reload 后复核。 |
| REQ-6-3-1 | 2 | 拉取请求详情在刷新后仍保留标题和标签页入口 | partial | [PERSIST] reload 后只再断言标题，未重新断言 Commits/Files changed/Conversation 等标签入口仍在。 |
| REQ-6-3-1 | 3 | 离开后重新打开同一拉取请求仍能查看概览和变更文件 | partial | [PERSIST] 只用 reload 代替"离开重新打开"，且 reload 后未重新验证 Files changed 内容。 |
| REQ-6-3-2 | 1 | 访客查看拉取请求差异时可看到文件路径和增删行汇总 | partial | [PERSIST][PERMISSION] 以访客身份验证了路径与 additions/deletions 文本，但 reload 后只断言标题、未重新断言 diff 内容，且从未测试"无权限用户看不到私有 PR diff"。 |
| REQ-6-3-3 | 1 | 评审者在变更行添加单条评论后，评论会显示在讨论中 | full | 添加单条评论后在 Files changed 和 Conversation 两处都断言可见，并 reload 验证。 |
| REQ-6-3-3 | 2 | 开始评审时行内评论保持待提交状态而不立即发布 | full | 同一测试里验证 Start a review 后评论仅显示 Pending review、在 Conversation 里 0 条，提交评审后才出现。 |
| REQ-6-3-4 | 1 | 评审者提交批准决定后，拉取请求显示该评审状态 | full | 提交 Approve+summary 后断言 "Approved" 与 summary 均可见，reload 复核。 |
| REQ-6-3-4 | 2 | 评审者请求修改时保存评审意见和 Changes requested 状态 | full | 提交 Request changes 断言 "Changes requested"+summary，reload 复核。 |
| REQ-6-4 | 1 | 作者请求并移除评审者后，评审者区域同步更新 | partial | [PERSIST][PERMISSION] 测了添加后出现 Remove 按钮、移除后消失且 reload 后仍消失，但没测"添加后 reload 仍保留"，也没测非作者/非维护者不能改动评审人。 |
| REQ-6-5 | 1 | 维护者合并满足条件的拉取请求后，详情显示 merged 状态 | full | 设置 check success+Approve 后合并，断言 Merged 并 reload 复核。 |
| REQ-6-5 | 2 | 未满足评审或保护规则时不能合并拉取请求 | full | 断言缺少 approval 时 Merge 按钮禁用且显示 "Review required by branch protection"，reload 后仍禁用。 |
| REQ-6-6 | 1 | 作者关闭并重新打开拉取请求，状态转换保留在活动记录中 | partial | [OTHER] 测了 Close/Reopen 按钮切换与 reload 后状态持久，但从未打开 Conversation 检查两次状态转换是否记录进活动时间线。 |
| REQ-6-6 | 2 | 非作者且非维护者不能关闭或重新打开拉取请求 | full | 用全新注册的普通用户验证 Close/Reopen 按钮均不可见，reload 后依旧不可见。 |

full=17 partial=7 none=1 skip=0（共25）

## GitHub 汇总

full=63 partial=22 none=12 skip=3（共100，63+22+12+3=100）
