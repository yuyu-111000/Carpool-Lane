// main.js —— 场景状态机 + 游戏循环（v0.2：说明系统 + 星级存档 + 道路选关）

import { createLevel, initialState, cloneState } from './rules/board.js';
import { slideTargets, applyMove, rotTargets } from './rules/move.js';
import { gateOpen, isWin } from './rules/goal.js';
import { LEVELS, DAILY } from './levels.data.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { hintFor } from './hint.js';
import { sfx, unlockAudio } from './fx.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const ui = {
  title: document.getElementById('title-screen'),
  help: document.getElementById('help-screen'),
  hud: document.getElementById('hud'),
  levelList: document.getElementById('level-list'),
  levelName: document.getElementById('level-name'),
  bossChip: document.getElementById('boss-chip'),
  quote: document.getElementById('quote'),
  moves: document.getElementById('moves'),
  par: document.getElementById('par'),
  pickupHint: document.getElementById('pickup-hint'),
  hint: document.getElementById('hint'),
  restart: document.getElementById('btn-restart'),
  back: document.getElementById('btn-back'),
  start: document.getElementById('btn-start'),
  daily: document.getElementById('btn-daily'),
  streak: document.getElementById('streak'),
  helpBtn: document.getElementById('btn-help'),
  hintBtn: document.getElementById('btn-hint'),
  helpClose: document.getElementById('btn-help-close'),
  win: document.getElementById('win-screen'),
  winStars: document.getElementById('win-stars'),
  winStats: document.getElementById('win-stats'),
  winText: document.getElementById('win-text'),
  next: document.getElementById('btn-next'),
  back2: document.getElementById('btn-back2'),
};

let game = null;
let screen = 'title';
let lastT = 0;

// ---------- 星级/连胜存档 ----------
const store = {
  all() {
    try { return JSON.parse(localStorage.getItem('cl_stars') || '{}'); } catch { return {}; }
  },
  set(id, s) {
    const m = this.all();
    m[id] = Math.max(m[id] || 0, s);
    try { localStorage.setItem('cl_stars', JSON.stringify(m)); } catch {}
  },
  meta() {
    try { return JSON.parse(localStorage.getItem('cl_meta') || '{"streak":0}'); } catch { return { streak: 0 }; }
  },
  bumpStreak() {
    const m = this.meta();
    m.streak = (m.streak || 0) + 1;
    try { localStorage.setItem('cl_meta', JSON.stringify(m)); } catch {}
    return m.streak;
  },
};

function setHint(t) {
  ui.hint.textContent = t || '';
  ui.hint.style.display = t ? 'block' : 'none';
}

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
    hintCar: null,
    hintUntil: 0,
    hintsLeft: 3,
  };
  screen = 'level';
  ui.title.style.display = 'none';
  ui.help.style.display = 'none';
  ui.win.style.display = 'none';
  ui.hud.style.display = 'grid';
  ui.levelName.textContent = `第 ${def.id} 关 · ${def.name}`;
  ui.bossChip.style.display = def.name.includes('大关') ? 'inline-block' : 'none';
  ui.quote.textContent = `“${def.quote || ''}”`;
  ui.par.textContent = String(def.par);
  ui.pickupHint.style.display = def.pickups.length ? 'block' : 'none';
  // 情境提示：首关教拖动；捎人关教接人
  if (def.pickups.length) setHint('先开到乘客旁接人，道闸才会抬起');
  else if (def.id === 1 && !(store.all()[1])) setHint('按住红车，向右拖动');
  else setHint(null);
  renderer.resize(level, window.devicePixelRatio || 1);
  updateHud();
}

function updateHud() {
  ui.moves.textContent = String(game.moves);
  if (ui.hintBtn) ui.hintBtn.textContent = `提示${game.hintsLeft > 0 ? '·' + game.hintsLeft : ''}`;
}

