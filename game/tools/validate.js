// validate.js —— 关卡 CI 门：50 关全量重验（可解/par 一致/曲线单调/机制配置合规）
import { solve } from './solver.js';
import { LEVELS, DAILY } from '../src/levels.data.js';

let fail = 0;
const byCh = {};
for (const lv of LEVELS) {
  const r = solve(lv);
  const problems = [];
  if (!r.solvable) problems.push('不可解');
  else if (r.par !== lv.par) problems.push(`par 不一致 声明${lv.par} 实测${r.par}`);
  if (lv.par < 1) problems.push('par<1');
  if (!lv.cars.some(c => c.role === 'hero')) problems.push('无英雄车');
  (byCh[lv.chapter] ||= []).push(lv.par);
  if (problems.length) { fail++; console.error(`L${lv.id} [${lv.name}]: ${problems.join('; ')}`); }
}
console.log('各章 par 范围：');
for (const ch in byCh) {
  const a = byCh[ch];
  console.log(`  ch${ch}: min=${Math.min(...a)} max=${Math.max(...a)} avg=${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)}`);
}
const avg = ch => { const a = byCh[ch]; return a.reduce((x, y) => x + y, 0) / a.length; };
for (let c = 2; c <= 5; c++) {
  if (avg(c) < avg(c - 1) - 1.5) { fail++; console.error(`曲线回退：ch${c} 均值 ${avg(c).toFixed(1)} 明显低于 ch${c - 1} ${avg(c - 1).toFixed(1)}`); }
}
console.log('各章均值：', [1,2,3,4,5].map(c => avg(c).toFixed(1)).join(' → '));
for (const d of DAILY) {
  const r = solve(d);
  if (!r.solvable || r.par !== d.par) { fail++; console.error(`每日 D${d.id}: 校验失败`); }
}
console.log(fail === 0 ? `VALIDATE PASS（${LEVELS.length} 关 + ${DAILY.length} 每日）` : `VALIDATE FAIL ${fail} 处`);
process.exit(fail === 0 ? 0 : 1);
