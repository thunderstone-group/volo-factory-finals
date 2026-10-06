# Light 场景确定性编译器验收（2026-10-06）

已实现默认关闭的 `ONESHOT_LIGHT_TESTS=1`：只有每一步都能解析的完整场景进入编译套件，其余场景原样交给现有模型写测试流程。六份公开 Light 需求完整覆盖 **35/38（92.1%）**，编译场景的操作序列 **35/35 等价（100%）**。这证明编译与本地执行链路，不证明应用生成质量或官方得分。

[原始计数、逐场景操作、输入哈希和运行观测](../evidence/2026-10-06-light-compiler.json)；[编译器](../../oneshot/light_tests.py)、[复验入口](../../scripts/verify_light_tests.py)。

| 任务 | 完整场景 | WHEN/THEN 已解析 | 含 GIVEN 已解析 | 等价场景 | `--list` | 运行 pass/fail/error |
|---|---:|---:|---:|---:|---:|---:|
| 12306 | 6/6 | 75/75 | 86/86 | 6/6 | 6 | 0/6/0 |
| bookstack | 5/6 | 93/95 | 107/109 | 5/5 | 5 | 0/5/0 |
| ctrip | 9/9 | 231/231 | 255/255 | 9/9 | 9 | 0/9/0 |
| keep | 5/6 | 83/85 | 95/97 | 5/5 | 5 | 0/5/0 |
| prestashop | 4/5 | 140/143 | 151/154 | 4/4 | 4 | 0/4/0 |
| stackoverflow | 6/6 | 127/127 | 143/143 | 6/6 | 6 | 0/6/0 |
| 合计 | **35/38** | **749/756（99.1%）** | **837/844（99.2%）** | **35/35** | **35** | **0/35/0** |

1. **覆盖率。** 88 个 GIVEN 均被识别：38 个初始入口步骤可转换为 `page.goto('/')`；其余 50 个种子说明只保留为注释，包括交互中间出现的种子说明。表中的步骤覆盖计入未完整编译场景里已识别的步骤；这些场景仍整条回退，绝不执行部分测试。两个旧 Lite 文件各为 **0/6**，合计 **0/12**。
2. **等价检查。** 独立的 JavaScript 记录器运行官方 TypeScript 和生成的 CommonJS，逐步比较 `(operation, role, name, scope chain, value)`，同时核对步骤顺序、标题和空 storage state。35 个场景共 **749 个操作**，差异 **0**。另直接执行两版 helpers，比较 **43 个底层操作 × 6 份 helper**，包含原生和自定义 combobox 分支，全部一致。记录器不调用 Python 句式解析器；生产编译器不读取官方测试或应用源码。
3. **运行。** 六套 `--list` 均退出 0，数量逐一等于编译场景数。通过 `testgen.run_suite` 对六个只读起点应用的临时副本运行：**35 个场景实际执行，0 加载错误、0 语法错误、0 error**。失败均为具名元素的计数断言，起点未提供相应交互契约。沿用现有每测试 15 秒、动作/断言 5 秒的本地 runner；这不是官方评测结果。
4. **定向回归。** 新增 **16 个测试，全部通过、0 跳过**，覆盖各模板与四种作用域、近似句式拒绝、隐式作用域歧义、种子注释安全、Lite 回退、默认开关、混合 manifest、审计/修复的场景分组、固定 helper 失败归属和扁平包导入。混合套件实际 `--list` 为 **2**。关闭开关对比基线 `5255f16ceaf3`：**8 个任务、25 次模拟写测试请求、33 个文件逐字节一致**（固定计时，使用同一桩响应）；编译文件 `calls=0`，全覆盖套件连审计也不调用模型。
5. **完整回归。** `tests_oneshot`：**295 条，276 通过，19 跳过，0 失败/错误**。19 条跳过包括 16 条缺少测试指定 Node/Acorn runtime 的源码契约检查，以及 3 条要求完整 Chromium 可执行文件的旧 scenario-check 检查；当前可用的 Chromium headless shell 已实际完成本次 35 场景。仓库要求的 legacy `tests`：**226 条，214 通过，12 跳过**（既有 Docker/可选浏览器条件）。扁平包加入 `light_tests.py`，实际解包后导入并生成测试成功，包内业务题名扫描通过。
6. **交付。** 本报告列出全部未编译步骤；源码、验证脚本和证据仅进入指定工作树的本地提交。没有网关调用、平台 API 调用或上传。包 SHA-256：`824f01328d8b3b5c005323c206984234911b3376fdab15f50b8dba3827bf4a5f`。

未编译模板共 7 条步骤，涉及 3 个场景；`Q` 代表双引号字符串：

| 模板 | 次数 | 场景 | 原因 |
|---|---:|---|---|
| `WHEN The user activates Export Markdown and receives the download.` | 1 | bookstack EV-2.2 | 尚未实现下载事件生命周期 |
| `THEN The download succeeds, its suggested filename ends with .md, and its UTF-8 content includes Q, Q, and Q.` | 1 | bookstack EV-2.2 | 尚未实现文件名、读取流和内容断言 |
| `WHEN The user activates Add image and chooses Q with the exact PNG bytes stated above.` | 1 | keep EV-3.2 | 尚未实现文件选择事件与种子字节绑定 |
| `THEN The attachment renders with positive displayed width and height.` | 1 | keep EV-3.2 | 尚未实现图片尺寸轮询 |
| `THEN The readonly Share URL field contains the Facebook sharing target with an absolute HTTP(S) product permalink as specified above.` | 1 | prestashop EV-2.1 | 尚未实现描述中的分享 URL 协议与参数规则 |
| 同上，提供商为 `X` | 1 | prestashop EV-2.1 | 同上 |
| 同上，提供商为 `Pinterest` | 1 | prestashop EV-2.1 | 同上 |

实现通过需求中明确的控件声明区分 `button` 和 `link OR button`，复用已建立的作用域；无法确定的声明或上下文直接回退。编译测试保留逐场景失败：初次冒烟暴露旧报告逻辑把相同 helper 行的应用失败折叠成 error，修复后重跑得到上表结果；模型生成测试保持原折叠逻辑。

复验（`NODE_PATH` 指向已有 Playwright 1.57.0 安装，不会自动安装或调用模型）：

```sh
export NODE_PATH=/path/to/playwright-1.57.0/node_modules
export TMPDIR="$PWD/runs/light-compiler/tmp"
mkdir -p "$TMPDIR"
PYTHONDONTWRITEBYTECODE=1 ~/projects/volo-factory/.venv/bin/python scripts/verify_light_tests.py \
  --corpus ~/projects/arcbench-campaign/evidence/2026-10-06-finals \
  --output runs/light-compiler --smoke
PYTHONPATH=.:tests_oneshot ~/projects/volo-factory/.venv/bin/python -m unittest discover -s tests_oneshot -v
~/projects/volo-factory/.venv/bin/python -m unittest discover -s tests -v
```

未入包的逐步对照与完整运行日志保留在工作树 `runs/light-compiler/`。最终源码重编译的六套 spec/helper 与冒烟使用文件逐字节相同；官方需求、测试和起点目录均未改动。
