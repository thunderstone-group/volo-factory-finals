# 2026-10-03 18:20 原题S103.09、最终候选验证在途

先读本页和AGENTS.md，运行现状从CLI、E2原句柄核对。E2=`~/projects/arcbench-campaign/evidence/2026-10-02-s70`。用户明确指出不要答完就停止，截止前持续处理结果和推进；不将后台脚本安排好视为闭环。现有练习/正式余额已授权，不充值，不启用子agent。

- 正式最新submission仍12e3bab723fd（v7，ZIP SHA4ae64326c7e942c97e37685641766881b20d7d81c061ccc309d167f395a88f48）。Sheet补跑defb678bf0a1已87/100、CNY4.713723；与G c5e4493bad81的76/100、CNY2.017375组成163/200，17:16现场总榜S102.27601、rank1。Orchestro现场S68.2146；历史高点103.61657尚未超过。结果见E2/v7-sheet-repeat-result.json、board-20261003-1716.json。
- G原题3bf0eb62b562已78/100、CNY2.396539；与Sheet87组成165/200、18:20现场S103.09077第一。Orchestro已升第二S93.96738，不能停止跟进。当前再跑Sheet31ff91b909a0。E2/watch_v7_original_final.py / exec59692按原ID等待，完成后在同一submission再启动一次Sheet（v7-sheet-repeat2-start.jsonl），保留最佳成绩。检查v7-original-final-watch.log、v7-github-repeat-result.json、v7-sheet-repeat2-result.json。任何观察故障只恢复原ID，不重复创建run；脚本已存在时不盲目重启。
- 原阶段路线：Stage1 5e8c8d7d3f14为25/30、CNY1.097932；Stage2 c71b18944cdb在任何模型调用前退出，原因是template exceeds source snapshot limit，成本0。旧阶段观察exec83238因此已结束。最新提交规则决定修复旧包必须保存新提交，会丢掉旧提交有效成绩，尚未这样做。
- v8源码（PR114/115已main）全新双题均已完成。G固定独立107/111，与v7正式应用同分；官方快速自测25/30+26/29+29/41=80/100（旧应用76）。Sheet固定g99为89/100、cov99n-arm95/100，估算CNY6.796；正式87应用同检查为66通过/9失败/26阻塞、96/100。g99的共享Rename workbook辅助步骤阻塞整组，不能直接用66和89推测正式分差。v8不存在正式提交。
- 新修复将workspace根requirements/作为只读输入保留，排除源码快照和模型可写路径；同名嵌套应用资产仍保留在快照内。真实失败工作区中，需求/图片3,721,202 bytes，应用源码仅83,293 bytes/10文件；修前2MiB门限失败，修后正常进入生成。没有提高源码上限，没有丢弃输入或读取隐藏评测。
- 精确v9包E2/candidate-stage-inputs-v9.zip，SHAd71cca378b9d5b0350c8bfa7c5d208547548f2ddf0bd0c82d3982eb75f5da770。从实际Stage1应用和Stage2失败工作区完成一次真实升级，E2/v9-stage2-upgrade：exit0、1312.2秒、估算CNY1.400173；原29个需求文件/图片hash不变；自写31/31，固定前阶段28/31保持且零原通过项丢失，新阶段固定26/31。源码审查返回JSON错误，未提供可用反例，必须保留这个局限。证据docs/evidence/2026-10-03-stage-template-inputs.json。
- v9的官方Stage2快速自测已23/29，结果E2/v9-stage2-upgrade/selftest-stage2-result.json；这是今日第10次，额度用完后不换账号绕过。此前手修搜索应用Stage2从23到27、零回退，仅为方法诊断，未进agent包。
- PR116已合main8711a87，模板修复分支/worktree已清理。随后只改源码反例阶段的修复范围：新反例通过即停，旧浏览器失败仍留在报告，完整回归和既有接受规则不变。真实v8最终Sheet及原模型写的检查重放：相同92pass/10fail、应用源码hash不变，旧控制器会请求修复，新控制器0请求。原轨迹这一步之后4次全部回退，估算1.282494元/2136.6秒无交付改动。
- v10冻结包E2/candidate-source-scope-v10.zip，SHAb44592c90510d3a9576e41fa9e2d5ceea39aac586e692b718fb23ed0cb6c341d。两题从空模板生成已启动，E2/generate_source_scope_v10.py / exec65313；逐题generate-source-scope-v10-{github,sheet}/process.json、transport-*.json、finished.json保留进度。未正式提交，需收齐结果并跑固定独立检查，不能让观察结束后无人处理。
- 284 one-shot（3skip）和226 legacy（12skip）无失败；v9的21文件精确包secret扫描0。新源码按worktree/PR合main并清理，本页不是git状态真源。CLI0.5.0已main；环境在~/.config/arcbench/volo.env，不输出secret。formal使用平台专用evaluation key，本地使用独立practice key。

下一步持续读取当前G补跑与继承升级快速自测；完成本修复PR/main/清理；综合正式最佳分、v8完整自测和v9继承路径证据决定最终包。不要因deadline焦虑无验证覆盖S102.28，也不要因暂时第一停止。新提交不继承旧成绩，最终提交前确认活动run与完整后续运行安排。当前公告截止10月3日23:59（+08），已经启动的运行可以继续。
