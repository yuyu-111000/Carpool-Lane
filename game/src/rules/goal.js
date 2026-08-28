// goal.js —— 目标谓词（游戏端与求解器共用）
// 出口 exit 定义在棋盘边界外一格（如右出口 x=w）。"道闸格" = 出口相邻的棋盘内格。
// 无乘客：英雄车身占据道闸格即胜（道闸抬起，下一步滑出棋盘是纯演出）。
// 有乘客：接齐乘客道闸才开。

import { carCells } from './board.js';

export function gateCell(level) {
  const gx = Math.max(0, Math.min(level.exit.x, level.w - 1));
  const gy = Math.max(0, Math.min(level.exit.y, level.h - 1));
  return { x: gx, y: gy };
}

export function gateOpen(level, s) {
  return level.pickups.every(p => s.picked.includes(p.id));
}

export function isWin(level, s) {
  if (!gateOpen(level, s)) return false;
  const hero = level.hero;
  const hp = s.cars[hero.id];
  const g = gateCell(level);
  return carCells({ ...hero, x: hp.x, y: hp.y }).some(c => c.x === g.x && c.y === g.y);
}
