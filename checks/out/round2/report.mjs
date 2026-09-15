// Rebuild only the second-round section from retained evidence. Run from checks/.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const exists=p=>fs.existsSync(p);
const escape=s=>String(s??'').replaceAll('|','\\|').replace(/\s+/g,' ').trim();
const pct=n=>n===null?'未测':`${(n*100).toFixed(1)}%`;
const samples=[['keep-5','Keep 第 5 局'],['keep-7','Keep 第 7 局'],['bookstack-2','Bookstack 第 2 局']];
let text=`\n## 第二轮\n\n### 结论与口径\n\nQwen 的三份校准已完成。按本轮新口径，unknown 从召回率分母排除，\n但仍保留在固定场景总数和覆盖率中；无可观测官方通过场景时，召回为 null，不能判达标。\n第一轮原始口径不覆盖修改，下面同时列出可比较的排除 unknown 口径。\n\n`;
const hasDeepseek=samples.every(([s])=>exists(`out/round2/deepseek/${s}/calibration.json`));
text+=hasDeepseek?'DeepSeek 对照已完成，三份结果与 Qwen 并列。\n\n':'**DeepSeek 对照未完成，不能宣称第二轮任务全部完成。** 编译请求先后超时、收到上游连接重置；随后本机代理多个节点失活，普通 HTTPS 也无法建立。没有将网络失败填成场景 unknown。\n\n';
text+='| 样本 | 版本 | 本地 pass / fail / unknown | 假通过 | 排除 unknown 的召回 | 固定官方通过分母的召回 | 覆盖率 | 本轮判据 |\n|---|---|---:|---:|---:|---:|---:|---|\n';
for(const [sample,label] of samples) {
 for(const [version,path] of [['第一轮',`out/${sample}/calibration.json`],['第二轮 Qwen',`out/round2/qwen/${sample}/calibration.json`],['第二轮 DeepSeek',`out/round2/deepseek/${sample}/calibration.json`]]) {
  if(!exists(path)){text+=`| ${label} | ${version} | 未运行 | — | — | — | — | 未完成 |\n`;continue;}
  const c=read(path),m=c.matrix,pass=m.pass.pass+m.pass.fail,fail=m.fail.pass+m.fail.fail,u=m.unknown.pass+m.unknown.fail;
  const known=m.pass.pass+m.fail.pass,all=known+m.unknown.pass,recall=known?m.pass.pass/known:null;
  text+=`| ${label} | ${version} | ${pass} / ${fail} / ${u} | ${c.falsePasses.length} | ${pct(recall)} (${m.pass.pass}/${known}) | ${pct(all?m.pass.pass/all:null)} | ${pct((pass+fail)/c.denominator)} | ${recall!==null&&recall>=.85&&!c.falsePasses.length?'达标':'未达标'} |\n`;
 }
}
text+='\n**排除 unknown 后的高召回不等于广泛覆盖。** Qwen 在 Keep 只执行 8/32 个场景，在 Bookstack 只执行 7/34 个；第一轮假通过变成 unknown 也不能算“识别了原来的缺陷”。\n\n### 三张主矩阵与第一轮并排\n\n每格为 **官方 pass / 官方 fail** 的数量；行是本地判定。\n\n';
for(const [sample,label] of samples) {
 const old=read(`out/${sample}/calibration.json`),q=read(`out/round2/qwen/${sample}/calibration.json`),dp=`out/round2/deepseek/${sample}/calibration.json`,d=exists(dp)?read(dp):null;
 text+=`#### ${label}\n\n| 本地判定 | 第一轮 | 第二轮 Qwen | 第二轮 DeepSeek |\n|---|---:|---:|---:|\n`;
 for(const k of ['pass','fail','unknown'])text+=`| ${k} | ${old.matrix[k].pass} / ${old.matrix[k].fail} | ${q.matrix[k].pass} / ${q.matrix[k].fail} | ${d?`${d.matrix[k].pass} / ${d.matrix[k].fail}`:'未运行'} |\n`;
 text+=`\n[Qwen calibration](../checks/out/round2/qwen/${sample}/calibration.json) · [Qwen results](../checks/out/round2/qwen/${sample}/results.json)\n\n`;
}
text+='### 仍然假通过的场景\n\n| 模型 / 样本 / 场景 | 已观察差异与原因 |\n|---|---|\n';
for(const model of ['qwen','deepseek'])for(const [sample,label] of samples) {
 const file=`out/round2/${model}/${sample}/calibration.json`;if(!exists(file))continue;
 for(const id of read(file).falsePasses) {
  let reason='需要结合该场景的冻结 Check、官方错误和本地结果进一步归因，不能仅凭相同状态推断同一缺陷。';
  if(sample==='keep-7'&&id==='REQ-2.7.6.2#1')reason='本轮 GIVEN 只有打开首页，直接点 Notes；官方先按 Work 过滤再返回 Notes，失败时落到 /^notes$/ 的 button 后备。删掉准备路径后，跨页面状态与原故障没有被复现。不是已经修复官方失败。';
  if(sample==='keep-7'&&id==='REQ-6.1#1')reason='DeepSeek 只断言 Notes 可见；官方依次检查 Notes、Reminders、Edit labels、Archive、Trash，并实际失败在 Edit labels。属于编译漏断言，不能用一个导航项代表整条场景。';
  if(sample==='bookstack-2'&&id==='REQ-4.3.2#1')reason='DeepSeek 只导航至新建页、点击 Cancel、断言原种子书架标题可见；官方此前在点击 Shelf 4.3.2 时落到 button 后备并超时。即使已删除额外 expect，不同 helper/异步解析仍可绕开原失败；末尾断言也未证明未创建新记录。';
  if(sample==='bookstack-2'&&id==='REQ-4.5.2#1')reason='DeepSeek 导航至编辑页后直接 Cancel，只断言原书架标题。官方实际失败在精确 Edit 的 button 后备；本地解析时序不同，同时没有修改字段或验证原描述，存在编译漏测。';
  if(sample==='bookstack-2'&&id==='REQ-4.2.1#1')reason='本轮已无前置 expect，仍能点击 Shelf 4.2.1；官方在该步骤落到不存在的 button 后备并超时。本地仍是 Keep 的十级 resolveNamed 和 count/重复解析后备，Bookstack 官方是较短的 firstVisible。执行协议/采样时序差异仍存在；没有单独隔离各次解析的时序贡献。';
  text+=`| ${model} / ${label} / ${id} | ${reason} |\n`;
 }
}
text+='\nQwen 的 Bookstack 召回为 0/5：REQ-1.1、REQ-2.1、REQ-4.1、REQ-5.1 把需求 prose 中的 `homepage`、`login form page`、`shelf list page`、`books list page` 当成实际 UI 文本；REQ-5.2.1 先用非精确 Books 导航，仍可能命中 BookStack 品牌链接，随后找不到目标书籍。名称“来自原文”并不证明它是页面可见文本。\n\n### 编译与执行约束及校验过程\n\n- 新增独立 version=2 格式：GIVEN 仅 open/click；WHEN 按原句分组且最多两步，只允许 hover/click/fill/check/press；THEN 仅 expectText/expectAbsent。严格对象拒绝 role、via、exact、within 和其他操作。unknown 是整个 Check 的状态，不混入可执行阶段。\n- 名称由原文/种子来源校验；本轮裸动作词按当前 WHEN 原句核对，共享的引号/反引号字面量可复用。hover 必须是种子标题，实际执行却始终调用原样 hoverNamed/resolveNamed。fill 使用原样 fillField。没有增加动作前可见性探测、等待或条件后备。\n- 模型不知道官方结果和 tests 内容。Qwen 输入最初含重复的共享词汇/祖先信息；DeepSeek 重试将这些相同信息去重到顶层，完整需求和合约未删除。这不是逐字相同请求的成本比较。\n- 最小导航是语义要求，不能只靠结构 schema 证明。运行前检查发现模型把 Trash/Archived 的 WHEN 点击移动到 GIVEN，于是补上初始页额外导航和空动作 WHEN 的拒绝条件。原响应离线重新校验，没有付费重写来迎合官方结果。早期两份运行留在 `out/round2/qwen/before-phase-fix/`，不纳入最终矩阵。\n- 修正了普通空格和 \\s+ 等价形式被误拒的来源校验 bug；保留原始请求、响应和修改前产物。随后修正了含点号的引号种子名被误拒的问题；四份响应离线重验后 Keep 哈希不变，仅重新运行两个 Bookstack 套件，旧结果留在 `out/round2/before-literal-fix/`。最终 artifacts 使用新校验，原始响应未修改。\n- 语义完整性仍是模型错误来源：DeepSeek 的 REQ-2.3.1 省略 More options，REQ-2.4 省略关闭编辑器，REQ-2.7.1/2 省略菜单准备。它们满足结构上的两步上限，却没有完整执行原 WHEN，保留这些失败作为对照，不能把执行覆盖率当成语义覆盖率。\n- 四个 worker、10 秒用例上限、默认 Playwright expect 5 秒、默认 actionTimeout=0（由用例时限约束）、trace/video off。第一轮 expect=10 秒，本轮这一差异来自用户要求，不能把变化完全归因于模型或提示词。\n\n### unknown 逐条清单\n\n这里记录编译输出本身的原因，不把每个理由都当作正确的能力边界。例如 Qwen 在 REQ-4.2 声称 GIVEN 不能 click，实际规则允许必要的导航点击；这属于模型过于保守。\n\n';
for(const model of ['qwen','deepseek'])for(const app of ['keep','bookstack']) {
 const path=`out/round2/${model}/${app}/checks.json`;
 if(!exists(path)){text+=`#### ${model} / ${app}\n\n未完成编译，unknown 数未测。\n\n`;continue;}
 const checks=read(path),unknown=checks.filter(c=>c.status==='unknown');
 text+=`#### ${model} / ${app}：${unknown.length}/${checks.length}\n\n| 场景 | category | reason | 原因 |\n|---|---|---|---|\n`;
 for(const c of unknown) {
  let detail=c.detail;
  if(detail.startsWith('Schema/source validation failed:')) {try{detail='校验拒绝：'+JSON.parse(detail.slice(detail.indexOf(':')+1)).map(e=>e.message).join('; ');}catch{}}
  text+=`| ${c.scenario} ${escape(c.title)} | ${c.category} | ${c.reason} | ${escape(detail)} |\n`;
 }
 text+='\n';
}
const ledger=read('out/round2/usage.json'),probePath='out/round2/validation/deepseek-probe.json',probe=exists(probePath)?read(probePath):null;
const all=[...ledger,...(probe&&!ledger.some(r=>r.label==='diagnostic-connection-probe')?[probe]:[])];
const paid=all.filter(r=>r.accounting==='usage').reduce((a,r)=>a+r.chargedCny,0),reserved=all.filter(r=>r.accounting==='reserved').reduce((a,r)=>a+r.chargedCny,0);
text+=`### 费用、验证与网络中断记录\n\n- 本轮账本独立于第一轮 CNY 8 预算，限额 **CNY 5**。有 usage 的已知费用 **CNY ${paid.toFixed(6)}**；未结算预留 **CNY ${reserved.toFixed(6)}**；合计占用 **CNY ${(paid+reserved).toFixed(6)}**。预留不是实际账单，不能报告成精确消费。\n- Qwen 价目 12/1.5/36，DeepSeek 3/0.1/9；缓存折扣和所有重试均在 [usage.json](../checks/out/round2/usage.json) 中。一次小响应探针另存 [probe](../checks/out/round2/validation/deepseek-probe.json)，用于区分服务故障与输入规模，费用也纳入上面的合计。\n- 两模型均请求关闭 thinking；最终 8 次成功 HTTP 调用均有 usage（每个编译任务一次初始输出和一次修正）。DeepSeek Keep 首次 180 秒超时，去重输入重试收到 HTTP 400 proxy_error，说明 gateway→上游转发连接被重置；Bookstack 在 TLS 建立前 ECONNRESET，未发出 HTTP 请求，计费为 0。\n- 期间本机 Clash 默认节点及多个备用节点失活，普通 HTTPS 也失败；18:47 复查网关恢复 HTTP 200 后，完成了两份 DeepSeek 编译及三份校准。没有修改共享代理配置，网络恢复提醒已不再阻塞任务。\n- TypeScript 和 Vitest 29 项通过。Python 全套实际运行 420 项，1 个 token-budget 测试报错、46 skipped；该报错测试单独重跑通过。没有修改 volo 或用单独重跑冒充整套通过。\n- 六份最终矩阵均已离线复算，四份 Check 的结构和来源校验通过；见 [schema audit](../checks/out/round2/validation/schema-audit.json) 和 [复算记录](../checks/out/round2/validation/recomputed.log)。全部测试/诊断后端已关闭，临时应用副本已清理；见 [cleanup](../checks/out/round2/validation/backend-cleanup.json)。\n\n`;
text+='### 复现与判断\n\n```sh\ncd ~/projects/volo-factory-worktrees/ts-kernel/checks\nexport PATH=~/.nvm/versions/node/v22.22.0/bin:$PATH\nnode --import tsx out/round2/recompute.mjs\n```\n\n复算读取冻结 checks、results 与相同的官方摘要，核对 SHA-256 和每个矩阵字段。第一轮原始文件未覆盖。\n\n本轮不支持“把检查变笨就能同时得到高覆盖与零假通过”的结论：Qwen 的 Keep 第 5 局达标主要伴随覆盖范围缩小，第 7 局与 Bookstack 仍有假通过。DeepSeek 对照在更高执行覆盖率下仍未过门槛。下一步应先区分路径缺失、断言缺失和 app 专属执行协议差异，再决定是否保留两步限制；不能通过把更多场景改成 unknown 来宣称泛化或可靠验收。\n';
const doc='../docs/checks-calibration-2026-09-15.md',base=fs.readFileSync(doc,'utf8').split('\n## 第二轮')[0];
fs.writeFileSync(doc,base+text);
console.log('Second-round report section rebuilt from retained artifacts.');
