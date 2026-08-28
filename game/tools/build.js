// build.js —— 无依赖单文件构建：ESM 源码 → dist/index.html
// 策略：按依赖序拼接，剥掉 import/export，IIFE 包裹注入 HTML 模板。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = [
  'src/rules/board.js',
  'src/rules/move.js',
  'src/rules/goal.js',
  'src/levels.data.js',
  'src/render.js',
  'src/input.js',
  'src/main.js',
];

function stripEsm(code) {
  return code
    .replace(/^import\s+[^;]+;?\s*$/gm, '')            // 去 import
    .replace(/^export\s+(?=(const|let|var|function|class)\b)/gm, '') // 去 export 前缀
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, '');       // 去 export {...}
}

function bundle() {
  let out = '';
  for (const f of ORDER) {
    out += `\n/* ===== ${f} ===== */\n` + stripEsm(readFileSync(join(root, f), 'utf8'));
  }
  return `'use strict';\n(function(){\n${out}\n})();\n`;
}

const TEMPLATE = html => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>挪车！师傅 · Carpool Lane</title>
<style>
  :root { color-scheme: dark; }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { height: 100%; }
  body {
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #1a1d24; color: #ecf0f1;
    display: flex; flex-direction: column; align-items: center;
    height: 100dvh; overflow: hidden;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  #hud {
    width: 100%; max-width: 560px; display: none; align-items: center; gap: 10px;
    padding: 10px 14px; font-size: 14px;
  }
  #hud .grow { flex: 1; min-width: 0; }
  #level-name { font-weight: 700; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #quote { color: #95a5a6; font-size: 12px; margin-top: 2px; }
  #stats { display: flex; gap: 12px; color: #bdc3c7; font-variant-numeric: tabular-nums; }
  #pickup-hint { display: none; color: #f1c40f; font-size: 12px; margin-top: 2px; }
  #game {
    width: min(96vw, 560px, calc(100dvh - 150px));
    aspect-ratio: 1 / 1;
    border-radius: 14px; touch-action: none; cursor: pointer;
    background: #14161c;
  }
  .btn {
    background: #e74c3c; color: #fff; border: none; border-radius: 10px;
    padding: 10px 16px; font-size: 15px; font-weight: 700; cursor: pointer;
  }
  .btn.sec { background: #3d4451; }
  .overlay {
    position: fixed; inset: 0; background: rgba(10,12,16,0.82);
    display: none; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
    text-align: center; padding: 24px;
  }
  .overlay h1 { font-size: 34px; letter-spacing: 2px; }
  .overlay h2 { font-size: 22px; }
  .overlay p { color: #bdc3c7; }
  #level-list { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; max-width: 340px; }
  .level-btn {
    width: 52px; height: 52px; border-radius: 12px; border: none;
    background: #2f3640; color: #ecf0f1; font-size: 18px; font-weight: 700; cursor: pointer;
  }
  .level-btn:active { background: #e74c3c; }
  #win-stars { font-size: 44px; letter-spacing: 4px; }
  #win-text { font-size: 18px; }
  footer { color: #565f6e; font-size: 11px; padding: 6px; }
</style>
</head>
<body>
  <div id="hud">
    <div class="grow">
      <div id="level-name"></div>
      <div id="quote"></div>
      <div id="pickup-hint">💡 顺路捎上 🧍，道闸才会开</div>
    </div>
    <div id="stats">
      <span id="moves">0 步</span>
      <span id="par"></span>
    </div>
    <button class="btn sec" id="btn-restart">重开</button>
    <button class="btn sec" id="btn-back">关卡</button>
  </div>
  <canvas id="game"></canvas>
  <footer>挪车！师傅 Carpool Lane · 原型 v0.1</footer>

  <div class="overlay" id="title-screen" style="display:flex">
    <h1>🚕 挪车！师傅</h1>
    <p>Carpool Lane · 顺路捎人，腾出活路</p>
    <p style="font-size:13px;color:#95a5a6">横车横移 · 竖车竖移 · 把红车开出右出口</p>
    <div id="level-list"></div>
  </div>

  <div class="overlay" id="win-screen">
    <h2>师傅，出去了！</h2>
    <div id="win-stars"></div>
    <div id="win-text"></div>
    <button class="btn" id="btn-next">下一关</button>
    <button class="btn sec" id="btn-back2" onclick="document.getElementById('win-screen').style.display='none'">再看棋盘</button>
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
const kb = (js.length / 1024).toFixed(1);
console.log(`built dist/index.html (${(js.length / 1024).toFixed(1)} KB js, total file below)`);
