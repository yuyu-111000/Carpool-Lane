// hint.js —— 内置 AI 提示：与管线同源的求解器，给出当前局面最优解的第一步
import { solve } from '../tools/solver.js';

export function hintFor(level, state) {
  const r = solve(level, { from: state });
  return r.solvable && r.path && r.path.length ? r.path[0] : null;
}
