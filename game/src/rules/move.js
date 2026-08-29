// move.js —— 移动规则（与求解器共用；转向/班车同步推进在这里，单一事实源）
// "一步" = 一辆车一次连续滑动（任意格数），或一次 90° 原地转向（仅 len2 且 level.turn）

import { carCells } from './board.js';

const dirOf = (level, s, id) => s.cars[id].dir || level.cars.find(c => c.id === id).dir;

function gridWithout(level, s, excludeId) {
  const grid = new Map();
  for (const w of level.walls) grid.set(w.x + ',' + w.y, '#');
  // 未接乘客是障碍物：任何车不能滑过；接走后格子开放（接人=清障）
  for (const p of level.pickups) {
    if (s.picked.includes(p.id)) continue;
    grid.set(p.x + ',' + p.y, 'P');
  }
  for (const c of level.cars) {
    if (c.id === excludeId) continue;
    const p = s.cars[c.id];
    for (const cell of carCells({ ...c, dir: p.dir || c.dir, x: p.x, y: p.y })) {
      grid.set(cell.x + ',' + cell.y, c.id);
    }
  }
  return grid;
}

// 枚举某辆车当前可滑到的所有目标位置（不含原地），返回数值数组
export function slideTargets(level, s, carId) {
  const car = level.cars.find(c => c.id === carId);
  if (car.bus) return [];
  const pos = s.cars[carId];
  const dir = pos.dir || car.dir;
  const grid = gridWithout(level, s, carId);
  const isH = dir === 'h';
  const fixed = pos[isH ? 'y' : 'x'];
  const cur = pos[isH ? 'x' : 'y'];
  const max = isH ? level.w : level.h;
  const targets = [];
  const cellsAt = t => {
    const cells = [];
    for (let i = 0; i < car.len; i++) cells.push(isH ? { x: t + i, y: fixed } : { x: fixed, y: t + i });
    return cells;
  };
  for (let t = cur - 1; t >= 0; t--) {
    if (cellsAt(t).some(c => grid.has(c.x + ',' + c.y))) break;
    targets.push(t);
  }
  for (let t = cur + 1; t + car.len - 1 < max; t++) {
    if (cellsAt(t).some(c => grid.has(c.x + ',' + c.y))) break;
    targets.push(t);
  }
  return targets;
}

// 转向结果：code='r<pivot0|1><+|->'。返回 {x,y,dir} 或 null
// 横车 '+'=绕枢向下摆 / '-'=向上摆；竖车 '+'=向右 / '-'=向左
export function rotResult(level, s, carId, code) {
  const car = level.cars.find(c => c.id === carId);
  if (!level.turn || car.len !== 2 || car.bus) return null;
  const pos = s.cars[carId];
  const dir = pos.dir || car.dir;
  const pivot = code[1] === '1' ? 1 : 0;
  const sign = code[2] === '+' ? 1 : -1;
  const cells = carCells({ ...car, dir, x: pos.x, y: pos.y });
  const P = cells[pivot];
  const swing = dir === 'h' ? { x: P.x, y: P.y + sign } : { x: P.x + sign, y: P.y };
  if (swing.x < 0 || swing.x >= level.w || swing.y < 0 || swing.y >= level.h) return null;
  const grid = gridWithout(level, s, carId);
  if (grid.has(swing.x + ',' + swing.y)) return null;
  const ndir = dir === 'h' ? 'v' : 'h';
  if (ndir === 'v') return { x: P.x, y: Math.min(P.y, swing.y), dir: 'v' };
  return { x: Math.min(P.x, swing.x), y: P.y, dir: 'h' };
}

export function rotTargets(level, s, carId) {
  const car = level.cars.find(c => c.id === carId);
  // 只有师傅的车（英雄）能原地掉头：违停死车只会滑。控制求解分支。
  if (!level.turn || car.role !== 'hero' || car.len !== 2 || car.bus) return [];
  const out = [];
  for (const code of ['r0+', 'r0-', 'r1+', 'r1-']) if (rotResult(level, s, carId, code)) out.push(code);
  return out;
}

// 执行一步：target 为数值=滑动，为 'r..' 字符串=转向。返回新状态（不修改入参）。
export function applyMove(level, s, carId, target) {
  const car = level.cars.find(c => c.id === carId);
  if (!car) throw new Error('no car ' + carId);
  if (car.bus) throw new Error('bus car ' + carId + ' is not movable');

  const next = {
    cars: { ...s.cars, [carId]: { ...s.cars[carId] } },
    picked: s.picked.slice(),
  };

  if (typeof target === 'string') {
    const rr = rotResult(level, s, carId, target);
    if (!rr) throw new Error('illegal rot ' + carId + target);
    next.cars[carId] = { x: rr.x, y: rr.y, dir: rr.dir };
  } else {
    const targets = slideTargets(level, s, carId);
    if (!targets.includes(target)) throw new Error('illegal move ' + carId + '->' + target);
    const isH = dirOf(level, s, carId) === 'h';
    next.cars[carId][isH ? 'x' : 'y'] = target;
  }

  // 捎人：英雄车动作后，若车身任一格与未接乘客曼哈顿距离 1，接上它
  const hero = level.hero;
  const hp = next.cars[hero.id];
  const hdir = next.cars[hero.id].dir || hero.dir;
  for (const p of level.pickups) {
    if (next.picked.includes(p.id)) continue;
    if (p.order != null) {
      const pending = level.pickups
        .filter(q => !next.picked.includes(q.id))
        .sort((a, b) => a.order - b.order);
      if (pending[0].id !== p.id) continue;
    }
    const near = carCells({ ...hero, dir: hdir, x: hp.x, y: hp.y }).some(
      c => Math.abs(c.x - p.x) + Math.abs(c.y - p.y) === 1
    );
    if (near) next.picked.push(p.id);
  }

  // 班车推进：每步一格，方向 bus.dx/dy；越界或被挡则停
  for (const c of level.cars) {
    if (!c.bus) continue;
    const bp = next.cars[c.id];
    const nx = bp.x + (c.bus.dx || 0);
    const ny = bp.y + (c.bus.dy || 0);
    const grid = gridWithout(level, next, c.id);
    const body = carCells({ ...c, dir: bp.dir || c.dir, x: nx, y: ny });
    const inBounds = body.every(b => b.x >= 0 && b.x < level.w && b.y >= 0 && b.y < level.h);
    const blocked = body.some(b => grid.has(b.x + ',' + b.y));
    if (inBounds && !blocked) next.cars[c.id] = { x: nx, y: ny, dir: bp.dir || c.dir };
  }
  return next;
}

// 玩家可操作的车辆（班车不可动）
export function movableCars(level) {
  return level.cars.filter(c => !c.bus).map(c => c.id);
}
