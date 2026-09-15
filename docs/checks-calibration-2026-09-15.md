# checks 离线校准记录（2026-09-15）

## 结论

**组件已实现并通过本地单元验证；模型编译和三份应用校准未完成，不能宣称达到验收门槛。**

当前会话不能解析模型网关，也不能监听本机端口。没有成功的模型响应，没有生成
`checks.json`，因此没有场景级 `results.json`、混淆矩阵或语义 unknown 判定。
不能把基础设施阻塞填成 66 个 unknown，也不能用历史官方分数代替本地检查分数。

## 样本与混淆矩阵状态

已从真实需求树枚举 Keep **32 场景 / 12 个父级需求组**、Bookstack **34 场景 / 20 个组**。
稳定编号采用 `REQ-x#场景序号`，同一 requirement 的多个场景不会被去重。
输入路径、SHA-256 和逐场景清单保存在
[`Keep 输入目录`](../checks/out/keep/input-catalog.json) 与
[`Bookstack 输入目录`](../checks/out/bookstack/input-catalog.json)。

| 样本 | 已有官方 hosted 结果 | 本地 pass / fail / unknown | 官方通过场景的本地 pass 率 | 官方 fail → 本地 pass |
|---|---:|---|---|---|
| Keep 第 5 局 | 25 pass / 7 fail，共 32 | 未测 / 未测 / 未测 | 未测，门槛至少 22/25 | 未测，要求 0 |
| Keep 第 7 局 | 22 pass / 10 fail，共 32 | 未测 / 未测 / 未测 | 未测，门槛至少 19/22 | 未测，要求 0 |
| Bookstack 第 2 局 | 目录内无官方分 JSON；回放被阻断 | 未测 / 未测 / 未测 | 未测 | 未测，要求 0 |

两份 Keep 官方结果来自各历史 run 的 `keep-hosted.json`，均明确记录 workers=4、
每测试及断言超时 10 秒、trace/video off。这里读取的是已有官方测试本机 hosted
配置回放结果，不是本轮平台提交。三张六格矩阵均暂缺真实观测值；不以零填空。

## 阻塞的复现证据

1. `npm install --no-audit --no-fund` 成功，安装 59 个依赖。
2. 默认 shell 的 Node 实际为 v25.6.1。已切换到本机
   `~/.nvm/versions/node/v22.22.0/bin/node` 做最终验证。
3. tsx CLI 的 IPC listener 被禁止，改为等价的 `node --import tsx` 后可以启动编译器。
4. 两次请求分别在 Node 25、Node 22 下收到 `ENOTFOUND api.arc-bench.com`，
   没有发出 HTTP 请求。最终处理器保留失败与费用记录，并停止，不做传输重试。
   见 [`compile.log`](../checks/out/validation/compile.log)。
5. Node 的 `net.createServer().listen(0, '127.0.0.1')` 返回
   `EPERM: listen EPERM: operation not permitted 127.0.0.1`。
6. 已在 `checks/out/` 中复制 Bookstack 应用，实际执行指定的
   `harness_lab/state_rehearsal.py --app bookstack --profile hosted`。副本前端构建成功，
   随后 `free_port()` 的 `listener.bind(('127.0.0.1', 0))` 抛出
   `PermissionError: [Errno 1] Operation not permitted`，未启动应用，未产生官方分。
   见 [`bookstack-official.log`](../checks/out/validation/bookstack-official.log)。

历史应用未修改，没有上传或提交到比赛平台，也没有遗留已启动的应用进程。

## 词汇表最终形态

| 能力 | Step / Target |
|---|---|
| 定位 | 字符串或序列化正则、有序备用名称、exact、ladder/text/role/field、递归 within 作用域 |
| 基础操作 | open（仅 `page.goto('/')`）、click、hover、fill、check（可含 click 后备）、press、selectOption |
| 文本和反馈 | expectText、expectAbsent（DOM count=0）、expectFeedback、expectField（字符串、正则或变量） |
| 数量和状态 | expectCount、expectState：visible/hidden/checked/disabled/enabled/editable |
| 变量及观测 | bind（附 source）、capture：text/value/count/screenshot、compare：equal/notEqual |
| 受限控制流 | if（visible/exists）、try/fallback；任意分支出现 unknown 都保守地使整个场景 unknown |
| 编译不确定性 | unknown.reason：unsupported / no-preparation-path / ambiguous-assertion，必须附 detail |

