# 2026-10-03 23:33 保留正式v7，main保留v11，最后双题在运行

先读本页和AGENTS.md；git、CLI是当前状态真源。E2=`~/projects/arcbench-campaign/evidence/2026-10-02-s70`。用户明确分数优先于清理，未证明非劣不替换正式提交；持续收取结果，不能只安排后台脚本就结束。10月3日23:59（+08）截止保存提交，已经开始的任务继续。现有练习/正式余额已授权，不充值、不读隐藏评测源码、不发群消息。

- 正式最新提交仍12e3bab723fd（v7），ZIP SHA4ae64326c7e942c97e37685641766881b20d7d81c061ccc309d167f395a88f48。当前最优G afc04ffe5b63为79/100、1.636034元；Sheet defb678bf0a1为87/100、4.713723元，合计166/200、6.349757元、S104.95888048198316。23:23榜单VOLO第一、Orchestro第二103.899454；22:44曾有bugtakue112.5274居首，之后该条目未出现在23:23快照，未核实原因，不据此推断裁决。名次仍会变。
- 最后正式双题9f40df0b587e（G）、8c80a2b899ac（Sheet）已于22:55前后创建并确认RUNNING。E2/v7-final-pair-start.jsonl与v7-final-pair-observer.jsonl；CLI wait观察exec5878，超时21600秒。完成后分别status保存终局JSON并更新榜单，CLI wait可能返回状态JSONL和waiting_retry事件，要按含status的记录解析。观察故障只恢复原ID，不重复创建run。
- 先前Sheet31ff91b909a0为78/100、6.605223元；G b5163f1ef283为6/100、3.995712元，均未替换最佳组合。G触发5次主模型失败上限，只有备用模型草稿和不完整修复，不把它解释为清理造成退步。
- main代码为PR118的v11清理版，精确包E2/v11-main.zip，SHAcd0f596905b202bd5b79c040e7478ed65c204d51fb0c59c02c23beacc59baa5c。原main505044e；后续仅文档提交不应改变ZIP。全量审查和复审由一位获授权的子agent完成。报告reports/2026-10-03-unconditional-heuristics-audit.md、reports/2026-10-03-final-candidate-selection.md。
- v11真实双题固定结果G107/111、Sheet91/100与97/100；较v10的107/111、89/100与94/100，整体提高但有一项真实Escape取消缺陷。G丢失的文件路径exact-text项是固定检查过强，仍保留原始107，不改测试。当前正式G79应用同检查107；正式Sheet87应用cov99n96。g99旧应用66pass/9fail/26blocked不能直接与91比较。
- 后续实验v12（e02e7a6f）只改3处通用提示，已完成双题但不选用。G固定32pass/53fail/31error；Sheet g99为1pass/8fail/97error、cov99n为1pass/13fail/96error，均有共享前置步骤阻塞。两题均5次主调用失败，备用模型Kimi草稿质量不佳；估算5.484165+6.724274元且有未知用量。v12代码改动已撤回，PR119最终应只包含证据/交接，合main后核对包仍cd0并清理对应worktree/分支。实验原提交afbcea0、冻结ZIP和日志保留以供复现。
- v12生成exec36727已结束，固定观察exec22164应收取完成并关闭；目录generate-requirement-transactions-v12-{github,sheet}。只比较最终application；v12-draft-transport-control是另行早期快照，标有final_delivery=false。Sheet最终与快照哈希一致，G经两次修复发生变化。
- 运输证据：本地HTTP200/curl0，但SSE缺[DONE]、finish_reason和usage；元数据v12-{github,sheet}-stream-diagnostic.json。正式托管run也有主模型调用失败。practice余额22:27为360.006335元，网关DNS仍189.1.235.72，排除余额和固定地址过期，确切中断原因未确定。备用模型按每次调用启用，下次重试主模型是现有费用控制策略，不临时改为全局粘住昂贵模型。
- 公开Sheet前置状态有真实冲突：根描述A1=Region，而REQ-3-1-1 GIVEN又写Item/Qty、Pen/4。不要把所有这类断言称为测试虚构；只能在场景允许时建立独立前置状态，不能擅自覆盖明确GIVEN。
- 今日官方快速自测10次已用完，不换账号绕过。v11/v12从未正式上传。v8曾G快速自测80/100；v9已修Stage2根requirements占源码限额，实际继承23/29；这些都不证明现在换包会提高正式分。CLI0.5.0已main，环境~/.config/arcbench/volo.env，不输出secret；正式与本地使用独立evaluation/practice key。

下一步：结束PR119的文档交付和分支清理；截止前后确认最后保存提交仍12e3bab723fd、两题运行已开始；继续收取最后双题终局、更新真实榜单和交接。保持正式包，未经验证不换；不把当前第一描述成最终冠军。
