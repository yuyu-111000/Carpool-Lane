// levels.data.js —— 原型关卡（G1/G2 验证用；Day2 由管线产出 50 关替换）
// par 由求解器写入；narrowness = 最优解路径数（越少体感越难）

export const LEVELS = [
  {
    id: 1, chapter: 1, name: '小区窄巷 · 出车', quote: '手刹一松，就走。',
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [
      { id: 'R', x: 3, y: 2, len: 2, dir: 'h', role: 'hero' },
    ],
    pickups: [], walls: [], par: 1, narrowness: 1,
  },
  {
    id: 2, chapter: 1, name: '小区窄巷 · 一挡', quote: '这谁停的车？',
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [
      { id: 'R', x: 0, y: 2, len: 2, dir: 'h', role: 'hero' },
      { id: 'a', x: 2, y: 2, len: 2, dir: 'v' },
    ],
    pickups: [], walls: [], par: 2, narrowness: 3,
  },
  {
    id: 3, chapter: 1, name: '小区窄巷 · 三挡', quote: '技术活儿，赏口饭吃。',
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [
      { id: 'R', x: 0, y: 2, len: 2, dir: 'h', role: 'hero' },
      { id: 'p', x: 2, y: 2, len: 2, dir: 'v' },
      { id: 'q', x: 3, y: 2, len: 2, dir: 'v' },
      { id: 's', x: 4, y: 1, len: 2, dir: 'v' },
    ],
    pickups: [], walls: [], par: 4, narrowness: 8,
  },
  {
    id: 4, chapter: 2, name: '学校门口 · 接娃', quote: '娃在路边等着呢。',
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [
      { id: 'R', x: 0, y: 2, len: 2, dir: 'h', role: 'hero' },
      { id: 'a', x: 3, y: 0, len: 3, dir: 'v' },
    ],
    pickups: [{ id: 'p1', x: 2, y: 3 }],
    walls: [], par: 3, narrowness: 2,
  },
  {
    id: 5, chapter: 2, name: '学校门口 · 倒车接人', quote: '稍等，倒一下车。',
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [
      { id: 'R', x: 2, y: 2, len: 2, dir: 'h', role: 'hero' },
      { id: 'a', x: 4, y: 2, len: 2, dir: 'v' },
    ],
    pickups: [{ id: 'p1', x: 0, y: 3 }],
    walls: [], par: 3, narrowness: 2,
  },
  {
    id: 6, chapter: 2, name: '学校门口 · 挤一挤', quote: '上车都上车！',
    w: 6, h: 6, exit: { x: 6, y: 2 },
    cars: [
      { id: 'R', x: 0, y: 2, len: 2, dir: 'h', role: 'hero' },
      { id: 'p', x: 2, y: 2, len: 2, dir: 'v' },
      { id: 'q', x: 3, y: 2, len: 2, dir: 'v' },
      { id: 's', x: 4, y: 1, len: 2, dir: 'v' },
    ],
    pickups: [{ id: 'p1', x: 5, y: 3 }],
    walls: [], par: 4, narrowness: 8,
  },
];
