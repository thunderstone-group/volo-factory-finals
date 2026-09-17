# Harness 整体审计 — 2026-09-17

## 结论与范围

用户要求结合近期测试审查整体harness，并允许必要时使用Linux bms。
本轮通过wanctl读当前工作树、已提交包、V0/V1/V2记录、未提交V3及旧多轮复盘。
bms已通过现有SSH配置确认可连接，Linux x86_64、Python/Docker可用；没有运行生成应用或更改环境。

应优先修harness闭环，而不是归因模型不够强。当前平台得分包是纯生成；
未提交反馈链则存在不出手、覆盖过窄和丢弃部分改善的问题。
这些必须分层：V3缺陷不是已经结束的V2平台低分的历史原因。

## 平台与候选

本次arcbench只读刷新仍为Lite 31.6%、5/16；Keep7/32、Bookstack14/34。
本队实际为deepseek-v4-pro，前四队的模型标签均为deepseek-v4-flash。
榜单只能支持这些展示事实，不能反推他人实现、成本归因或同模型同预算。
提交5631b0fb1d53，包SHA48d633ecd0740ecfbeab711e318091b595c6282ca6bbe64d7f6c8cbc88a0a972。
实际九文件无business_feedback、skills或V3；本地17/34修复不是此包成绩。

## 已复现的控制逻辑

证据：runs/harness-audit-20260917/logic-reproduction.json，脚本reproduce_logic.py。
七项合成刺激驱动真实函数，零真实模型调用、无生成JS执行；不是七次浏览器实测。

1. missing_required不检查JS语法/业务；真实effort_entry.main收到合成非法app.js仍退出0并发布，且保留.arc。
   源码oneshot/main.py:257–287,371–436。不是说当前两份平台应用有语法错。
2. product_fail与unknown混合时，全组unknown，修复调用0、轮数0。
   business_feedback.py:37–38,80–83。应按项路由，未知不能伪装通过，也不应压制独立明确故障。
3. V3观察器把build_failed归为environment_error。
4. 同样把health_failed归为environment_error。
   v3/observer.py:213–227。不能反向把所有失败都判产品；需按工具能力、日志与协议证据细分。
5. 需求有收藏能力、合成实现没有相应标签时，规划因ungrounded_parameter被拒。
   v3/planner.py:15–28,87–91。预期应来自需求，不应要求缺失能力先在源码存在才能检查。
6. 两项失败变为一项通过/一项失败，到一轮上限后仍导出A0。
   business_feedback.py:137–148。当前全有或全无保留策略牺牲部分改善，变更需独立验证回归。
7. 真实平台入口接受非法JS的端到端合成响应验证见第1项，独立于直接静态检查。

## 近期失分指向哪里

当前45条首失败记录：Keep四条创建点击，另首页一条创建入口可见性；
Keep六条侧栏button操作；Bookstack六条登录邮箱字段。是首阻塞分组，不是可预支的17条提分。
最新两个托管运行的frontend/public/app.js读取都404，故当前产物具体源码根因未知。
此前本地Bookstack的domain响应/顶层状态解码不一致则已有源码和业务复验支持；
修复后的三项观察3/3，原始全套只15/34到17/34，说明覆盖面仍不足。

v3/planner.py:19–27只支持三种模板、最多三条，不能创建前置实体、选项/上传/富文本。
business_probe.spec.cjs:9–20,83–87将普通缺失/歧义动作和许多pageerror归unknown。
修复还受现有文件精确补丁约束（skill_repair.py:383–384）。先补关键流程和证据，而非继续加技能。

## 设计与实验纪律

bwrap不在当前得分包，不能解释当前31.6%。上轮V3运行预检前置只防止误报，未增加业务能力；
若作为参赛默认入口，可能把本可生成A0的任务变成无产物。部署资格与比赛运行应分开，保留稳定基线，
不得绕过权限或声称未执行观察已通过。bms可用于开发验收，不等于平台也有相同能力。

固定组件在Bookstack有15/34、16/34的改善证据，应保留；零依赖/纯JS增加手工实现负担，
但尚无消融证明换栈更优，不应再次扩框架。极简应删无效调度，不删实现—观察—修正—复验。

历史同Keep产物Lite5/32、Web21/32，需求/套件不同；不能混作重写前后同条件退化。
原逐用例审计包含命名/角色冲突；原成绩不改判，测试答案不写入通用skill。
V3 planner仍120秒/8192，与已调整的业务修复300秒/16384不同；尚未证明planner实际因此失败。
另冻结V1 MAX_TOKENS=32768，但Keep Flash第二份单请求usage报告completion91759；
budget-mismatch.json保留该未决口径差异，不推断网关忽略参数或计费错误。

## 优先顺序

保留当前A0及共用组件；优先接同一入口的薄反馈闭环，修按项状态路由与故障分类，
覆盖登录/创建/编辑保存重读及必要导航，再固定Flash同包比较A0与有限修复。
使用现有产物先验证诊断，后续新生成须保持需求/测试/预算一致、保留失败，另做未调参任务。
不恢复旧多轮框架、不扩大技能库、不拿mock单测数量当提分、不先围绕bwrap继续扩工程。

## 已保存与未完成

证据根runs/harness-audit-20260917：lite-board.json、recent-runs.json、logic-reproduction.json、
reproduce_logic.py、failure-groups.json、budget-mismatch.json、两个source-receipt.json。
最后补读需求/helper原文及扩充汇总的组合调用被工具安全检查拦下，未执行/未换通道重试；
需求测试冲突部分引用此前已经读取的完整审计，不冒充本轮重新逐字比对。
无新模型/平台运行、上传、push/merge，无harness实现/官方需求测试/原应用/默认包改动。
本轮交付审计和复现材料；建议尚未落实为harness修复。