function tryMove(carId, target) {
  const g = game;
  if (g.won) return;
  const legal = [...slideTargets(g.level, g.state, carId), ...rotTargets(g.level, g.state, carId)];
  if (!legal.includes(target)) return;
  const before = cloneState(g.state);
  const gateBefore = gateOpen(g.level, g.state);
  const ns = applyMove(g.level, g.state, carId, target);
  g.state = ns;
  g.moves++;
  if (typeof target === 'string') sfx.turn(); else sfx.move();
  g.anims[carId] = { from: { x: before.cars[carId].x, y: before.cars[carId].y }, t0: performance.now(), dur: 130 };
  for (const c of g.level.cars) {
    if (c.bus && (before.cars[c.id].x !== ns.cars[c.id].x || before.cars[c.id].y !== ns.cars[c.id].y)) {
      g.anims[c.id] = { from: { x: before.cars[c.id].x, y: before.cars[c.id].y }, t0: performance.now(), dur: 200 };
    }
  }
  let pickedNow = false;
  for (const p of g.level.pickups) {
    if (ns.picked.includes(p.id) && !before.picked.includes(p.id)) {
      renderer.burst(g.level, p.x, p.y, '#2ecc71');
      pickedNow = true;
    }
  }
  if (pickedNow) sfx.pickup();
  if (!gateBefore && gateOpen(g.level, g.state)) sfx.gate();
  // 提示消除：首关首次移动后 / 接到第一个乘客后
  if (g.def.id === 1) setHint(null);
  if (pickedNow) setHint('道闸开了！开出右出口');
  updateHud();
  if (isWin(g.level, g.state)) onWin();
}

function onWin() {
  const g = game;
  g.won = true;
  setHint(null);
  sfx.win();
  const streak = store.bumpStreak();
  // 冲出动画：英雄车滑出右出口
  const hero = g.level.hero;
  const from = { ...g.state.cars[hero.id] };
  g.state.cars[hero.id] = { x: g.level.w, y: from.y };
  g.anims[hero.id] = { from, t0: performance.now(), dur: 420 };
  const gate = { x: Math.max(0, Math.min(g.level.exit.x, g.level.w - 1)), y: g.level.exit.y };
  renderer.burst(g.level, gate.x, gate.y, '#ffd640');
  const stars = g.moves <= g.def.par ? 3 : g.moves <= g.def.par + 2 ? 2 : 1;
  store.set(g.def.id, stars);
  setTimeout(() => {
    ui.win.style.display = 'flex';
    ui.winStars.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    ui.winStats.innerHTML = `本局 <b>${g.moves}</b> 步 · 3★ 标杆 <b>${g.def.par}</b> 步 · 连胜 <b>${streak}</b>`;
    ui.winText.textContent = stars === 3 ? '师傅，稳！' : stars === 2 ? '还行，再抠两步？' : '能出去就行（笑）';
    const hasNext = LEVELS.find(l => l.id === g.def.id + 1);
    ui.next.style.display = hasNext ? 'inline-block' : 'none';
  }, 500);
}

// ---------- 输入回调 ----------
const input = new Input(canvas, {
  hitTest(cx, cy) {
    if (!game || game.won) return null;
    const car = hitCar(cx, cy);
    if (!car || car.bus) return null;
    return { carId: car.id, targets: slideTargets(game.level, game.state, car.id) };
  },
  onSelect(carId) { if (game) game.selectedId = carId; },
  onDragPreview(carId, target) { if (game) game.dragPreview = target === null ? null : { carId, target }; },
  projectDrag(carId, cx, cy, targets) {
    if (!game) return null;
    const car = game.level.cars.find(c => c.id === carId);
    const st = game.state.cars[carId];
    const dir = st.dir || car.dir;
    const isH = dir === 'h';
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + renderer.ox + (st.x + (isH ? car.len : 1) / 2) * renderer.cell;
    const centerY = rect.top + renderer.oy + (st.y + (isH ? 1 : car.len) / 2) * renderer.cell;
    const dx = cx - centerX, dy = cy - centerY;
    const axis = isH ? dx : dy;
    const perp = isH ? dy : dx;
    // 垂直于车身方向拖动 => 原地转向（len2 且本关开启转向）
    if (game.level.turn && car.len === 2 && Math.abs(perp) > Math.abs(axis) && Math.abs(perp) > renderer.cell * 0.4) {
      const sign = perp > 0 ? '+' : '-';
      const rots = rotTargets(game.level, game.state, carId);
      for (const piv of ['0', '1']) if (rots.includes('r' + piv + sign)) return 'r' + piv + sign;
      return null;
    }
    if (!targets.length) return null;
    const delta = Math.round(axis / renderer.cell);
    const cur = st[isH ? 'x' : 'y'];
    let best = null, bd = Infinity;
    for (const t of targets) { const d2 = Math.abs(t - (cur + delta)); if (d2 < bd) { bd = d2; best = t; } }
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
    const isH = (game.state.cars[carId].dir || car.dir) === 'h';
    const cur = game.state.cars[carId][isH ? 'x' : 'y'];
    const t = isH
      ? (cell.x > cur ? cell.x - car.len + 1 : cell.x)
      : (cell.y > cur ? cell.y - car.len + 1 : cell.y);
    tryMove(carId, t);
  },
  cellAt(cx, cy) { return renderer.posToCell(game.level, cx, cy); },
});

