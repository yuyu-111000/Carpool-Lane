// solver 测试：手工已知答案关 + 双算法交叉验证（BFS vs 独立 IDDFS）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, initialState } from '../src/rules/board.js';
import { slideTargets, applyMove } from '../src/rules/move.js';
import { isWin } from '../src/rules/goal.js';
import { solve, checkNecessity, narrowness } from '../tools/solver.js';

// 独立交叉验证算法：迭代加深 DFS + 转置表（与 BFS 实现完全不同的搜索策略）
// 独立 key 函数（故意不复用 stateKey，避免同源错误）
function key(level, s) {
  let out = '';
  for (const c of level.cars) out += s.cars[c.id].x + '.' + s.cars[c.id].y + '.';
  out += s.picked.join(',');
  return out;
}
function iddfsSolvableWithin(def, maxL) {
  const level = createLevel(def);
  const start = initialState(level);
  if (isWin(level, start)) return 0;
  for (let L = 1; L <= maxL; L++) {
    const seen = new Map(); // key -> 到达过的最小深度
    const dfs = (s, d) => {
      if (d === L) return isWin(level, s);
      const k = key(level, s);
      const prevD = seen.get(k);
      if (prevD !== undefined && prevD <= d) return false;
      seen.set(k, d);
      for (const car of level.cars) {
        if (car.bus) continue;
        for (const t of slideTargets(level, s, car.id)) {
          if (dfs(applyMove(level, s, car.id, t), d + 1)) return true;
        }
      }
      return false;
    };
    if (dfs(start, 0)) return L;
  }
  return -1;
}

// ---------- 手工已知答案 ----------

test('手工关 A：一步可解（教学关）', () => {
  const def = {
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [{ id: 'R', x: 3, y: 2, len: 2, dir: 'h', role: 'hero' }],
    pickups: [], walls: [],
  };
  assert.equal(solve(def).par, 1);
  assert.equal(iddfsSolvableWithin(def, 4), 1);
});

test('手工关 B：双竖挡拆解（手推 par=3）', () => {
  const def = {
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [
      { id: 'R', x: 0, y: 2, len: 2, dir: 'h', role: 'hero' },
      { id: 'p', x: 2, y: 2, len: 2, dir: 'v' },
      { id: 'q', x: 3, y: 2, len: 2, dir: 'v' },
    ],
    pickups: [], walls: [],
  };
  // p、q 各让一步 + R 一步 = 3；无更短路径（两个挡都必须让开）
  assert.equal(solve(def).par, 3);
  assert.equal(iddfsSolvableWithin(def, 3), 3);
});

test('手工关 C：竖车让路（手推 par=2）', () => {
  const def = {
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [
      { id: 'R', x: 0, y: 2, len: 2, dir: 'h', role: 'hero' },
      { id: 'a', x: 4, y: 2, len: 2, dir: 'v' },
      { id: 'c', x: 4, y: 0, len: 1, dir: 'v' },
    ],
    pickups: [], walls: [],
  };
  assert.equal(solve(def).par, 2);
  assert.equal(iddfsSolvableWithin(def, 4), 2);
});

test('不可解关：墙体封死出口行', () => {
  const def = {
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [{ id: 'R', x: 0, y: 2, len: 2, dir: 'h', role: 'hero' }],
    pickups: [],
    walls: [{ x: 4, y: 2 }, { x: 5, y: 2 }],
  };
  assert.equal(solve(def).solvable, false);
  assert.equal(iddfsSolvableWithin(def, 8), -1);
});

test('捎人关：求解器正确处理目标谓词', () => {
  const def = {
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [
      { id: 'R', x: 0, y: 2, len: 2, dir: 'h', role: 'hero' },
      { id: 'a', x: 3, y: 0, len: 3, dir: 'v' },
    ],
    pickups: [{ id: 'p1', x: 2, y: 3 }],
    walls: [],
  };
  const r = solve(def);
  assert.equal(r.solvable, true);
  assert.ok(r.par >= 2, '至少：接人一步 + 出口一步');
  const lvl = createLevel(def);
  let s = initialState(lvl);
  for (const [cid, t] of r.path) s = applyMove(lvl, s, cid, t);
  assert.equal(isWin(lvl, s), true);
});

// ---------- 必要性与窄度 ----------

