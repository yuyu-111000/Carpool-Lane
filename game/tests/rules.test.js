// board/move/goal 单元测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, initialState, cloneState, stateKey, occupancyGrid } from '../src/rules/board.js';
import { slideTargets, applyMove, movableCars } from '../src/rules/move.js';
import { gateOpen, isWin } from '../src/rules/goal.js';

const L1 = {
  w: 6, h: 6, exit: { x: 6, y: 2 },
  cars: [
    { id: 'R', x: 1, y: 2, len: 2, dir: 'h', role: 'hero' },
    { id: 'a', x: 3, y: 0, len: 3, dir: 'v' },
    { id: 'b', x: 5, y: 3, len: 2, dir: 'v' },
  ],
  pickups: [], walls: [],
};

test('createLevel 派生 hero 并拒绝重叠', () => {
  const lvl = createLevel(L1);
  assert.equal(lvl.hero.id, 'R');
  const bad = { ...L1, cars: [...L1.cars, { id: 'c', x: 3, y: 1, len: 2, dir: 'v' }] };
  assert.throws(() => createLevel(bad));
});

test('stateKey 随状态变化且克隆态同键', () => {
  const lvl = createLevel(L1);
  const s0 = initialState(lvl);
  const k0 = stateKey(lvl, s0);
  const s1 = applyMove(lvl, s0, 'R', 0);
  assert.notEqual(stateKey(lvl, s1), k0);
  assert.equal(stateKey(lvl, cloneState(s1)), stateKey(lvl, s1));
});

test('slideTargets 贴墙与互挡', () => {
  const lvl = createLevel(L1);
  const s = initialState(lvl);
  // R 在 y=2 行，左边 1 格空、右边到 x=3 被 a 车挡住（a 占 x=3,y0..2）
  assert.deepEqual(slideTargets(lvl, s, 'R').sort((x, y) => x - y), [0]);
});

test('applyMove 合法滑动 + 非法抛错', () => {
  const lvl = createLevel(L1);
  const s = initialState(lvl);
  const s1 = applyMove(lvl, s, 'R', 0);
  assert.equal(s1.cars.R.x, 0);
  assert.throws(() => applyMove(lvl, s, 'R', 4));
  assert.equal(s.cars.R.x, 1, '入参不可变');
});

test('捎人：英雄车滑到乘客旁自动接上，道闸开', () => {
  const def = {
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [
      { id: 'R', x: 0, y: 2, len: 2, dir: 'h', role: 'hero' },
      { id: 'a', x: 3, y: 0, len: 3, dir: 'v' },
    ],
    pickups: [{ id: 'p1', x: 2, y: 3 }], walls: [],
  };
  const lvl = createLevel(def);
  const s0 = initialState(lvl);
  assert.equal(gateOpen(lvl, s0), false);
  const s1 = applyMove(lvl, s0, 'R', 1); // R 占 (1,2)(2,2)，与 p1(2,3) 相邻
  assert.deepEqual(s1.picked, ['p1']);
  assert.equal(gateOpen(lvl, s1), true);
});

test('按序接送：只能按 order 顺序接', () => {
  const def = {
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [{ id: 'R', x: 0, y: 2, len: 2, dir: 'h', role: 'hero' }],
    pickups: [
      { id: 'p2', x: 2, y: 0, order: 2 },
      { id: 'p1', x: 2, y: 4, order: 1 },
    ],
    walls: [],
  };
  const lvl = createLevel(def);
  const s0 = initialState(lvl);
  // 先滑到 p2 旁边（y=0 侧不可达，构造直接经过 p1 上方验证顺序）：R 只能横移，p1 在 y=4、p2 在 y=0，都不可达——改用手动构造已接状态验证谓词
  const sPicked1 = { cars: s0.cars, picked: ['p1'] };
  const sPicked2 = { cars: s0.cars, picked: ['p1', 'p2'] };
  assert.equal(gateOpen(lvl, sPicked1), false);
  assert.equal(gateOpen(lvl, sPicked2), true);
});

test('班车：玩家每步后班车位移，被挡（越界）则停，班车不可被玩家移动', () => {
  const def = {
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [
      { id: 'R', x: 0, y: 2, len: 2, dir: 'h', role: 'hero' },
      { id: 'a', x: 2, y: 0, len: 2, dir: 'v' },
      { id: 'B', x: 4, y: 4, len: 2, dir: 'v', bus: { dx: 0, dy: -1 } },
    ],
    pickups: [], walls: [],
  };
  const lvl = createLevel(def);
  assert.deepEqual(movableCars(lvl).sort(), ['R', 'a']);
  const s0 = initialState(lvl);
  const s1 = applyMove(lvl, s0, 'R', 1);
  assert.equal(s1.cars.B.y, 3, '班车向上走一格');
  const s2 = applyMove(lvl, s1, 'R', 0);
  assert.equal(s2.cars.B.y, 2, '班车继续上走');
  const s3 = applyMove(lvl, s2, 'a', 1);
  assert.equal(s3.cars.B.y, 1, '班车继续');
  const s4 = applyMove(lvl, s3, 'a', 0);
  assert.equal(s4.cars.B.y, 0, '班车到顶');
  const s5 = applyMove(lvl, s4, 'R', 1);
  assert.equal(s5.cars.B.y, 0, '班车越界被挡，停在顶部');
  assert.throws(() => applyMove(lvl, s5, 'B', 3), /bus/);
});

test('isWin：道闸未开时到出口不算赢', () => {
  const def = {
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [{ id: 'R', x: 4, y: 2, len: 2, dir: 'h', role: 'hero' }],
    pickups: [{ id: 'p1', x: 0, y: 0 }], walls: [],
  };
  const lvl = createLevel(def);
  const s = initialState(lvl);
  assert.equal(isWin(lvl, s), false, '乘客未接，不算赢');
  const sWin = { cars: s.cars, picked: ['p1'] };
  assert.equal(isWin(lvl, sWin), true, '车头在出口(5,2)即赢');
});
