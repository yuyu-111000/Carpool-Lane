// main.js —— 场景状态机 + 游戏循环（原型版）

import { createLevel, initialState, cloneState } from './rules/board.js';
import { slideTargets, applyMove } from './rules/move.js';
import { gateOpen, isWin } from './rules/goal.js';
import { LEVELS } from './levels.data.js';
import { Renderer } from './render.js';
import { Input } from './input.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const ui = {
  title: document.getElementById('title-screen'),
  hud: document.getElementById('hud'),
  levelList: document.getElementById('level-list'),
  levelName: document.getElementById('level-name'),
  quote: document.getElementById('quote'),
  moves: document.getElementById('moves'),
  par: document.getElementById('par'),
  pickupHint: document.getElementById('pickup-hint'),
  restart: document.getElementById('btn-restart'),
  back: document.getElementById('btn-back'),
  win: document.getElementById('win-screen'),
  winStars: document.getElementById('win-stars'),
  winText: document.getElementById('win-text'),
  next: document.getElementById('btn-next'),
};

let game = null; // { level, state, moves, selectedId, anims, now, won }
let screen = 'title';
let lastT = 0;

function startLevel(def) {
  const level = createLevel(def);
  game = {
    def, level,
    state: initialState(level),
    moves: 0,
    selectedId: null,
    anims: {},
    now: performance.now(),
    won: false,
    dragPreview: null,
  };
  screen = 'level';
  ui.title.style.display = 'none';
  ui.win.style.display = 'none';
  ui.hud.style.display = 'flex';
  ui.levelName.textContent = `第 ${def.id} 关 · ${def.name}`;
  ui.quote.textContent = `“${def.quote || ''}”`;
  ui.par.textContent = `标杆 ${def.par} 步`;
  ui.pickupHint.style.display = def.pickups.length ? 'block' : 'none';
  renderer.resize(level, window.devicePixelRatio || 1);
  updateHud();
}

function updateHud() {
  ui.moves.textContent = `${game.moves} 步`;
}

function tryMove(carId, target) {
  const g = game;
  if (g.won) return;
  const targets = slideTargets(g.level, g.state, carId);
  if (!targets.includes(target)) return;
  const before = cloneState(g.state);
  const ns = applyMove(g.level, g.state, carId, target);
  const changed = JSON.stringify(ns.cars) !== JSON.stringify(g.state.cars) || ns.picked.length !== g.state.picked.length;
  g.state = ns;
  g.moves++;
  g.anims[carId] = { from: { x: before.cars[carId].x, y: before.cars[carId].y }, t0: performance.now(), dur: 130 };
  // 班车动画
  for (const c of g.level.cars) {
    if (c.bus && (before.cars[c.id].x !== ns.cars[c.id].x || before.cars[c.id].y !== ns.cars[c.id].y)) {
      g.anims[c.id] = { from: { x: before.cars[c.id].x, y: before.cars[c.id].y }, t0: performance.now(), dur: 200 };
    }
  }
  // 接人特效
  for (const p of g.level.pickups) {
    if (ns.picked.includes(p.id) && !before.picked.includes(p.id)) {
      renderer.burst(g.level, p.x, p.y, '#2ecc71');
    }
  }
  updateHud();
  if (isWin(g.level, g.state)) onWin();
}

function onWin() {
  const g = game;
  g.won = true;
  const gate = { x: Math.max(0, Math.min(g.level.exit.x, g.level.w - 1)), y: g.level.exit.y };
  renderer.burst(g.level, gate.x, gate.y, '#ffd640');
  const stars = g.moves <= g.def.par ? 3 : g.moves <= g.def.par + 2 ? 2 : 1;
  setTimeout(() => {
    ui.win.style.display = 'flex';
    ui.winStars.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    ui.winText.textContent =
      stars === 3 ? '师傅，稳！' :
      stars === 2 ? 'technique 还行，再抠两步？' : '能出去就行（笑）';
    const hasNext = LEVELS.find(l => l.id === g.def.id + 1);
    ui.next.style.display = hasNext ? 'block' : 'none';
  }, 350);
}

