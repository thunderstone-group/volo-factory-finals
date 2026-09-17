# VOLO 极简版（minimal）

当前方向统一称为**极简版 / minimal**。one-shot 只指历史首次生成基线，不要求一次调用完成。
`oneshot/`、`tests_oneshot/` 和 `scripts/package_oneshot.py` 暂留为兼容路径。
默认生成器、提示词、三文件参赛包不变；新能力只在显式实验入口开启。

V1 生成策略对照使用 `oneshot/v1/` 和独立的 `scripts/package_minimal_v1.py`，
显式比较 Flash / Pro；批量入口必须指定候选 ZIP 和预期 SHA-256。进度、完整样本、
费用及结论见 [V1 质量实验](minimal-v1-quality-report-2026-09-16.md)。该实验不逐样本修复，
不改变历史 V0 或默认参赛包。

## V2 实验结果

V2 共用编辑器／行操作和初始化／导航已完成四份固定 Pro 尝试：Bookstack 为 16/34、15/34，
Keep 两份因生成流失败未交付。两个任务共同改善尚未证明，不扩大样本、不替换默认包。
入口调用的代码覆盖证据和已定位的业务状态同步错误见 [V2 完整报告](minimal-v2-quality-report-2026-09-16.md)。

已新增3项项目局部技能及显式 `oneshot/skill_repair.py` 入口：首轮短索引、同会话原生
`read_skill` 取正文。22项客户端回归及一次真实网关读取/修复已完成；模型副本交互2/2、
Bookstack原套件16/34（原15/34）。这是旧产物修复，不是生成泛化证明；本次3技能全部读取，
尚未证明比全量提示更省或更准。默认V2首次生成仍未改成按需工具流程，通用自动业务观察器
尚未完成。详见[技能与66条用例审计](minimal-skill-repair-and-case-audit-2026-09-17.md)。

9 月 16 日答疑已同步，随后补入 V2 流式诊断；44 项指定回归通过，新候选尚无真实生成结果。
原批次和 ZIP 仍冻结，规则未决项、诊断候选哈希及验证边界见 [答疑与续报](official-qa-sync-2026-09-16.md)。

## 业务观察接线（9月17日）

新增可选 `scripts.observe_business` 入口：三个需求驱动的固定观察模板接入现有技能修复，
最多两轮、总计六次请求，复验与回归保护后才可接受副本。37项指定单测通过，真实对照3项通过；
第二份应用自动检出保存旧值及缺少收藏入口，但真实模型修复以model_error停止，本轮没有新的提分。
尚非任意应用的自动观察器，也没有改默认参赛包。详见[业务观察接线及限制](minimal-business-feedback-2026-09-17.md)。

## 业务修复交付续报（9月17日）

上述model_error之后的新实验已定位两道预算限制：单请求120秒超时、8192 token输出截断。
调整业务修复配置为单请求最多300秒、输出16384 token，每轮总300秒和两轮/六次请求不变。
自动修复后保存/取消/收藏三项通过，原始Bookstack套件从15/34到17/34，无已通过项回归。
48项相关回归通过；新增独立安全诊断回执。仍是旧产物修复，未改默认包，也非跨任务泛化证明。
详情及原始失败见[修复交付报告](minimal-repair-delivery-2026-09-17.md)。

## 当前实现

`oneshot/minimal_feedback.py` 保留一条 working / retained 修复流程：原始 A0 不改，
非回归候选的源码和新诊断进入下一轮；只有要求的检查全部通过才替换交付副本。
`max_rounds=0` 仍只复制原产物，不执行检查或消费响应。最多两轮共享同一请求账本。

- 默认语法模式：真实 `node --check`，不执行应用。
- `--runtime-image sha256:...`：启用 `minimal_runtime.py` 的隔离运行反馈，固定执行
  静态交付、JS 文件语法、前端构建、后端启动、健康协议、首页及源码完整性检查。
- 默认使用明确注入的 `--offline-response`；`--real-repair` 才读取现有
  `OPENAI_API_KEY / OPENAI_BASE_URL / MODEL` 调真实网关，两者互斥。修复请求不自动重试，
  截断不续写，费用由实验账本另记，不能把缺失 usage 当零费用。

```sh
python -B -m oneshot.minimal_feedback /path/to/A0 --output-dir /path/to/empty-output \
  --max-rounds 2 --runtime-image sha256:PINNED_LOCAL_IMAGE_ID --real-repair
```

## 运行和证据边界

执行器只使用本机既有且明确选择的不可变镜像，不拉取镜像、不安装依赖、不发布宿主端口。
应用容器 network=none、只读根文件系统、drop all capabilities、no-new-privileges、
2 GiB 内存、1 CPU、96 PIDs，写入仅在受限 tmpfs。只挂载干净源码和只读验证器；
无主目录、仓库或 Docker socket。应用 UID 10001，检查器 UID 20002；镜像内原有
`/opt/arc` 语料在应用容器中被遮蔽。执行器自身是本地开发设施，不作为官方包依赖。

结果区分 pass / product_fail / environment_error / unknown。pass 仅覆盖列出的检查，
`behavior=unknown`、`verified_requirements=[]` 始终保留。没有产品失败就不调用修复；
环境故障、输出截断、超时或证据缺失不触发盲修。进程正常退出后再关闭容器，清理后
的 server_exit 可能为 137，这是受控终止记录，不改写此前观测到的启动结果。

修复的可编辑源码集合与检查 ID 分离，允许修改已有前后端源码、构建脚本和 manifest，
不允许凭据、点文件、依赖/构建产物、测试文件及新文件。错误反馈包含当前源码与匹配哈希。

## 最新批量实验

用户要求先批量找共性、再考虑统一修改。当前使用 `scripts/run_minimal_batch.py` 跑 Lite
Keep/Bookstack 各三份；先完成全部生成，再评分，不逐样本修复。见
[批量执行单](minimal-lite-batch-plan-2026-09-16.md)和
[六份结果与共性归因](minimal-lite-batch-report-2026-09-16.md)。

## 前一版配对实验（已停止调度）

`python -B -m scripts.run_minimal_paired EVIDENCE_ROOT` 使用固定模型、代码、需求、模板和
独立测试，对 Evolution counter/dice、Ticket、Keep 各做 3 次首次生成。每份 A0 对比
原样交付和最多两轮真实修复的 B。A/B 冻结后才由 `scripts/evaluate_minimal.py` 独立评分；
评测容器拥有测试文件，应用容器没有该挂载，修复过程不读取评测结果。
完全相同的 A/B 使用同一次评分并标记 reused，避免将一次产物的重复评分当独立生成。

实现与真实证据见 [运行反馈报告](minimal-runtime-v1-report-2026-09-16.md)。原语法阶段的
68 项验收和原始失败记录见 [语法报告](minimal-feedback-v1-report-2026-09-16.md)。最新授权
见 [本轮执行单及补充](minimal-runtime-plan-2026-09-16.md)，其真实实验授权覆盖较早的
“仅合成响应后停止”。不自动上传、正式提测、push 或合并。
