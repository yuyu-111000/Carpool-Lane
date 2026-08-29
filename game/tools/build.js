// build.js —— 无依赖单文件构建：ESM 源码 → dist/index.html
// 策略：按依赖序拼接，剥掉 import/export，IIFE 包裹注入 HTML 模板。
// 视觉方向 v0.2：Industrial 锚点（沥青暖黑 + 琥珀信号色 + 白色发丝线 + 等宽数字）
// 差异点：虚线车道线母题 + 道路式关卡选择（进度=一条夜路）

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = [
  'src/rules/board.js',
  'src/rules/move.js',
  'src/rules/goal.js',
  'tools/solver.js',
  'src/levels.data.js',
  'src/hint.js',
  'src/fx.js',
  'src/render.js',
  'src/input.js',
  'src/main.js',
];

function stripEsm(code) {
  return code
    .replace(/^import\s+[^;]+;?\s*$/gm, '')
    .replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, '')
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, '');
}

function bundle() {
  let out = '';
  for (const f of ORDER) {
    out += `\n/* ===== ${f} ===== */\n` + stripEsm(readFileSync(join(root, f), 'utf8'));
  }
  return `'use strict';\n(function(){\n${out}\n})();\n`;
}

const HOWTO = `
  <div class="howto-grid">
    <div class="howto-item">
      <svg viewBox="0 0 120 64" aria-hidden="true">
        <rect x="10" y="16" width="40" height="15" rx="3" fill="#4a90d9"/>
        <path d="M56 23.5 H74 M74 23.5 l-6 -5 M74 23.5 l-6 5 M56 23.5 l6 -5 M56 23.5 l6 5" stroke="#FFB800" stroke-width="2.5" fill="none"/>
        <rect x="88" y="8" width="15" height="40" rx="3" fill="#2ecc71"/>
        <path d="M95.5 54 V60 M95.5 60 l-5 -6 M95.5 60 l5 -6 M95.5 8 V2 M95.5 2 l-5 6 M95.5 2 l5 6" stroke="#FFB800" stroke-width="2.5" fill="none"/>
      </svg>
      <b>拖动车辆</b>
      <span>横车只能横移，竖车只能竖移</span>
    </div>
    <div class="howto-item">
      <svg viewBox="0 0 120 64" aria-hidden="true">
        <rect x="8" y="8" width="86" height="48" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/>
        <rect x="94" y="26" width="18" height="12" fill="#1d2026"/>
        <rect x="16" y="25" width="30" height="14" rx="3" fill="#e5484d"/>
        <path d="M52 32 H86 M86 32 l-7 -6 M86 32 l-7 6" stroke="#FFB800" stroke-width="2.5" fill="none"/>
        <text x="103" y="22" fill="#FFB800" font-size="10" text-anchor="middle">出口</text>
      </svg>
      <b>腾出活路</b>
      <span>把红色师傅车开出右侧出口</span>
    </div>
    <div class="howto-item">
      <svg viewBox="0 0 120 64" aria-hidden="true">
        <rect x="14" y="26" width="30" height="14" rx="3" fill="#e5484d"/>
        <circle cx="66" cy="24" r="5" fill="#FFB800"/>
        <path d="M66 29 v12 M66 33 l-6 5 M66 33 l6 5" stroke="#FFB800" stroke-width="2.5" fill="none"/>
        <path d="M46 33 h12" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-dasharray="4 3"/>
        <rect x="92" y="10" width="6" height="44" fill="#e5484d"/>
        <rect x="92" y="16" width="6" height="6" fill="#fff"/>
        <rect x="92" y="30" width="6" height="6" fill="#fff"/>
        <rect x="92" y="44" width="6" height="6" fill="#fff"/>
      </svg>
      <b>顺路捎人</b>
      <span>有乘客的关卡：先开到乘客旁接人，道闸才会抬起</span>
    </div>
  </div>`;