日期、排序和范围断言没有实现。角色定位允许 radio；check 通过 Playwright 的
setChecked 执行。capture 的截图对比只能说明截图字节变化，不能单独证明选中了指定颜色。

`ladder.ts` 中 `resolveNamed`、`firstVisible`、`namedLocators`、`fillField` 及其必要依赖
从 Keep helpers 原样复制；导出放在函数外，不改函数体。Bookstack 的不同阶梯、
firstVisible 无 count 后备、fillField 无无名字段后备已经在文件注释标明。
这份 runner 对两种 app 使用用户指定的 Keep 阶梯，未声称两种官方 helper 完全等价。

## unknown 清单与七类覆盖

**当前没有编译完成的场景，不能列出已判定的语义 unknown。** 全部待编译场景的
编号和原始名称在上述两份输入目录中；unknown 数量为“未测”，不是 0。

类型中包含评审第 1 节的全部七类：

| 评审类别 | category | 本轮语义 unknown 数 |
|---|---|---|
| 读取／列表 | read-list | 未测 |
| 创建 | create | 未测 |
| 删除 | delete | 未测 |
| 更新／编辑 | edit | 未测 |
| 状态切换 | state-toggle | 未测 |
| 搜索／筛选／排序 | search-filter-sort | 未测；排序原语不在范围内 |
| 导航／可达 | navigation | 未测 |

编译完成后，calibration.json 的 unknown 数组逐场景记录编号、标题、category、
reason 和 detail；markdown 同时列出。schema/覆盖校验连续失败两次才产生明确的
unsupported；基础设施失败不伪装成语义 unknown。

## 验证与费用

- TypeScript：`npm run typecheck` 通过。
- Vitest：`npm test` **17/17 通过**。阶梯测试使用明确标注的 synthetic locator；
  执行器测试使用 synthetic Page，不作为真实浏览器证据。
- 生成 spec 已交给实际 Playwright Test CLI 执行 `--list`，确认可加载及发现测试；
  此步骤不执行浏览器检查。
- 项目要求的 Python 测试实际运行：**420 tests，6 failures，109 errors，46 skipped**。
  其中 99 个 error 的最终异常是 PermissionError；其余错误和失败保留在完整日志，
  未逐一证明所有失败都只由沙箱导致。未修改 `volo/` 或既有测试来绕过它们。
- 完整日志：[`vitest`](../checks/out/validation/vitest.log)、
  [`typecheck`](../checks/out/validation/typecheck.log)、
  [`Playwright discovery`](../checks/out/validation/playwright-discovery.log)、
  [`Python unittest`](../checks/out/validation/python-unittest.log)。
- 模型费用：**CNY 0**；两次 DNS 阶段失败，无模型响应或 usage。账本分别保留最大
  预留 CNY 0.236703 和释放原因，不将预留当作实际消费。没有调用 qwen3.8-max。
  见 [`usage.json`](../checks/out/usage.json)。

## 为什么还不能判断校准是否通过，以及下一步

当前失败点在运行条件，不在已有混淆矩阵：没有观测到编译质量或预测准确率。
代码和单元测试通过也不能证明准备路径、断言完整性或共享状态顺序符合官方行为。

需要在允许访问 `api.arc-bench.com`、监听 localhost 和启动 Chromium 的执行会话中，
按 [`checks/README.md`](../checks/README.md) 的命令继续：

1. 沿用同一 CNY 8 账本，按组编译 Keep 和 Bookstack，冻结 checks hash。
2. 同一份 Keep checks 分别跑两份历史应用；每套仅在开始前恢复一次种子。
3. Bookstack 跑本地检查和独立官方 hosted 留出回放。
4. 填入三张矩阵和逐条 unknown，再审查失败原因是否一致。若出现任意假通过，
   或官方通过场景的本地 pass 率不足 85%，明确报告不通过。

不能读取官方测试后针对 failed_titles 手改 Check 来制造零假通过。后续语义修订应
基于需求中的可说明缺口，作为新的编译版本记录，并保留原版本的校准结果。