// ---------- 输入回调 ----------
const input = new Input(canvas, {
  hitTest(cx, cy) {
    if (!game || game.won) return null;
    const car = hitCar(cx, cy);
    if (!car || car.bus) return null;
    return { carId: car.id, targets: slideTargets(game.level, game.state, car.id) };
  },
  onSelect(carId) {
    if (game) { game.selectedId = carId; }
  },
  onDragPreview(carId, target) {
    if (game) game.dragPreview = target === null ? null : { carId, target };
  },
  projectDrag(carId, cx, cy, targets) {
    if (!targets.length || !game) return null;
    const car = game.level.cars.find(c => c.id === carId);
    const rect = canvas.getBoundingClientRect();
    const isH = car.dir === 'h';
    // 拖动像素差换算为格数
    const d = isH ? cx - (rect.left + renderer.ox + (game.state.cars[carId].x + car.len / 2) * renderer.cell)
                  : cy - (rect.top + renderer.oy + (game.state.cars[carId].y + car.len / 2) * renderer.cell);
    const delta = Math.round(d / renderer.cell);
    const cur = game.state.cars[carId][isH ? 'x' : 'y'];
    let best = null;
    let bestDist = Infinity;
    for (const t of targets) {
      const dist = Math.abs(t - (cur + delta));
      if (dist < bestDist) { bestDist = dist; best = t; }
    }
    if (best === cur) return null;
    return best;
  },
  onMove(carId, target) {
    tryMove(carId, target);
    if (game) game.dragPreview = null;
  },
  onTapCell(carId, cell) {
    if (!game) return;
    const car = game.level.cars.find(c => c.id === carId);
    const isH = car.dir === 'h';
    const cur = game.state.cars[carId][isH ? 'x' : 'y'];
    const target = isH ? cell.x - (car.len > 1 && cell.x > cur ? 0 : 1) : cell.y - (car.len > 1 && cell.y > cur ? 0 : 1);
    // 点击目标格：取车头对齐
    const t = isH
      ? (cell.x > cur ? cell.x - car.len + 1 : cell.x)
      : (cell.y > cur ? cell.y - car.len + 1 : cell.y);
    tryMove(carId, t);
  },
  cellAt(cx, cy) {
    return renderer.posToCell(game.level, cx, cy);
  },
});

function hitCar(cx, cy) {
  const g = game;
  const cellPos = renderer.posToCell(g.level, cx, cy);
  if (!cellPos.inside) return null;
  const grid = new Map();
  for (const c of g.level.cars) {
    const p = g.state.cars[c.id];
    for (let i = 0; i < c.len; i++) {
      const x = c.dir === 'h' ? p.x + i : p.x;
      const y = c.dir === 'v' ? p.y + i : p.y;
      grid.set(x + ',' + y, c);
    }
  }
  return grid.get(cellPos.x + ',' + cellPos.y) || null;
}

// ---------- UI 绑定 ----------
ui.restart.addEventListener('click', () => game && startLevel(game.def));
ui.back.addEventListener('click', () => { screen = 'title'; showTitle(); });
ui.next.addEventListener('click', () => {
  const nxt = LEVELS.find(l => l.id === game.def.id + 1);
  if (nxt) startLevel(nxt);
});

function showTitle() {
  ui.title.style.display = 'flex';
  ui.hud.style.display = 'none';
  ui.win.style.display = 'none';
  ui.levelList.innerHTML = '';
  for (const def of LEVELS) {
    const btn = document.createElement('button');
    btn.className = 'level-btn';
    btn.textContent = `${def.id}`;
    btn.title = def.name;
    btn.addEventListener('click', () => startLevel(def));
    ui.levelList.appendChild(btn);
  }
}

window.addEventListener('resize', () => {
  if (game) renderer.resize(game.level, window.devicePixelRatio || 1);
});

// ---------- 主循环 ----------
function frame(t) {
  const dt = Math.min(50, t - lastT || 16);
  lastT = t;
  if (game && screen === 'level') {
    game.now = t;
    const view = {
      gateOpen: gateOpen(game.level, game.state),
      selectedId: game.selectedId,
      anims: game.anims,
      now: t,
    };
    renderer.draw(game.level, game.state, view, dt);
    // 拖动预览：高亮目标位置
    if (game.dragPreview) {
      const ctx = renderer.ctx;
      const car = game.level.cars.find(c => c.id === game.dragPreview.carId);
      const { x, y } = { x: game.dragPreview.target, y: game.state.cars[car.id].y };
      const isH = car.dir === 'h';
      const px = renderer.ox + (isH ? x : game.state.cars[car.id].x) * renderer.cell;
      const py = renderer.oy + (isH ? game.state.cars[car.id].y : y) * renderer.cell;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(px + 3, py + 3, (isH ? car.len : 1) * renderer.cell - 6, (isH ? 1 : car.len) * renderer.cell - 6);
      ctx.setLineDash([]);
    }
  }
  requestAnimationFrame(frame);
}

showTitle();
requestAnimationFrame(frame);

// 调试钩子（仅 ?debug=1 时暴露）：自动化测试用
if (location.search.includes('debug=1')) {
  window.__CL = {
    levels: LEVELS,
    start: def => startLevel(def),
    get game() { return game; },
    move: (carId, target) => tryMove(carId, target),
    solvePath: null, // Day2 由 hint.js 注入浏览器版求解器
  };
}
