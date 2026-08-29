// board.js —— 棋盘与车辆状态（双端同源：Node 与浏览器共用，零 DOM 依赖）
// 一个"状态"= { cars: {id: {x,y}}, picked: [乘客id...] }
// 棋盘静态信息（尺寸/车辆形状/乘客/墙/出口）由 level 定义，只读。

export function createLevel(def) {
  // def: {w,h,exit:{x,y},cars:[{id,x,y,len,dir,role,bus}],pickups:[{id,x,y,order}],walls:[{x,y}]}
  const lvl = {
    w: def.w,
    h: def.h,
    exit: { x: def.exit.x, y: def.exit.y },
    cars: def.cars.map(c => ({ ...c })),
    pickups: (def.pickups || []).map(p => ({ ...p })),
    walls: (def.walls || []).map(w => ({ ...w })),
  };
  // 派生：车辆占格集合、英雄车 id、乘客需求
  lvl.occupies = carCells;
  lvl.hero = lvl.cars.find(c => c.role === 'hero');
  if (!lvl.hero) throw new Error('level needs a hero car');
  validateNoOverlap(lvl);
  return lvl;
}

export function carCells(car) {
  const cells = [];
  for (let i = 0; i < car.len; i++) {
    cells.push({
      x: car.dir === 'h' ? car.x + i : car.x,
      y: car.dir === 'v' ? car.y + i : car.y,
    });
  }
  return cells;
}

export function initialState(level) {
  const cars = {};
  for (const c of level.cars) cars[c.id] = { x: c.x, y: c.y };
  return { cars, picked: [] };
}

export function cloneState(s) {
  const cars = {};
  for (const id in s.cars) cars[id] = { ...s.cars[id] };
  return { cars, picked: s.picked.slice() };
}

// 状态键：数值打包（坐标 0-7 用 8 进制位，乘客位图 4 bit）——比字符串快一个量级
export function stateKey(level, s) {
  let key = 0;
  for (let i = 0; i < level.cars.length; i++) {
    const c = level.cars[i];
    const p = s.cars[c.id];
    key = key * 8 + (c.dir === 'h' ? p.x : p.y);
  }
  let pm = 0;
  for (let i = 0; i < level.pickups.length; i++) {
    if (s.picked.includes(level.pickups[i].id)) pm |= 1 << i;
  }
  return key * 16 + pm;
}

// 占用网格：返回 Map "x,y" -> carId（只统计车身，乘客格不占）
export function occupancyGrid(level, s) {
  const grid = new Map();
  for (const w of level.walls) grid.set(w.x + ',' + w.y, '#');
  for (const c of level.cars) {
    const p = s.cars[c.id];
    for (const cell of carCells({ ...c, x: p.x, y: p.y })) {
      grid.set(cell.x + ',' + cell.y, c.id);
    }
  }
  return grid;
}

function validateNoOverlap(lvl) {
  const seen = new Map();
  for (const w of lvl.walls) {
    const k = w.x + ',' + w.y;
    if (seen.has(k)) throw new Error('overlap at ' + k);
    seen.set(k, '#');
  }
  for (const c of lvl.cars) {
    for (const cell of carCells(c)) {
      if (cell.x < 0 || cell.x >= lvl.w || cell.y < 0 || cell.y >= lvl.h) {
        throw new Error('car ' + c.id + ' out of bounds');
      }
      const k = cell.x + ',' + cell.y;
      if (seen.has(k)) throw new Error('overlap at ' + k + ' (' + c.id + ')');
      seen.set(k, c.id);
    }
  }
  for (const p of lvl.pickups) {
    if (seen.has(p.x + ',' + p.y)) throw new Error('pickup inside car/wall');
  }
}
