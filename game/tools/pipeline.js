// pipeline.js —— 关卡生产管线：生成→验证→剪枝→波浪排序→50 关 + 曲线图 + run 报告
// 用法：node tools/pipeline.js [seed]

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAPTERS, mulberry32, makeCandidate } from './generator.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seed = Number(process.argv[2] || 20260828);

const SUBS = {
  1: ['出车', '一挡', '双挡', '让行', '倒把', '三挡', '错车', '贴墙', '连环挡', '巷尾冲刺'],
  2: ['接娃', '捎上', '倒接', '绕路', '路边见', '放学铃', '别催', '就一位', '齐活', '关门走人'],
  3: ['早高峰', '班车来了', '掐点', '借道', '别挤', '电梯口', '打卡', '跟车', '错峰', '顶流'],
  4: ['卸货区', '叉车呢', '大场子', '墙后有人', '班车接力', '窄门', '货梯', '加塞', '清场', '双乘客'],
  5: ['登机口', '按序上车', '两位贵宾', '红眼航班', '行李呢', '廊桥', '摆渡', '最后一位', '加时赛', '起飞'],
};
const QUOTES = [
  '这谁停的车？', '技术活儿，赏口饭吃。', '手刹一松，就走。', '稍等，倒一下车。',
  '娃在路边等着呢。', '都坐稳了！', '让一让，让一让。', '这巷子比上回窄了？',
  '乘客就是上帝，上车。', '班车别挤我！', '墙是昨天新砌的？', '出口就在前头。',
  '一把轮的事儿。', '稳字当头。', '油门当刹车？不存在的。',
];

function waveOrder(cands) {
  const s = cands.slice().sort((a, b) => a.par - b.par);
  const buffers = s.slice(0, 2);
  const mids = s.slice(2, 8);
  const peaks = s.slice(8, 10);
  return [mids[0], mids[1], mids[2], buffers[0], mids[3], mids[4], mids[5], buffers[1], peaks[0], peaks[1]];
}

const report = { seed, chapters: [], startedAt: new Date().toISOString() };
const all = [];
let id = 1;
let quoteIdx = 0;

for (const cfg of CHAPTERS) {
  const rng = mulberry32(seed + cfg.ch * 7919);
  const stats = { attempts: 0, rejectLayout: 0, rejectUnsolvable: 0, rejectPar: 0, rejectBus: 0, pruned: 0 };
  const cands = [];
  let guard = 0;
  while (cands.length < 12 && guard++ < 8000) {
    const c = makeCandidate(cfg, rng, stats);
    if (c) cands.push(c);
  }
  if (cands.length < 10) {
    console.error(`chapter ${cfg.ch}: 只产出 ${cands.length} 个候选，不足 10。调配置或换 seed。`);
    process.exit(1);
  }
  const ordered = waveOrder(cands);
  // 大关：每章第 10 关（峰值）= 7x7 放大地图 + 加长车 + 高密度，取 par 最高者保证是章内最难
  const bossCfg = { ...cfg, size: 7, turn: false, len3: 0.4, len4: 0.6, cars: [cfg.cars[0] + 6, cfg.cars[1] + 6], walls: [3, 3], block: 5, steps: 6 };
  let boss = null;
  for (let i = 0; i < 60; i++) {
    const c = makeCandidate(bossCfg, rng, stats);
    if (c && (!boss || c.par > boss.par)) boss = c;
  }
  if (boss) ordered[9] = boss;
  ordered.forEach((c, i) => {
    const isBoss = i === 9 && boss;
    all.push({
      id,
      chapter: cfg.ch,
      name: isBoss ? `${cfg.scene} · 大关` : `${cfg.scene} · ${SUBS[cfg.ch][i]}`,
      quote: QUOTES[quoteIdx++ % QUOTES.length],
      ...c.def,
      par: c.par,
      narrowness: c.narrowness,
    });
    id++;
  });
  report.chapters.push({ ch: cfg.ch, parRange: [ordered[0].par, ordered[9].par], stats, accepted: cands.length, finalPars: ordered.map(c => c.par) });
}

// 每日挑战池（10 关，混合 ch3/ch4 配置）
const daily = [];
const drng = mulberry32(seed + 999);
const dcfg = { ...CHAPTERS[2], par: [10, 20] };
let dguard = 0;
while (daily.length < 10 && dguard++ < 4000) {
  const c = makeCandidate(dguard % 2 ? dcfg : { ...CHAPTERS[3], bus: 0 }, drng, { attempts: 0 });
  if (c) daily.push({ id: 101 + daily.length, chapter: 0, name: `每日挑战 · ${daily.length + 1}`, quote: QUOTES[(quoteIdx + daily.length) % QUOTES.length], ...c.def, par: c.par, narrowness: c.narrowness });
}

// ---------- 输出 ----------
const dataJs =
  '// levels.data.js —— 由 tools/pipeline.js 生成（seed=' + seed + '），勿手改\n' +
  'export const LEVELS = ' + JSON.stringify(all, null, 1) + ';\n' +
  'export const DAILY = ' + JSON.stringify(daily, null, 1) + ';\n';
writeFileSync(join(root, 'src', 'levels.data.js'), dataJs);

// 难度曲线 SVG
const W = 1000, H = 320, pad = 40;
const maxPar = Math.max(...all.map(l => l.par)) + 4;
const x = i => pad + (i * (W - pad * 2)) / (all.length - 1);
const y = p => H - pad - (p * (H - pad * 2)) / maxPar;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
svg += `<rect width="${W}" height="${H}" fill="#0B0C0A"/>`;
for (let ch = 1; ch <= 5; ch++) {
  const i0 = (ch - 1) * 10;
  svg += `<line x1="${x(i0)}" y1="${pad / 2}" x2="${x(i0)}" y2="${H - pad / 2}" stroke="rgba(255,255,255,.15)" stroke-dasharray="4 4"/>`;
  svg += `<text x="${x(i0 + 4.5)}" y="${H - 12}" fill="#8A8F98" font-size="12" text-anchor="middle">第${ch}章</text>`;
}
svg += `<polyline fill="none" stroke="#FFB800" stroke-width="2" points="${all.map((l, i) => `${x(i)},${y(l.par)}`).join(' ')}"/>`;
all.forEach((l, i) => {
  const c = l.pickups.length ? '#00C853' : l.cars.some(c2 => c2.bus) ? '#4a90d9' : '#FFB800';
  svg += `<circle cx="${x(i)}" cy="${y(l.par)}" r="3" fill="${c}"/>`;
});
svg += `<text x="${pad}" y="${pad / 2 + 4}" fill="#F5F2EA" font-size="13">难度曲线（par 最优步数）· 绿=捎人关 蓝=班车关 · seed=${seed}</text>`;
svg += '</svg>';
writeFileSync(join(root, '..', 'docs', 'difficulty-curve.svg'), svg);

report.elapsedMs = 0;
writeFileSync(join(root, '..', 'docs', 'pipeline-report.json'), JSON.stringify(report, null, 2));

console.log('50 关生成完毕。各章 par：');
for (const c of report.chapters) {
  console.log(`  ch${c.ch}: [${c.finalPars.join(', ')}]  attempts=${c.stats.attempts} pruned=${c.stats.pruned}`);
}
console.log('每日挑战池：', daily.map(d => d.par).join(', '));
