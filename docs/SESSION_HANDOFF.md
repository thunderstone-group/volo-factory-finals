# 2026-10-02 21:28 ARC v7 ready for a complete official pair

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

当前没有在途本地生成/修复。exec58454已终态：G连续5次传输失败、0完整回复，仍85/111，程序按设计没有排Sheet。不要恢复旧50309/58454/28072/89976句柄。

随后每进程绑定物理网卡en0并使用公开DNS地址、保持原HTTPS域名和请求数据的curl对照连续完成两题：G一次请求HTTP200/0 curl错误，85提升108/111；Sheet一次请求完成，固定自写检查75pass/6fail/23error（其中多数因前序改了共享表格后，写测代码仍假定初始Region表头）。这条诊断改动只在E2，不进入agent包，不改系统代理。两个控制的请求哈希与旧失败调用不完全相同，且线路和HTTP栈均改变，所以不作严格单变量归因。

本次v7修复在 `fix/native-selected-value-20261002` 工作树：原生select用浏览器selectedcontent呈现选中值，保留真实原生控件和FormData/事件/AX值；屏幕、弹窗、popover均覆盖，原生显示子按钮不参与重复动作折叠。276 one-shot（3 optional skip）与226 legacy（12 optional skip）通过。只换lib的G对照109/111（两个选中值阻塞均解除，其中一项继续走到提交hash格式断言失败；另一个仍是milestone刷新显示）。旧Sheet两套保持87/93，新Sheet独立为90/95，满足本次正式试跑的对照依据。

下一步完成本分支PR/main/清理、冻结candidate-selected-value-v7.zip，再保存同包完整GitHub+Sheet正式提交。既有额度授权有效，提交前已现场确认无活动run、余额213.300534。新提交不继承旧成绩；保存之后应以新提交为当前，不再称S79.4764仍是有效榜面。读取E2/v7-official-upload.jsonl和v7-official-start.jsonl中的实际submission/run ids（若还没有文件则尚未执行），并从CLI复核终态和总榜。保留原f56完整证据供比较。不要把本地109/111或90/95当正式成绩。
