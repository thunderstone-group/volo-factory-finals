# 2026-10-02 20:03 ARC continuation after mainline delivery

先读本页，再按需要读 `docs/reference/roadmap.md` 与 `docs/reference/oneshot.md`。下列运行号和状态是本次观察；继续时检查原句柄和实际产物，不因观察超时重启。

- 当前目标是同一最新有效提交下完整 GitHub100 + Sheet100 正式总榜第一，并超过 Orchestro 的有效分数。原S70已完成。已有练习与正式余额可用于必要实验，不充值、不反复询问小额；无子agent授权。用户要求减少反复推演及浪费。
- 用户重申的开发范式：worktree/分支只承载开发，验证后合main、更新主工作区、清理已结束分支。main代表最新可交付代码，平台采用的ZIP由正式提交记录决定，两者分开。
- Volo最新源码已通过PR111合main `c2cd10c`；PR110随祖先合并结束。原goal/s70与source-owners工作树及本地/远端分支已清理，未跟踪dist各1件保存在E2/retained-*-dist。后续读 `~/projects/volo-factory`，改代码需从最新main新建worktree。276 one-shot检查完成（3 optional skip），最终提示126 focused通过，226 legacy检查完成（12 optional skip），46提交secret扫描0。打包主分支与在测v6 SHA逐字一致，见E2/mainline-v6-delivery.json。
- CLI `~/projects/arcbench-cli` main `4d3eefc`、0.5.0，PR9正式额度、PR11群友doctor、PR12自测接口均已合并；132检查及实际API/主分支安装验证通过，CLI工作树和本次分支已清理。安装来自远端main，不能再引用已删除的CLI worktree。OAuth/Cookie迁移已获用户明确授权，不重问；`~/.config/arcbench/volo.env`不输出真值。

E2 = `~/projects/arcbench-campaign/evidence/2026-10-02-s70`。

- 当前有效正式submission仍 `f56d97c2fdb1`，agent ZIP SHA `8ef69d0cd5e8e2081d7e66145b9a3b6bd22ea45dc6cf52131535bca93126b04a`。G `4666c04f629e` 46/100、CNY1.963038；Sheet `9d673d2969ed` 80/100、CNY2.973834；S79.47644199762266，126/200，完整original route。无新正式提交，也无在途正式评测。核验见s70-completion-audit.json。
- 历史Orchestro为G76+Sheet87、S103.61657。19:05的leaderboard-1905.json中它未列在前10，原因未查，不作合规推断；当时榜首jackyjiang S88.7540，我们rank2。冲榜前重新读取完整榜，不能降低目标到一个局部临时分数。
- 新公开完整G输入 `requirements-after-stage-announcement/hackathon--github/requirements.yaml` SHA9480921cb3b7ffdc5f32cb76011ecc1d5bf9bfbf2cba38e3a092355ac88a54f8；Sheet目录是 `hackathon--sheet`，不是online-spreadsheet。阶段/full有一项组织名/slug文本差异。
- 今日10次远端selftest已全部终态且额度用完，下次UTC0/本地08:00重置，不换账号绕过。G46正式应用三组基线23+21+1=45；仅首页入口及native控件受控修复为24+21+28=73、28增0退，见home-native-repair-github/combined-comparison.json；不能当新agent正式分。最后Stage3 ID `2c6f10f5-6b47-4d1a-bb2e-635286017ce6`。Sheet旧input[name]读取器随native变更改成[name]后，两套固定检查恢复87/93；这是保护性诊断，未嵌入agent包。

- 冻结v6包 `candidate-semantic-entry-v6.zip` SHA `2490d023dc27f1938372a7ad65918808c40ab691b006bf8c483bf6591e6918eb`。只含通用agent/scaffold；不含生成应用、隐藏测试或任务答案。新增固定初始入口检查仅从公开GIVEN/first WHEN提取，补充可运行written suite；按语义区分初始数据、输入和消息，去掉词汇覆盖诱导。保留实际源码反例与native控件。
- v5两题均结束。Sheet自检92pass/3fail/7error，独立g99/cov99n-arm仅82/87（正式80应用同套87/93），所以未晋升。v5-final-sheet-frozen-report.json还暴露自写测试矛盾：插入空B列后要求=B1+C1且结果5，虽然B1空/C1=3；后序测试也假定共享后端初始值未被前序改动。不要盲修应用以满足不一致检查。
- v6两题从空模板的原运行exec40870已结束，初稿分别49pass/32fail/33error与68pass/9fail/24error；均在首轮修复到达5次传输失败上限，没有成功修复，不能当完整质量试验。多数TLS EOF是0 byte/0 SSE；Sheet另有截断JSON和缺终止标记。默认曾尝试Kimi，不得称全程Vision或把未知用量当0。实际GET探测在Python3.9、3.12和curl都返回401，无法据此定罪Python或服务端。详细记录见 docs/evidence/2026-10-02-v6-transport-limited.json 与E2原日志。
- v6-frozen-suite-{github,sheet}是公开需求生成的模型检查，不是主办方测试。校准：G46应用普通96pass+入口3/11，受控73应用普通96pass+入口11/11；Sheet80应用88pass/5fail/8error。普通G检查仍看不出首页修复收益，必须同时看固定入口和独立回放。
- 首次恢复 `v6-transport-recovery-github` / exec50309已结束：Python3.12、Vision、fallback关闭，配置repair_calls=1但实际2次请求（一次SSE截断后重试成功），880.9秒；保留改动后85pass/26fail、11入口全过，修改app.js/styles.css。已知估算CNY0.505617，含未知用量，不能当完整实扣额。运行时限额允许内部重试超出配置次数，记录实际attempts。

唯一在途是 `resume_v6_pair.py` / exec58454：串行继续GitHub，然后修复Sheet，均复用已生成应用与固定suite；每题配置repair_calls=2、估算repair_cny=1.5、Vision、fallback关闭、Python3.12。若一个任务全部请求失败会停止排下一题。当前子进程与阶段读E2/v6-resume-active.json，完整终态读v6-resumed-{github,sheet}-finished.json和对应repair.json，日志resume-v6-pair.log。不要重复启动；父程序stdout已重定向，wait无输出不代表停了。

下一步先收这条串行恢复，核对真实改动和权限/数据保留，再用固定独立检查验证最终产物。候选经验证后才替换当前正式submission；正式提交按同包完整两题终态、source_run_ids与总榜验收。main代码已交付不等于新分数产生。当前正式余额213.300534、练习398.110297是11:34UTC附近观察，下一批先刷新；已有授权内不反复询问。用户问预期时已报S95–100中心预期、105+冲刺，明确尚未正式验证。