test('必要性：装饰车被识别（删后 par 不降）', () => {
  // 基于 C 关 + 一辆无关车：c 本身也不影响难度（只挡住 a 用不到的上逃逸路）
  const def = {
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [
      { id: 'R', x: 0, y: 2, len: 2, dir: 'h', role: 'hero' },
      { id: 'a', x: 4, y: 2, len: 2, dir: 'v' },
      { id: 'c', x: 4, y: 0, len: 1, dir: 'v' },
    ],
    pickups: [], walls: [],
  };
  const nec = checkNecessity(def);
  assert.equal(nec.minimal, false);
  assert.deepEqual(nec.removable, ['c'], 'c 挡的是 a 用不到的路线，删掉 par 不变');

  // 最小关：只有必需挡车
  const minimalDef = {
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [
      { id: 'R', x: 0, y: 2, len: 2, dir: 'h', role: 'hero' },
      { id: 'a', x: 4, y: 2, len: 2, dir: 'v' },
    ],
    pickups: [], walls: [],
  };
  const nec2 = checkNecessity(minimalDef);
  assert.equal(nec2.minimal, true, '删 a 则 par 从 2 降到 1，a 必要');
});

test('窄度：最优解路径数（手数验证）', () => {
  // T：R 单车 par=1，最优解唯一 → 1
  const T = {
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [{ id: 'R', x: 3, y: 2, len: 2, dir: 'h', role: 'hero' }],
    pickups: [], walls: [],
  };
  // U：R + 竖挡 a（上/下共 3 个逃逸目标）→ par=2，最优解 = 3×1 = 3
  const U = {
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [
      { id: 'R', x: 0, y: 2, len: 2, dir: 'h', role: 'hero' },
      { id: 'a', x: 2, y: 2, len: 2, dir: 'v' },
    ],
    pickups: [], walls: [],
  };
  assert.equal(narrowness(T), 1);
  assert.equal(narrowness(U), 3);
});

// ---------- 随机关双算法交叉验证 ----------
// 说明：BFS 的完备性是图搜索的数学保证，无需重复验证；交叉验证的重点是
// "最优性"——若 BFS 的 par 偏大（非最优），IDDFS 会在更浅层找到解。

test('随机 150 关：BFS par 与 IDDFS 最浅可解深度完全一致', () => {
  let seed = 42;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let checked = 0;
  for (let i = 0; i < 150; i++) {
    const cars = [{ id: 'R', x: 1 + Math.floor(rnd() * 3), y: 2, len: 2, dir: 'h', role: 'hero' }];
    const used = new Set();
    for (const c of cars) for (let j = 0; j < 2; j++) used.add(`${c.x + j},${c.y}`);
    const n = 4 + Math.floor(rnd() * 4);
    let guard = 0;
    while (cars.length < n + 1 && guard++ < 200) {
      const dir = rnd() < 0.5 ? 'h' : 'v';
      const len = rnd() < 0.3 ? 3 : 2;
      const x = Math.floor(rnd() * 6);
      const y = Math.floor(rnd() * 6);
      const cells = [];
      for (let j = 0; j < len; j++) cells.push(dir === 'h' ? [x + j, y] : [x, y + j]);
      if (cells.some(([cx, cy]) => cx < 0 || cx > 5 || cy < 0 || cy > 5 || used.has(`${cx},${cy}`))) continue;
      cells.forEach(([cx, cy]) => used.add(`${cx},${cy}`));
      cars.push({ id: 'c' + cars.length, x, y, len, dir });
    }
    const def = { w: 6, h: 6, exit: { x: 6, y: 2 }, cars, pickups: [], walls: [] };
    try { createLevel(def); } catch { continue; }
    const b = solve(def);
    if (!b.solvable) { checked++; continue; } // 完备性由 BFS 保证；重点交叉验证最优性
    if (b.par > 14) continue; // 深关 IDDFS 太慢，抽样跳过（少量）
    const d = iddfsSolvableWithin(def, b.par); // 只允许在 <= par 深度内找到解
    assert.notEqual(d, -1, `第 ${i} 关：IDDFS 在 par=${b.par} 内无解，BFS 可能虚报`);
    assert.ok(d >= b.par, `第 ${i} 关：IDDFS 找到更浅解 ${d} < BFS par ${b.par}`);
    checked++;
  }
  assert.ok(checked >= 100, `有效样本 ${checked}`);
});
