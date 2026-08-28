// move.js —— 移动规则（与求解器共用；班车同步推进在这里，单一事实源）
// "一步" = 一辆车沿其方向连续滑动任意格数（Rush Hour 惯例）

import { carCells } from './board.js';

function gridWithout(level, s, excludeId) {
  const grid = new Map();
  for (const w of level.walls) grid.set(w.x + ',' + w.y, '#');
  for (const c of level.cars) {
    if (c.id === excludeId) continue;
    const p = s.cars[c.id];
    for (const cell of carCells({ ...c, x: p.x, y: p.y })) {
      grid.set(cell.x + ',' + cell.y, c.id);
    }
  }
  return grid;
}

// 枚举某辆车当前可滑到的所有目标位置（不含原地）
export function slideTargets(level, s, carId) {
  const car = level.cars.find(c => c.id === carId);
  if (car.bus) return []; // 班车不可被玩家移动
  const pos = s.cars[carId];
  const grid = gridWithout(level, s, carId);
  const isH = car.dir === 'h';
  const axis = isH ? 'x' : 'y';
  const fixed = pos[isH ? 'y' : 'x'];
  const cur = pos[axis];
  const max = isH ? level.w : level.h;
  const targets = [];

  const cellsAt = t => {
    const cells = [];
    for (let i = 0; i < car.len; i++) {
      cells.push(isH ? { x: t + i, y: fixed } : { x: fixed, y: t + i });
    }
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

// 执行一步：carId 滑到 axis 坐标 target，然后所有班车各走一格（被挡则停）。
// 返回新状态（不修改入参）。非法移动抛 Error。
export function applyMove(level, s, carId, target) {
  const car = level.cars.find(c => c.id === carId);
  if (!car) throw new Error('no car ' + carId);
  if (car.bus) throw new Error('bus car ' + carId + ' is not movable');
  const targets = slideTargets(level, s, carId);
  if (!targets.includes(target)) throw new Error('illegal move ' + carId + '->' + target);

  const isH = car.dir === 'h';
  const next = {
    cars: { ...s.cars, [carId]: { ...s.cars[carId] } },
    picked: s.picked.slice(),
  };
  next.cars[carId][isH ? 'x' : 'y'] = target;

  // 捎人：英雄车滑完后，若车身任一格与未接乘客曼哈顿距离 1，接上它
  const hero = level.hero;
  const hp = next.cars[hero.id];
  for (const p of level.pickups) {
    if (next.picked.includes(p.id)) continue;
    if (p.order != null) {
      const pending = level.pickups
        .filter(q => !next.picked.includes(q.id))
        .sort((a, b) => a.order - b.order);
      if (pending[0].id !== p.id) continue; // 按序接送
    }
    const near = carCells({ ...hero, x: hp.x, y: hp.y }).some(
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
    const body = carCells({ ...c, x: nx, y: ny });
    const inBounds = body.every(b => b.x >= 0 && b.x < level.w && b.y >= 0 && b.y < level.h);
    const blocked = body.some(b => grid.has(b.x + ',' + b.y));
    if (inBounds && !blocked) next.cars[c.id] = { x: nx, y: ny };
  }
  return next;
}

// 玩家可操作的车辆（班车不可动）
export function movableCars(level) {
  return level.cars.filter(c => !c.bus).map(c => c.id);
}