const TEMPLATE = html => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>挪车！师傅 · Carpool Lane</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #0B0C0A;
    --panel: #15171B;
    --board: #16181D;
    --line: rgba(255,255,255,.14);
    --amber: #FFB800;
    --red: #E5484D;
    --green: #00C853;
    --text: #F5F2EA;
    --dim: #8A8F98;
    --mono: ui-monospace, "Cascadia Mono", Consolas, "JetBrains Mono", monospace;
    --sans: -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { height: 100%; }
  body {
    font-family: var(--sans);
    background: var(--bg); color: var(--text);
    display: flex; flex-direction: column; align-items: center;
    height: 100dvh; overflow: hidden;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  .lane {
    height: 3px; width: 100%;
    background: repeating-linear-gradient(90deg, var(--amber) 0 26px, transparent 26px 42px);
    opacity: .85;
  }
  .btn {
    font-family: var(--sans); font-size: 15px; font-weight: 800; letter-spacing: 1px;
    background: transparent; color: var(--amber);
    border: 1px solid var(--amber); border-radius: 2px;
    padding: 10px 18px; cursor: pointer;
  }
  .btn:active { background: rgba(255,184,0,.15); }
  .btn.primary { background: var(--amber); color: #0B0C0A; }
  .btn.primary:active { background: #e6a600; }
  .btn.sec { color: var(--dim); border-color: var(--line); }

  /* ---------- HUD（两行网格：关卡名+按钮 / 语录+统计） ---------- */
  #hud {
    width: 100%; max-width: 600px; display: none;
    grid-template-columns: 1fr auto; grid-template-areas: "name btns" "sub stats";
    gap: 4px 10px; align-items: center;
    padding: 10px 14px; font-size: 13px;
  }
  #level-name { grid-area: name; font-weight: 800; font-size: 16px; letter-spacing: .5px; }
  .hud-btns { grid-area: btns; display: flex; gap: 8px; }
  .hud-btns .btn { padding: 7px 12px; font-size: 13px; }
  #sub { grid-area: sub; min-width: 0; }
  #quote { color: var(--dim); font-size: 12px; }
  #stats { grid-area: stats; display: flex; gap: 12px; color: var(--text); font-family: var(--mono); font-variant-numeric: tabular-nums; }
  #stats b { color: var(--amber); }
  #pickup-hint { display: none; color: var(--amber); font-size: 12px; }

  /* ---------- 棋盘 ---------- */
  #stage { position: relative; }
  #game {
    width: min(96vw, 600px, calc(100dvh - 190px));
    aspect-ratio: 1 / 1;
    border: 1px solid var(--line);
    background: var(--board);
    touch-action: none; cursor: pointer; display: block;
  }
  #hint {
    position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%);
    background: rgba(11,12,10,.92); border: 1px solid var(--amber); border-radius: 2px;
    color: var(--amber); font-size: 13px; font-weight: 700; letter-spacing: 1px;
    padding: 7px 14px; display: none; pointer-events: none; white-space: nowrap;
  }
  footer { color: #4a5058; font-size: 11px; font-family: var(--mono); padding: 6px; }

  /* ---------- 遮罩层 ---------- */
  .overlay {
    position: fixed; inset: 0; background: var(--bg);
    display: none; flex-direction: column; align-items: center;
    overflow-y: auto; padding: 28px 20px 20px; gap: 20px; text-align: center;
  }
  .overlay.dim { background: rgba(11,12,10,.9); justify-content: center; }

  /* 标题屏：路牌式刊头 */
  .sign {
    border: 2px solid var(--amber); border-radius: 4px;
    padding: 18px 34px 16px; background: var(--panel);
    box-shadow: 0 0 0 6px var(--bg), 0 0 0 7px var(--line);
  }
  .sign-top { font-family: var(--mono); color: var(--dim); font-size: 12px; letter-spacing: 4px; }
  .sign h1 { font-size: 40px; font-weight: 900; letter-spacing: 6px; margin: 6px 0 10px; }
  .sign .lane { width: 100%; }
  .sign .tag { color: var(--dim); font-size: 13px; margin-top: 10px; letter-spacing: 2px; }

  .howto { width: 100%; max-width: 560px; }
  .howto h2, .road-title {
    font-size: 14px; font-weight: 800; letter-spacing: 4px; color: var(--dim);
    text-align: left; margin-bottom: 12px;
  }
  .howto-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  @media (max-width: 520px) { .howto-grid { grid-template-columns: 1fr; } }
  .howto-item {
    border: 1px solid var(--line); background: var(--panel);
    padding: 10px 10px 12px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; text-align: left;
  }
  .howto-item svg { width: 100%; height: 64px; background: var(--board); }
  .howto-item b { font-size: 14px; letter-spacing: 1px; }
  .howto-item span { font-size: 12px; color: var(--dim); line-height: 1.5; }

  /* 道路式关卡选择 */
  .road { width: 100%; max-width: 420px; position: relative; padding: 4px 0 8px; }
  .road::before {
    content: ""; position: absolute; left: 50%; top: 0; bottom: 0; width: 3px; transform: translateX(-50%);
    background: repeating-linear-gradient(180deg, var(--amber) 0 14px, transparent 14px 26px);
    opacity: .5;
  }
  .level-btn {
    position: relative; display: flex; align-items: center; gap: 12px; width: 100%;
    background: none; border: none; color: var(--text); cursor: pointer;
    padding: 9px 0; font-family: var(--sans);
  }
  .level-btn .node {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: 16px; height: 16px; background: var(--bg); border: 2px solid var(--amber); z-index: 1;
  }
  .level-btn .no { width: 44%; text-align: right; font-family: var(--mono); font-size: 15px; }
  .level-btn .no b { font-size: 17px; }
  .level-btn .nm { width: 44%; margin-left: auto; text-align: left; font-size: 13px; color: var(--dim); }
  .level-btn .stars { font-size: 11px; color: var(--amber); letter-spacing: 1px; }
  .level-btn:active .node { background: var(--amber); }

  /* 胜利屏 */
  #win-screen h2 { font-size: 26px; font-weight: 900; letter-spacing: 3px; }
  #win-stars { font-size: 46px; letter-spacing: 6px; }
  #win-text { font-size: 15px; color: var(--dim); }
  #win-stats { font-family: var(--mono); font-size: 14px; color: var(--text); }
  #win-stats b { color: var(--amber); }
  .win-btns { display: flex; gap: 12px; }
</style>
</head>
<body>
  <div id="hud">
    <div id="level-name"></div>
    <div class="hud-btns">
      <button class="btn sec" id="btn-hint">提示·3</button>
      <button class="btn sec" id="btn-help">玩法</button>
      <button class="btn sec" id="btn-restart">重开</button>
      <button class="btn sec" id="btn-back">选关</button>
    </div>
    <div id="sub">
      <div id="quote"></div>
      <div id="pickup-hint">有乘客：先接人，道闸才开</div>
    </div>
    <div id="stats">
      <span><b id="moves">0</b> 步</span>
      <span>3★ <b id="par"></b> 步</span>
    </div>
  </div>
  <div id="stage">
    <canvas id="game"></canvas>
    <div id="hint"></div>
  </div>
  <footer>Carpool Lane · v0.2</footer>

  <div class="overlay" id="title-screen" style="display:flex">
    <div class="sign">
      <div class="sign-top">CARPOOL LANE</div>
      <h1>挪车！师傅</h1>
      <div class="lane"></div>
      <p class="tag">顺路捎人 · 腾出活路</p>
      <p class="tag" id="streak" style="color:var(--amber);margin-top:6px"></p>
    </div>
    <section class="howto">
      <h2>怎么玩</h2>
      ${HOWTO}
    </section>
    <div class="lane" style="max-width:560px"></div>
    <h2 class="road-title" style="max-width:420px;width:100%">选择关卡</h2>
    <div id="level-list" class="road"></div>
    <div style="display:flex;gap:12px">
      <button class="btn primary" id="btn-start">开始游戏</button>
      <button class="btn" id="btn-daily">每日挑战</button>
    </div>
  </div>

  <div class="overlay dim" id="help-screen">
    <section class="howto" style="max-width:560px">
      <h2>怎么玩</h2>
      ${HOWTO}
    </section>
    <button class="btn primary" id="btn-help-close">明白了</button>
  </div>

  <div class="overlay dim" id="win-screen">
    <h2>师傅，出去了！</h2>
    <div id="win-stars"></div>
    <div id="win-stats"></div>
    <div id="win-text"></div>
    <div class="win-btns">
      <button class="btn primary" id="btn-next">下一关</button>
      <button class="btn sec" id="btn-back2">再看棋盘</button>
    </div>
  </div>

<script>
${html}
</script>
</body>
</html>`;

mkdirSync(join(root, '..', 'dist'), { recursive: true });
const js = bundle();
const out = join(root, '..', 'dist', 'index.html');
writeFileSync(out, TEMPLATE(js));
console.log(`built dist/index.html (${(js.length / 1024).toFixed(1)} KB js)`);
