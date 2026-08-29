// generator.js —— 关卡生成器 v2：反向打乱法（从 solved 态随机逆推 S 步）
// 打乱保证可解；S 控制难度骨架；求解器复核 par 带；装饰车剪枝；乘客/班车后注入。

import { createLevel, initialState } from '../src/rules/board.js';
import { slideTargets, applyMove } from '../src/rules/move.js';
import { solve, checkNecessity, narrowness } from './solver.js';

export const CHAPTERS = [
  { ch: 1, scene: '小区窄巷', size: 6, cars: [3, 4], block: 2, len3: 0.15, len4: 0, turn: false, pickups: 0, ordered: false, bus: 0, walls: [0, 0], steps: 3 },
  { ch: 2, scene: '学校门口', size: 6, cars: [4, 5], block: 3, len3: 0.2, len4: 0, turn: true, pickups: 1, ordered: false, bus: 0, walls: [0, 1], steps: 4 },
  { ch: 3, scene: '写字楼', size: 6, cars: [5, 6], block: 3, len3: 0.25, len4: 0.1, turn: true, pickups: 1, ordered: false, bus: 0, walls: [1, 1], steps: 5 },
  { ch: 4, scene: '商场卸货区', size: 6, cars: [6, 7], block: 4, len3: 0.4, len4: 0.15, turn: true, pickups: 2, ordered: true, bus: 0, walls: [2, 2], steps: 5 },
  { ch: 5, scene: '机场高速', size: 6, cars: [7, 8], block: 4, len3: 0.5, len4: 0.2, turn: true, pickups: 2, ordered: true, bus: 0, walls: [2, 2], steps: 6 },
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const exitRowOf = h => (h === 6 ? 2 : 3);

// 对已有 def 从初始态随机打乱 k 步，返回新 def
function scrambleDef(def, k, rng) {
  const level = createLevel(def);
  let state = initialState(level);
  let last = null;
  for (let i = 0; i < k; i++) {
    const options = [];
    for (const car of level.cars) {
      for (const t of slideTargets(level, state, car.id)) {
        if (last && last.carId === car.id && last.from === t) continue;
        options.push([car.id, t]);
      }
    }
    if (!options.length) break;
    const [carId, t] = options[Math.floor(rng() * options.length)];
    const car = level.cars.find(c => c.id === carId);
    const from = state.cars[carId][car.dir === 'h' ? 'x' : 'y'];
    state = applyMove(level, state, carId, t);
    last = { carId, from };
  }
  return { ...def, cars: def.cars.map(c => ({ ...c, x: state.cars[c.id].x, y: state.cars[c.id].y })) };
}

// 构造底板：英雄车在最左（必须横穿整行），出口行显式布竖挡（难度骨架），其余随机
function sampleSolvedBoard(cfg, rng) {
  const w = Array.isArray(cfg.size) ? (rng() < 0.5 ? cfg.size[0] : cfg.size[1]) : cfg.size;
  const h = w;
  const exitRow = exitRowOf(h);
  const used = new Map();
  const walls = [];
  const nw = cfg.walls[0] + Math.floor(rng() * (cfg.walls[1] - cfg.walls[0] + 1));

  // 英雄车最左
  const heroX = 0;
  used.set('0,' + exitRow, true);
  used.set('1,' + exitRow, true);
  const cars = [{ id: 'R', x: heroX, y: exitRow, len: 2, dir: 'h', role: 'hero' }];

  // 出口行竖挡：列 2..w-1，作为必须清除的障碍（难度骨架）
  const blockCols = [];
  for (let x = 2; x < w; x++) blockCols.push(x);
  // 打乱列序取 block 个
  for (let i = blockCols.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [blockCols[i], blockCols[j]] = [blockCols[j], blockCols[i]]; }
  let placed = 0;
  for (const bx of blockCols) {
    if (placed >= cfg.block) break;
    if (used.has(bx + ',' + exitRow)) continue;
    // 竖车 len2：占 (bx,exitRow) 与上或下
    const up = rng() < 0.5;
    const oy = up ? exitRow - 1 : exitRow + 1;
    if (oy < 0 || oy >= h || used.has(bx + ',' + oy)) continue;
    used.set(bx + ',' + exitRow, true);
    used.set(bx + ',' + oy, true);
    cars.push({ id: 'c' + cars.length, x: bx, y: up ? exitRow - 1 : exitRow, len: 2, dir: 'v' });
    placed++;
  }

  // 墙
  for (let i = 0; i < nw; i++) {
    for (let t = 0; t < 40; t++) {
      const x = Math.floor(rng() * w), y = Math.floor(rng() * h);
      if (used.has(x + ',' + y)) continue;
      if (x === w - 1 && y === exitRow) continue;
      used.set(x + ',' + y, true);
      walls.push({ x, y });
      break;
    }
  }

  // 其余随机车
  const nCars = cfg.cars[0] + Math.floor(rng() * (cfg.cars[1] - cfg.cars[0] + 1)) + cars.length;
  let guard = 0;
  while (cars.length < nCars && guard++ < 300) {
    const dir = rng() < 0.5 ? 'h' : 'v';
    const r4 = rng();
    const len = r4 < (cfg.len4 || 0) ? 4 : r4 < (cfg.len4 || 0) + cfg.len3 ? 3 : 2;
    const x = Math.floor(rng() * w), y = Math.floor(rng() * h);
    const cells = [];
    for (let i = 0; i < len; i++) cells.push(dir === 'h' ? [x + i, y] : [x, y + i]);
    if (cells.some(([cx, cy]) => cx < 0 || cx >= w || cy < 0 || cy >= h || used.has(cx + ',' + cy))) continue;
    cells.forEach(([cx, cy]) => used.set(cx + ',' + cy, true));
    cars.push({ id: 'c' + cars.length, x, y, len, dir });
  }

  const def = { w, h, exit: { x: w, y: exitRow }, cars, pickups: [], walls, turn: !!cfg.turn };
  try { createLevel(def); } catch { return null; }
  return def;
}

// 注入班车/乘客 → 求解验证 → 剪枝 → 窄度
export function makeCandidate(cfg, rng, stats) {
  stats.attempts++;
  let def = sampleSolvedBoard(cfg, rng);
  if (!def) { stats.rejectLayout++; return null; }

  // 固定步数打乱：只为了打散英雄车起点与增加纠缠，难度由密度提供
  def = scrambleDef(def, cfg.steps, rng);

  // 班车：不在英雄行的车
  if (cfg.bus > 0) {
    const cands = def.cars.filter(c => c.role !== 'hero' && !(c.dir === 'h' && c.y === exitRowOf(def.h)));
    if (!cands.length) { stats.rejectBus++; return null; }
    const b = cands[Math.floor(rng() * cands.length)];
    const sign = rng() < 0.5 ? 1 : -1;
    b.bus = b.dir === 'v' ? { dx: 0, dy: sign } : { dx: sign, dy: 0 };
  }

  // 乘客：英雄行上下相邻行，开局不与英雄相邻
  if (cfg.pickups > 0) {
    const exitRow = exitRowOf(def.h);
    const hero = def.cars.find(c => c.role === 'hero');
    const heroCells = [];
    for (let i = 0; i < hero.len; i++) heroCells.push([hero.x + i, hero.y]);
    const occupied = new Map();
    def.walls.forEach(w2 => occupied.set(w2.x + ',' + w2.y, true));
    for (const c of def.cars) {
      for (let i = 0; i < c.len; i++) {
        occupied.set((c.dir === 'h' ? c.x + i : c.x) + ',' + (c.dir === 'v' ? c.y + i : c.y), true);
      }
    }
    const pickups = [];
    let pg = 0;
    while (pickups.length < cfg.pickups && pg++ < 80) {
      // 转向关：乘客全图可放（红车可纵向机动）；非转向关：仅英雄行上下相邻行
      const y = cfg.turn ? Math.floor(rng() * def.h) : exitRow + (rng() < 0.5 ? -1 : 1);
      if (y < 0 || y >= def.h) continue;
      const x = Math.floor(rng() * def.w);
      if (occupied.has(x + ',' + y)) continue;
      if (pickups.some(p => p.x === x && p.y === y)) continue;
      if (heroCells.some(([hx, hy]) => Math.abs(hx - x) + Math.abs(hy - y) <= 1)) continue;
      pickups.push({ id: 'p' + (pickups.length + 1), x, y, order: cfg.ordered ? pickups.length + 1 : undefined });
    }
    if (pickups.length < cfg.pickups) { stats.rejectLayout++; return null; }
    def.pickups = pickups;
  }

  let r = solve(def);
  if (!r.solvable) { stats.rejectUnsolvable++; return null; }
  if (r.par < 1) { stats.rejectPar++; return null; } // 退化关：英雄车已在道闸

  const nar = def.w === 6 && !def.turn ? narrowness(def, r.par) : null;
  return { def, par: r.par, narrowness: nar };
}
