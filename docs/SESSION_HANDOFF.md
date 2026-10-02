# 2026-10-02 CLI main delivery and ARC continuation

先读本页，再按需要读 `docs/reference/roadmap.md`、`docs/reference/oneshot.md`。本页记录本次观察；继续时从 git、运行产物和官方 API 核对变化。

- 当前目标仍是同一最新有效提交下完整 GitHub100 + Sheet100 的正式总榜第一，并超过 Orchestro 的有效成绩。原 S70 目标已完成。已有练习/正式余额可用，不充值，不反复询问小额。无子 agent 授权。用户投诉额度消耗，必须减少推演、重复读取和无新证据的重试。
- 用户重申：worktree 分支只供开发；完成后经 PR 合入 main、更新本地 main、验证主分支安装、清理分支/worktree。不要再把 push 分支当交付。
- v5 与受控修复均结束；当前 v6 从空模板两题生成在运行（exec40870，G PID26805、Sheet PID26804）。另有 v5 Sheet 两套固定独立回放 exec95470。没有在途正式评测或远端自测；不得重启未终态运行。

## CLI 已交付

`~/projects/arcbench-cli` main = `4d3eefcac692e5d14ecc6a1393cb8d6b130b00f5`，0.5.0。正式额度 PR #9 早已合并；本次已审查并合并群友 doctor PR #11、自测 API PR #12。群友已按原评审修改 env 查找、测试环境隔离、可选 ZIP、退出码与格式；另补默认 home 配置隔离。132 测试通过，真实 doctor/正式额度/selftest tasks/status 验证。CLI 从远端 main 安装，已摆脱 editable worktree。该项目只剩 main worktree；本次本地/远端 feature 与集成分支均清理，open PR=[]，fleet-scan 0。不要再使用已删除的 `arcbench-cli-worktrees/selftest-api-20261002`。

安装：`uv tool install --force --python 3.12 git+https://github.com/thunderstone-group/arcbench-cli.git@main`。Cookie 迁移和 OAuth 用户已经授权；保留 `~/.config/arcbench/volo.env`，不输出真值、不重问授权。证据 E2/cli-050-main-delivery.json、cli-050-final-tests.log 及 cli-050-main-*.json。正式剩余额度现场 213.300534，练习余额 doctor 400.429013。

## 官方分数和自测证据

E2 = `~/projects/arcbench-campaign/evidence/2026-10-02-s70`。

- 当前有效 submission `f56d97c2fdb1`，agent ZIP SHA `8ef69d0cd5e8e2081d7e66145b9a3b6bd22ea45dc6cf52131535bca93126b04a` 未变。G `4666c04f629e` 46/100、1.963038；Sheet `9d673d2969ed` 80/100、2.973834；正式 S79.47644199762266，126/200，完整 original route。同提交来源核对见 s70-completion-audit.json。没上传更新正式包。
- 最新 `leaderboard-v6-forecast.json` 中我们 rank3，榜首 jackyjiang S88.7540；Orchestro 此次前5列表未出现，原因未查，不得臆断。此前 Orchestro S103.61657、G76+Sheet87、CNY5.909238 只作历史参考，冲榜前重查实时完整榜。
- 自测今日10次全部用尽，下一次 UTC0/本地08:00 重置；不得切账号绕过。全部终态。正式 G46 应用阶段基线23/30+21/29+1/41=45；首页真实入口与通用 native select 受控改动后24+21+28=73，28增0退。`home-native-repair-github/combined-comparison.json`；最后Stage3 ID `2c6f10f5-6b47-4d1a-bb2e-635286017ce6`。这是受控应用成绩，不是新 agent 正式分。
- Public input `requirements-after-stage-announcement/hackathon--github/requirements.yaml` SHA9480921cb3b7ffdc5f32cb76011ecc1d5bf9bfbf2cba38e3a092355ac88a54f8；Sheet 在 `hackathon--sheet`，不要错用不存在的 online-spreadsheet 路径。阶段/full 唯一公开差异为组织名/slug那一项；不要把阶段累计当成同套正式题。

