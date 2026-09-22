# Lite 优先：需求测试对齐与第一处修复（2026-09-22）

用户根据参赛须知第 7 问，将当前工作明确收敛为先攻克 Lite，不继续六题 Web 大榜循环。
本轮固定 Keep 32 条、BookStack 34 条为工作范围。完成标准是同一候选分别完成两题全套，
然后以独立生成再次通过；冻结应用上的手工诊断修复只证明机制，不算智能体已经攻克。

## 当前文件核对

官方[模拟仓库](https://github.com/code-philia/hackathon-local-simulation/tree/cfbbc287ee1bbffcf1e936545e4803145693a8d8/public-exercise)
固定在 `cfbbc287ee1bbffcf1e936545e4803145693a8d8`，现场 `git ls-remote` 确认仍是上游 main。
实际目录为 `public-exercise/keep` 和 `public-exercise/bookstack`，README 仍保留 Counter 旧例。
规范输入是每题的 `requirements/requirements.yaml`；当前生成器也读取这个文件。

2026-09-22 重新通过 `arcbench fetch --competition arc-bench-lite` 下载测试。
将 CRLF 规范为 LF 后，68 个 TypeScript 文件（66 个 spec 和两个 helpers）与模拟仓库全部一致。
每个 ATOMIC 需求都有唯一同编号 spec，测试注释的 requirement ID 也全部对应。
这证明版本和编号覆盖一致，不等同于已经证明每条测试穷尽所有业务行为。

与 09-18 本地旧测试包相比，Keep 改了 helpers；BookStack 改了 helpers 和四个 spec：
REQ-4.4.1、REQ-5.5.1、REQ-6.1.3 新增删除后不存在断言，REQ-8.1 新增收藏 aria-pressed 状态断言。
辅助函数增加精确表单作用域，首页按钮改为 `BookStack`，Keep 首页增加 `Notes workspace` 区域断言。
上述角色、名称、作用域或删除效果都可以在当前 YAML 找到；不能沿用旧 helper 假设覆盖明确需求。
[原始证据和逐条映射](../evidence/2026-09-22-lite-first.json)保留需求、测试哈希、完整失败、来源与运行环境。

## 本地冻结应用基线与修复

基线应用取自同一历史 r27 提交的两个生成物：Keep `48dc5978436c`，BookStack `62b302f9fb15`。
使用历史生成物只为诊断，不将其当作当前需求重新生成的结果。它们没有被覆盖；所有回放在独立副本运行。
镜像 `arc-business-feedback:20260921` 的实际运行信息为 Node 20.19.3、Playwright 1.57.0、
Chromium 143.0.7499.4、ARM64、CPU 100000/100000、内存 2147483648、1 worker、10 秒测试与断言超时。
所有测试文件只读挂载，源与测试哈希已复核。运行不是完整官方 x86_64 生命周期，也不是官方分数。

| 题目 | 冻结应用基线 | 本轮修复后 |
|---|---:|---:|
| Keep | 15/32 | 未改动 |
| BookStack | 19/34 | 20/34 |

第一处受控修复只删除首页按钮可访问名称中多余的 ` logo` 后缀。REQ-1.2 明确要求
role=button、name=BookStack，而生成物和共享骨架都固定加后缀。代码修改同步到骨架、提示卡和骨架说明。
回放使用同一 BookStack 源副本、同一测试和资源，唯一功能差异就是这个可访问名称。

完整 34 条回放新增通过：REQ-1.2；原有通过丢失：无。
另外四条此前卡在同一按钮的测试已经越过该步骤，但依然失败：REQ-6.1.2 找不到 My Recent Drafts，
REQ-7.1 找不到 My Recently Viewed，REQ-7.2 找不到 Shelf 7.2 快捷入口，REQ-9.1 找不到更新页面入口。
因此不能把同一定位错误出现五次推算成五分收益；入口修复后仍要检查完整业务后置结果。

此结果只验证已生成应用上的修复，尚未证明模型会在新生成应用中保留该约定。
没有调用模型、没有新上传、没有启动官方任务。已有账号费用授权继续适用于后续 Lite 实验。

## 按真实失败推进

1. Keep 首先解决统一 Note editor：新建、编辑、配色、标签、置顶必须使用需求规定的对话框作用域。
   基线有六条用例首先卡在该作用域中的字段或动作；其次检查卡片归档及种子记录、搜索、高亮、菜单与 sidebar 属性。
2. BookStack 在首页返回链路修复后，处理新建/编辑表单及标签输入、创建入口、删除确认和草稿编辑、收藏路径。
   以完整回放确认实际状态变化，并保住已通过项。
3. 显式需求优先于历史提示卡：旧的容器标签禁令、定位回退与 worker 描述仍需清理，不能只靠追加新规则互相覆盖。
   只有新证据支持的改动才进入下一轮；一轮只处理一个可核验原因，完整复测两题再接受。
4. 后续从当前 YAML 独立生成 Keep 和 BookStack，记录版本、通过集合、成本、token、耗时；
   在两题分别达到 32/32、34/34 后重复独立生成，防止把偶然样本或手修应用算成完成。
   新需求或测试版本到来时先重新核对；本阶段不启动 Web 的六任务批次。

## 验证与交付边界

- one-shot 确定性测试 83/83 通过；legacy suite 226 条中 214 通过、12 跳过。
- 打包成功且检查 ZIP 已包含修改后的骨架；包没有上传。
- 分支保留在独立 worktree；主检出、历史实验分支及官方测试未修改。没有将新分支合并到 main。
- 两题还没有全部通过，独立重新生成与正式运行均待完成；本轮是范围切换、失败基线和首项修复。

## 66 条需求与本轮结果

下表是编号覆盖和实际执行结果；每条需求场景及完整错误见证据 JSON。BookStack 列展示修复后结果，Keep 为基线。

### keep

| 需求 | 名称 | 本地结果 |
|---|---|---|
| REQ-1.1 | Enter Website | 失败 |
| REQ-2.1 | Note Listing | 通过 |
| REQ-2.2 | Create Note | 失败 |
| REQ-2.3.1 | Delete | 通过 |
| REQ-2.3.2 | Notification and Undo | 通过 |
| REQ-2.3.3 | Trash list | 失败 |
| REQ-2.4 | Update Note | 通过 |
| REQ-2.5.1 | Archive | 失败 |
| REQ-2.5.2 | Archive Undo | 失败 |
| REQ-2.5.3 | Show archived notes | 失败 |
| REQ-2.5.4 | Unarchive | 失败 |
| REQ-2.6.1 | Change note color | 通过 |
| REQ-2.6.2 | Choose note color when created | 失败 |
| REQ-2.7.1 | Assign label to a note | 失败 |
| REQ-2.7.2 | Remove label from a note | 失败 |
| REQ-2.7.3 | Default label | 通过 |
| REQ-2.7.4 | Assign default label when creating note | 失败 |
| REQ-2.7.5 | Edit labels | 通过 |
| REQ-2.7.6.1 | View list filtered by label | 通过 |
| REQ-2.7.6.2 | View all notes | 通过 |
| REQ-2.7.6.3 | View Reminders | 通过 |
| REQ-2.8.1 | Pin note | 通过 |
| REQ-2.8.2 | Unpin note | 通过 |
| REQ-2.8.3 | Pin note when creating it | 失败 |
| REQ-3.1 | Initial suggested filters | 失败 |
| REQ-3.2 | Search by keyword | 失败 |
| REQ-4.1 | Setting options list | 失败 |
| REQ-4.2 | Detailed settings | 通过 |
| REQ-5.1 | Toggle between list and grid views | 通过 |
| REQ-5.2 | Grid View by default | 通过 |
| REQ-6.1 | Items and styling | 失败 |
| REQ-6.2 | Collapsible Sidebar | 失败 |

### bookstack

| 需求 | 名称 | 本地结果 |
|---|---|---|
| REQ-1.1 | Open Homepage | 通过 |
| REQ-1.2 | Back to Homepage from Other Pages | 通过 |
| REQ-2.1 | Enter Login Page | 通过 |
| REQ-2.2 | Log In Successfully | 通过 |
| REQ-3.1 | Enter Authenticated Homepage | 通过 |
| REQ-4.1 | View Shelf List | 通过 |
| REQ-4.2.1 | Enter Shelf Details Page | 通过 |
| REQ-4.3.1 | Create Shelf | 失败 |
| REQ-4.3.2 | Cancel Creation | 通过 |
| REQ-4.4.1 | Confirm Delete Shelf | 失败 |
| REQ-4.4.2 | Cancel Delete Shelf | 通过 |
| REQ-4.5.1 | Save Shelf Edits | 失败 |
| REQ-4.5.2 | Cancel Shelf Edits | 通过 |
| REQ-5.1 | View Books List | 通过 |
| REQ-5.2.1 | Enter Book Details Page through Book List Page | 通过 |
| REQ-5.2.2 | Enter Book Details Page through Shelf Details Page | 通过 |
| REQ-5.3.1 | Fill out and Save Book | 失败 |
| REQ-5.3.2 | Cancel Creating Book | 失败 |
| REQ-5.4.1 | Save Book Edits | 失败 |
| REQ-5.4.2 | Cancel Book Edits | 通过 |
| REQ-5.5.1 | Confirm Delete Book | 失败 |
| REQ-5.5.2 | Cancel Delete Book | 通过 |
| REQ-5.6.1 | Fill out and Save Book with Shelf | 失败 |
| REQ-6.1.1 | Save Page | 通过 |
| REQ-6.1.2 | Save Draft | 失败 |
| REQ-6.1.3 | Delete Draft | 失败 |
| REQ-6.2.1 | Create Chapter | 通过 |
| REQ-6.3.1 | Enter Page Reading Page | 通过 |
| REQ-6.3.2 | Redirect to Page Edit Page | 通过 |
| REQ-7.1 | Add to Recently Viewed | 失败 |
| REQ-7.2 | Quick Navigation from Recently Viewed | 失败 |
| REQ-8.1 | Favorite Items | 通过 |
| REQ-8.2 | Quick Navigation from Favorites | 失败 |
| REQ-9.1 | Quick Navigation from Recently Updated | 失败 |