function hitCar(cx, cy) {
  const g = game;
  const cellPos = renderer.posToCell(g.level, cx, cy);
  if (!cellPos.inside) return null;
  const grid = new Map();
  for (const c of g.level.cars) {
    const p = g.state.cars[c.id];
    const dir = p.dir || c.dir;
    for (let i = 0; i < c.len; i++) {
      const x = dir === 'h' ? p.x + i : p.x;
      const y = dir === 'v' ? p.y + i : p.y;
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
ui.back2.addEventListener('click', () => { ui.win.style.display = 'none'; });
ui.helpBtn.addEventListener('click', () => { ui.help.style.display = 'flex'; });
ui.helpClose.addEventListener('click', () => { ui.help.style.display = 'none'; });
ui.hintBtn.addEventListener('click', () => {
  if (!game || game.won || game.hintsLeft <= 0) return;
  const mv = hintFor(game.level, game.state);
  if (!mv) return;
  game.hintsLeft--;
  game.hintCar = mv[0];
  game.hintUntil = performance.now() + 2500;
  sfx.hint();
  updateHud();
});
ui.daily.addEventListener('click', () => {
  const day = Math.floor(Date.now() / 86400000);
  const def = DAILY[day % DAILY.length];
  startLevel(def);
});
ui.start.addEventListener('click', () => {
  const stars = store.all();
  const first = LEVELS.find(l => !stars[l.id]) || LEVELS[0];
  startLevel(first);
});
canvas.addEventListener('pointerdown', unlockAudio, { once: false });

function showTitle() {
  ui.title.style.display = 'flex';
  ui.hud.style.display = 'none';
  ui.win.style.display = 'none';
  ui.help.style.display = 'none';
  setHint(null);
  const stars = store.all();
  const streak = store.meta().streak || 0;
  if (ui.streak) ui.streak.textContent = streak > 0 ? `当前连胜 ${streak}` : '从零开始，跑起第一单';
  ui.levelList.innerHTML = '';
  for (const def of LEVELS) {
    const st = stars[def.id] || 0;
    const btn = document.createElement('button');
    btn.className = 'level-btn' + (def.name.includes('大关') ? ' boss' : '');
    btn.innerHTML =
      `<span class="no"><b>${String(def.id).padStart(2, '0')}</b></span>` +
      `<span class="node"></span>` +
      `<span class="nm">${def.name}<br><span class="stars">${st ? '★'.repeat(st) + '☆'.repeat(3 - st) : '　'}</span></span>`;
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
      hintCar: game.hintUntil > t ? game.hintCar : null,
      anims: game.anims,
      now: t,
    };
    renderer.draw(game.level, game.state, view, dt);
    if (game.dragPreview && typeof game.dragPreview.target === 'number') {
      const ctx = renderer.ctx;
      const car = game.level.cars.find(c => c.id === game.dragPreview.carId);
      const isH = car.dir === 'h';
      const px = renderer.ox + (isH ? game.dragPreview.target : game.state.cars[car.id].x) * renderer.cell;
      const py = renderer.oy + (isH ? game.state.cars[car.id].y : game.dragPreview.target) * renderer.cell;
      ctx.strokeStyle = 'rgba(255,184,0,0.6)';
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

// ?level=N 直达某关（试玩/测试用）
const ql = new URLSearchParams(location.search).get('level');
if (ql) {
  const def = LEVELS.find(l => l.id === Number(ql)) || DAILY.find(l => l.id === Number(ql));
  if (def) startLevel(def);
}

// 调试钩子（仅 ?debug=1 时暴露）：自动化测试用
if (location.search.includes('debug=1')) {
  window.__CL = {
    levels: LEVELS,
    start: def => startLevel(def),
    get game() { return game; },
    move: (carId, target) => tryMove(carId, target),
  };
}