## 当前 agent 开发与验证

开发树 `~/projects/volo-factory-worktrees/source-owners-20261002`，branch exp/source-owners-20261002，已推 eadfbad，v6 代码、测试和参考文档已提交。冻结包 candidate-semantic-entry-v6.zip SHA2490d023dc27f1938372a7ad65918808c40ab691b006bf8c483bf6591e6918eb 正在生成两题。主仓不改；经验证后仍须 PR main 收尾。

- 冻结 v5 包 `candidate-entry-native-v5.zip` SHA e4a76b801595686de7c93d25cb2a8b45f4c9b39b8ae312dcb0df59379bf204a4。从空模板两题都结束：G3490.3秒、Sheet5692.5秒。产物 `generate-entry-native-v5-{github,sheet}/application`，过程/账目原文各在对应目录。G自己100 UI +4源码检查全绿，但固定初始入口仍2/5；不能因自绿推广。Sheet修复末轮92pass/3fail/7error，4连续无增益停止，后续源码检查也已结束；正式最终摘要仍待汇总。
- `v5-frozen-suite-{github,sheet}` 为模型仅从公开需求独立写出的100题，非主办方隐藏测试。校准：同G suite给官方46应用85pass、受控73应用92pass，因此偏乐观；它偷偷加了父仓库导航，掩盖首页问题。Sheet suite给正式80应用76pass/10fail/17error。新Sheet最终固定回放已结束92pass/3fail/7error（v5-final-sheet-frozen-report.json）。额外发现写测自身矛盾：插入空B列后同时要求公式=B1+C1与结果5，虽B1空/C1=3；另有后序用例在共享后端上假设初始seed未被前序改变。不要据此盲修app；正在跑已有独立 g99/cov99n-arm 两套裁判。
- v6 testgen 已补从公开 GIVEN/first WHEN 提取的固定入口检查，只有原模型 suite 可用才附加，不替代写测失败。扩展11项在官方46应用3pass/8fail、受控73应用11pass，Sheet0项。测试不修改认证、不猜标签、不导入业务答案。
- v6 去掉把所有引号字面量都当源码覆盖目标的草拟/修复诱导，并按角色区分初始数据、运行输入、消息、明确不存在记录；修复验收不再把 written-test 模式的词汇缺失计为惩罚。保留真实失败、控件重命名与静态门禁。修复 parser 对实际捕获的单 hunk 冗余分隔符增加窄恢复。
- 完整 tests-semantic-entry-v6-final.log：276 run / 273 pass / 3 optional skip。最终文档提示修订后 focused tests-v6-final-prompt-focused.log：126全过。当前已按精确包启动从空模板生成两题。记录 semantic-entry-v6-started.json；沿用包默认预算与模型、无需重复启动。
- bounded replays v6-full-entry-repair 与 v6-semantic-entry-repair 均单次把 final v5 G 入口3/11修到11/11，已结束；后一成本0.151485，only app.js。**仍不接受为最终应用**：两份生成改动都为了标签唯一而省略同标题记录或仅给第一个容器入口，违背保留身份/上下文的要求。不要再无证据反复加提示付费重放，先明确剩余通用验收缺口。先前 v6-entry-repair-checkpoint 还引入无用示例seed表，已明确不采用。
- native select 在旧Sheet app的保护性回归：直接换lib会因旧 input[name] 读取器损失透视表；仅改为[name]恢复两套87/93逐项等同基线。只作机制诊断，未嵌应用到agent包。

下一步：收 v5 Sheet 独立回放与已经启动的 v6 两题完整生成；落实已验证代码经 PR 合 main 的收尾。当前已验证正式分保留。不要把调试修复应用、固定入口检查或局部自绿当作 agent 泛化完成。用户询问预期时已给 S95–100 中心预期、105+冲刺，明确尚未正式验证。
