// solver.js —— BFS 求解器（关卡生产管线与内置提示共用）
// 能力：可解性 / 最优步数 par / 解路径 / 每车必要性 / 解路径窄度
// 注意：无班车关卡状态图是无向的（移动可逆），窄度用反向 BFS；班车关卡窄度置 null。

import { createLevel, initialState, stateKey, cloneState } from '../src/rules/board.js';
import { slideTargets, applyMove } from '../src/rules/move.js';
import { isWin } from '../src/rules/goal.js';

// 前向 BFS。levelDef 为关卡定义；opts.from 可指定起始状态（提示功能用）。
// 返回 { solvable, par, path, explored }，path 为 [carId, target] 步骤数组（不含起点）
export function solve(levelDef, opts = {}) {
  const level = typeof levelDef.createLevel === 'function' ? levelDef : createLevel(levelDef);
  const start = opts.from ? cloneState(opts.from) : initialState(level);
  const maxStates = opts.maxStates || 2_000_000;

  const startKey = stateKey(level, start);
  const dist = new Map([[startKey, 0]]);
  const prev = new Map(); // key -> { key: 前驱, move: [carId, target] }
  const queue = [start];
  let head = 0;
  let winKey = null;

  while (head < queue.length) {
    const s = queue[head++];
    const k = stateKey(level, s);
    if (isWin(level, s)) { winKey = k; break; }
    if (dist.size > maxStates) return { solvable: null, par: null, path: null, explored: dist.size, overflow: true };

    for (const car of level.cars) {
      if (car.bus) continue;
      for (const t of slideTargets(level, s, car.id)) {
        const ns = applyMove(level, s, car.id, t);
        const nk = stateKey(level, ns);
        if (dist.has(nk)) continue;
        dist.set(nk, dist.get(k) + 1);
        prev.set(nk, { key: k, move: [car.id, t] });
        queue.push(ns);
      }
    }
  }

  if (!winKey) return { solvable: false, par: null, path: null, explored: dist.size };

  const path = [];
  let k = winKey;
  while (k !== startKey) {
    const p = prev.get(k);
    if (!p) break;
    path.unshift(p.move);
    k = p.key;
  }
  return { solvable: true, par: dist.get(winKey), path, explored: dist.size };
}

// 每车必要性：删掉某车后 par 不下降 => 该车是装饰车（与解题难度无关）。
// 数学事实：删车只会释放空间，base 可解 ⟹ 删任意车后仍可解（原解去掉该车步骤仍合法）。
// 因此判据用 par 对比：par(reduced) === par(base) ⟺ 装饰车。
// 返回 { minimal, removable }（removable 为装饰车 id 列表，空 = 每车都贡献难度）
export function checkNecessity(levelDef) {
  const base = solve(levelDef);
  if (!base.solvable) return { minimal: false, removable: [], unsolvable: true };
  const baseCars = Array.isArray(levelDef) ? levelDef : levelDef.cars;
  const removable = [];
  for (const c of baseCars) {
    if (c.role === 'hero') continue;
    const reduced = { ...levelDef, cars: baseCars.filter(x => x.id !== c.id) };
    const r = solve(reduced);
    if (!r.solvable) continue; // 理论不可能；防御性处理
    if (r.par >= base.par) removable.push(c.id);
  }
  return { minimal: removable.length === 0, removable };
}

// 解路径窄度：长度恰为 par 的不同最优解路径条数（截断 500）。
// 语义：同一 par 档内，最优解越少 = 解法越唯一 = 人类体感越难。
// 仅无班车关卡（班车破坏移动可逆性）；有班车返回 null。
export function narrowness(levelDef, par) {
  const level = typeof levelDef.createLevel === 'function' ? levelDef : createLevel(levelDef);
  if (level.cars.some(c => c.bus)) return null;
  const r = solve(level);
  if (!r.solvable) return null;
  const P = par ?? r.par;

  // 反向 BFS：从所有可达胜利态出发求 distToWin（无班车 => 边对称，applyMove 即可扩展）
  const distToWin = new Map();
  const queue = [];
  const seen = new Map([[stateKey(level, initialState(level)), 0]]);
  const q2 = [initialState(level)];
  let h2 = 0;
  while (h2 < q2.length) {
    const s = q2[h2++];
    const k = stateKey(level, s);
    if (isWin(level, s)) { distToWin.set(k, 0); queue.push(s); }
    for (const car of level.cars) {
      for (const t of slideTargets(level, s, car.id)) {
        const ns = applyMove(level, s, car.id, t);
        const nk = stateKey(level, ns);
        if (!seen.has(nk)) { seen.set(nk, 1); q2.push(ns); }
      }
    }
  }
  let hb = 0;
  while (hb < queue.length) {
    const s = queue[hb++];
    const k = stateKey(level, s);
    const d = distToWin.get(k);
    for (const car of level.cars) {
      for (const t of slideTargets(level, s, car.id)) {
        const ns = applyMove(level, s, car.id, t);
        const nk = stateKey(level, ns);
        if (!distToWin.has(nk)) { distToWin.set(nk, d + 1); queue.push(ns); }
      }
    }
  }

  // 受限 DFS 计数：恰好 P 步到达胜利态的路径数（上限 500）
  const CAP = 500;
  let count = 0;
  let stop = false;
  const dfs = (s, depth) => {
    if (stop) return;
    const k = stateKey(level, s);
    if (distToWin.get(k) === 0) {
      if (depth === P) count++;
      if (count >= CAP) stop = true;
      return;
    }
    if (depth >= P) return;
    for (const car of level.cars) {
      for (const t of slideTargets(level, s, car.id)) {
        const ns = applyMove(level, s, car.id, t);
        const nk = stateKey(level, ns);
        const dw = distToWin.get(nk);
        if (dw == null) continue;
        if (depth + 1 + dw > P) continue;
        dfs(ns, depth + 1);
        if (stop) return;
      }
    }
  };
  dfs(initialState(level), 0);
  return count;
}

// 组合入口：管线用
export function analyzeLevel(levelDef) {
  const r = solve(levelDef);
  if (!r.solvable) return { solvable: false, explored: r.explored };
  const nec = checkNecessity(levelDef);
  const nar = narrowness(levelDef, r.par);
  return {
    solvable: true,
    par: r.par,
    path: r.path,
    minimal: nec.minimal,
    removable: nec.removable,
    narrowness: nar,
    explored: r.explored,
  };
}

// CLI：node tools/solver.js <level.json 路径或 stdin>
if (process.argv[1] && process.argv[1].endsWith('solver.js')) {
  const fs = await import('node:fs');
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node tools/solver.js <level.json>');
    process.exit(2);
  }
  const def = JSON.parse(fs.readFileSync(file, 'utf8'));
  const t0 = Date.now();
  const result = analyzeLevel(def);
  console.log(JSON.stringify({ ...result, path: undefined, ms: Date.now() - t0 }, null, 2));
}
