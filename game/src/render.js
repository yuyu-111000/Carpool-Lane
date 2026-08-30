// render.js —— Canvas 渲染（原型版：棋盘/车/乘客/道闸/粒子）

const CAR_COLORS = ['#4a90d9', '#7b68ee', '#2ecc71', '#f39c12', '#e67e22', '#1abc9c', '#9b59b6', '#34495e'];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.time = 0;
  }

  resize(level, dpr) {
    const cs = getComputedStyle(this.canvas);
    const cssW = parseFloat(cs.width) || 480;
    const cssH = parseFloat(cs.height) || 480;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssW = cssW;
    this.cssH = cssH;
    this.layout(level);
  }

  layout(level) {
    const margin = 12;
    // 出口开在右边界：右侧留出闸门视觉带
    const availW = this.cssW - margin * 2 - 18;
    const availH = this.cssH - margin * 2;
    this.cell = Math.floor(Math.min(availW / level.w, availH / level.h));
    this.ox = Math.round((this.cssW - 18 - this.cell * level.w) / 2);
    this.oy = Math.round((this.cssH - this.cell * level.h) / 2);
  }

  cellRect(level, x, y) {
    return { px: this.ox + x * this.cell, py: this.oy + y * this.cell, s: this.cell };
  }

  posToCell(level, clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left - this.ox) / this.cell);
    const y = Math.floor((clientY - rect.top - this.oy) / this.cell);
    return { x, y, inside: x >= 0 && x < level.w && y >= 0 && y < level.h };
  }

  draw(level, state, view, dt) {
    this.time += dt;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    this.layout(level);

    // 底盘：沥青纵向渐变 + 圆角
    const bw = this.cell * level.w, bh = this.cell * level.h;
    const bg = ctx.createLinearGradient(0, this.oy, 0, this.oy + bh);
    bg.addColorStop(0, '#272c37');
    bg.addColorStop(1, '#1a1e26');
    ctx.fillStyle = bg;
    roundRect(ctx, this.ox, this.oy, bw, bh, 10);
    ctx.fill();

    // 车位网格（淡）
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i < level.w; i++) {
      ctx.beginPath();
      ctx.moveTo(this.ox + i * this.cell + 0.5, this.oy + 4);
      ctx.lineTo(this.ox + i * this.cell + 0.5, this.oy + bh - 4);
      ctx.stroke();
    }
    for (let j = 1; j < level.h; j++) {
      ctx.beginPath();
      ctx.moveTo(this.ox + 4, this.oy + j * this.cell + 0.5);
      ctx.lineTo(this.ox + bw - 4, this.oy + j * this.cell + 0.5);
      ctx.stroke();
    }

    // 墙：混凝土块 + 琥珀警示斜纹
    for (const w of level.walls) {
      const { px, py, s } = this.cellRect(level, w.x, w.y);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      roundRect(ctx, px + 3, py + 4, s - 6, s - 6, 5); ctx.fill();
      const wg = ctx.createLinearGradient(px, py, px, py + s);
      wg.addColorStop(0, '#4a5262'); wg.addColorStop(1, '#343b48');
      ctx.fillStyle = wg;
      roundRect(ctx, px + 2, py + 2, s - 4, s - 4, 5); ctx.fill();
      ctx.save();
      roundRect(ctx, px + 2, py + 2, s - 4, s - 4, 5); ctx.clip();
      ctx.strokeStyle = 'rgba(255,184,0,0.35)';
      ctx.lineWidth = 4;
      for (let d = -s; d < s * 2; d += 12) {
        ctx.beginPath();
        ctx.moveTo(px + d, py + s);
        ctx.lineTo(px + d + s, py);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 出口：外侧延续路面 + 车道虚线 + 道闸
    const g = gatePos(level, this);
    this.drawExit(level, g, view.gateOpen);

    // 乘客：矢量小人 + 待接光环 + 序号
    for (const p of level.pickups) {
      if (state.picked.includes(p.id)) continue;
      const { px, py, s } = this.cellRect(level, p.x, p.y);
      const cx = px + s / 2, cy = py + s / 2;
      const bob = Math.sin(this.time / 300) * 2;
      // 待接光环
      ctx.strokeStyle = `rgba(255,214,64,${0.45 + 0.3 * Math.sin(this.time / 200)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      // 影子
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + s * 0.28, s * 0.16, s * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      // 身体
      ctx.fillStyle = '#ffb800';
      roundRect(ctx, cx - s * 0.11, cy - s * 0.02 + bob, s * 0.22, s * 0.3, s * 0.08);
      ctx.fill();
      // 头
      ctx.fillStyle = '#ffd9a0';
      ctx.beginPath();
      ctx.arc(cx, cy - s * 0.12 + bob, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      if (p.order != null) {
        ctx.fillStyle = '#0b0c0a';
        ctx.beginPath();
        ctx.arc(px + s * 0.82, py + s * 0.18, s * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffd640'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px + s * 0.82, py + s * 0.18, s * 0.14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffd640';
        ctx.font = `bold ${Math.floor(s * 0.2)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(p.order), px + s * 0.82, py + s * 0.19);
      }
    }

    // 车辆（含动画插值）
    for (const car of level.cars) {
      const pos = state.cars[car.id];
      let x = pos.x, y = pos.y;
      const anim = view.anims && view.anims[car.id];
      if (anim) {
        const t = easeOut(Math.min(1, (view.now - anim.t0) / anim.dur));
        x = anim.from.x + (pos.x - anim.from.x) * t;
        y = anim.from.y + (pos.y - anim.from.y) * t;
      }
      this.drawCar(level, car, x, y, view, state);
    }

    // 粒子
    this.updateParticles(dt);
  }

  drawCar(level, car, x, y, view, state) {
    const ctx = this.ctx;
    const dir = (state.cars[car.id] && state.cars[car.id].dir) || car.dir;
    const isH = dir === 'h';
    const wpx = (isH ? car.len : 1) * this.cell - 6;
    const hpx = (isH ? 1 : car.len) * this.cell - 6;
    const px = this.ox + x * this.cell + 3;
    const py = this.oy + y * this.cell + 3;
    const hero = car.role === 'hero';
    const selected = view.selectedId === car.id;
    const bus = !!car.bus;

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(ctx, px + 2, py + 4, wpx, hpx, 9);
    ctx.fill();

    const base = hero ? '#ff5a3c' : bus ? '#ffc21a' : CAR_COLORS[(car.id.charCodeAt(0) + car.len) % CAR_COLORS.length];

    // 轮子
    ctx.fillStyle = '#101216';
    const wl = Math.max(6, this.cell * 0.2);
    if (isH) {
      for (const wx of [px + wpx * 0.14, px + wpx * 0.86 - wl]) {
        roundRect(ctx, wx, py - 2, wl, 5, 2); ctx.fill();
        roundRect(ctx, wx, py + hpx - 3, wl, 5, 2); ctx.fill();
      }
    } else {
      for (const wy of [py + hpx * 0.14, py + hpx * 0.86 - wl]) {
        roundRect(ctx, px - 2, wy, 5, wl, 2); ctx.fill();
        roundRect(ctx, px + wpx - 3, wy, 5, wl, 2); ctx.fill();
      }
    }

    // 车身渐变（短轴受光）
    const cg = isH ? ctx.createLinearGradient(0, py, 0, py + hpx) : ctx.createLinearGradient(px, 0, px + wpx, 0);
    cg.addColorStop(0, shade(base, 26));
    cg.addColorStop(0.5, base);
    cg.addColorStop(1, shade(base, -26));
    ctx.fillStyle = cg;
    roundRect(ctx, px, py, wpx, hpx, 9);
    ctx.fill();

    // 座舱 + 车窗
    ctx.fillStyle = 'rgba(16,20,28,0.5)';
    if (isH) roundRect(ctx, px + wpx * 0.2, py + hpx * 0.14, wpx * 0.56, hpx * 0.44, 5);
    else roundRect(ctx, px + wpx * 0.14, py + hpx * 0.2, wpx * 0.44, hpx * 0.56, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(210,235,255,0.85)';
    if (isH) {
      roundRect(ctx, px + wpx * 0.6, py + hpx * 0.2, wpx * 0.12, hpx * 0.32, 2); ctx.fill();
      roundRect(ctx, px + wpx * 0.26, py + hpx * 0.2, wpx * 0.1, hpx * 0.32, 2); ctx.fill();
    } else {
      roundRect(ctx, px + wpx * 0.2, py + hpx * 0.6, wpx * 0.32, hpx * 0.12, 2); ctx.fill();
      roundRect(ctx, px + wpx * 0.2, py + hpx * 0.26, wpx * 0.32, hpx * 0.1, 2); ctx.fill();
    }

    // 英雄车：出租车格纹 + 顶灯 + 车头灯
    if (hero) {
      ctx.save();
      roundRect(ctx, px, py, wpx, hpx, 9); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const cs = Math.max(3, this.cell * 0.09);
      if (isH) {
        for (let i = 0, x = px; x < px + wpx; x += cs, i++) { ctx.fillStyle = i % 2 ? '#111' : '#fff'; ctx.fillRect(x, py + hpx - cs * 1.4, cs, cs); }
      } else {
        for (let i = 0, y = py; y < py + hpx; y += cs, i++) { ctx.fillStyle = i % 2 ? '#111' : '#fff'; ctx.fillRect(px + wpx - cs * 1.4, y, cs, cs); }
      }
      ctx.restore();
      // 顶灯
      ctx.fillStyle = '#ffd640';
      if (isH) roundRect(ctx, px + wpx / 2 - 6, py + hpx * 0.3, 12, 6, 2);
      else roundRect(ctx, px + wpx * 0.3, py + hpx / 2 - 6, 6, 12, 2);
      ctx.fill();
      // 车头灯
      ctx.fillStyle = 'rgba(255,240,180,0.95)';
      if (isH) { roundRect(ctx, px + wpx - 4, py + 3, 3, 5, 1); ctx.fill(); roundRect(ctx, px + wpx - 4, py + hpx - 8, 3, 5, 1); ctx.fill(); }
      else { roundRect(ctx, px + 3, py + hpx - 4, 5, 3, 1); ctx.fill(); roundRect(ctx, px + wpx - 8, py + hpx - 4, 5, 3, 1); ctx.fill(); }
      // 已接乘客数
      if (level.pickups.length && state.picked.length) {
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath(); ctx.arc(px + wpx - 5, py + 6, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(state.picked.length), px + wpx - 5, py + 7);
      }
    }

    // 班车箭头
    if (bus) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(arrowOf(car.bus), px + wpx / 2, py + hpx / 2);
    }

    // 选中 / 提示描边
    if (selected) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      roundRect(ctx, px, py, wpx, hpx, 9); ctx.stroke();
    } else if (view.hintCar === car.id) {
      ctx.strokeStyle = `rgba(255,184,0,${0.5 + 0.4 * Math.sin(this.time / 120)})`;
      ctx.lineWidth = 4;
      roundRect(ctx, px - 2, py - 2, wpx + 4, hpx + 4, 10); ctx.stroke();
    }
  }

  // 出口：外侧延续路面 + 琥珀车道虚线 + 红白条纹道闸（停车场栏杆语义）
  drawExit(level, g, open) {
    const ctx = this.ctx;
    const roadW = this.cssW - g.px;
    // 外侧延续路面
    const rg = ctx.createLinearGradient(g.px, 0, this.cssW, 0);
    rg.addColorStop(0, '#22262e');
    rg.addColorStop(1, '#171a20');
    ctx.fillStyle = rg;
    ctx.fillRect(g.px, g.py + 3, roadW, g.s - 6);
    // 导向箭头（流动感）
    ctx.strokeStyle = open ? 'rgba(0,200,83,0.8)' : 'rgba(255,184,0,0.5)';
    ctx.lineWidth = 2.5;
    const ph = (this.time / 40) % 14;
    for (let ax = g.px + 4 + ph; ax < this.cssW - 8; ax += 14) {
      ctx.beginPath();
      ctx.moveTo(ax, g.py + g.s / 2 - 5);
      ctx.lineTo(ax + 5, g.py + g.s / 2);
      ctx.lineTo(ax, g.py + g.s / 2 + 5);
      ctx.stroke();
    }
    // 开口辉光
    if (open) {
      const gl = ctx.createRadialGradient(g.px, g.py + g.s / 2, 2, g.px, g.py + g.s / 2, g.s);
      gl.addColorStop(0, 'rgba(0,200,83,0.35)');
      gl.addColorStop(1, 'rgba(0,200,83,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(g.px - g.s, g.py - g.s / 2, g.s * 2, g.s * 2);
    }
    // 出口标签（画布右缘对齐，避免与栏杆重叠）
    ctx.fillStyle = 'rgba(255,184,0,0.9)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('出口', this.cssW - 4, g.py - 4);

    if (open) {
      // 抬起的栏杆：开口上方的短条纹桩 + 绿灯
      const bx = g.px + 2;
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i % 2 ? '#fff' : '#e5484d';
        ctx.fillRect(bx, g.py - 16 + i * 4, 5, 4);
      }
      ctx.fillStyle = '#00c853';
      ctx.beginPath();
      ctx.arc(bx + 2.5, g.py + g.s - 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 放下的红白条纹栏杆，横跨开口
      const bx = g.px + 2;
      const seg = 6;
      for (let y = g.py + 2; y < g.py + g.s - 2; y += seg) {
        ctx.fillStyle = Math.floor((y - g.py) / seg) % 2 ? '#fff' : '#e5484d';
        ctx.fillRect(bx, y, 6, Math.min(seg, g.py + g.s - 2 - y));
      }
      ctx.fillStyle = '#e5484d';
      ctx.beginPath();
      ctx.arc(bx + 3, g.py + g.s - 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  burst(level, cellX, cellY, color) {
    const { px, py, s } = this.cellRect(level, cellX, cellY);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 160;
      this.particles.push({
        x: px + s / 2, y: py + s / 2,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
        life: 0.6 + Math.random() * 0.5, age: 0,
        color: color || (Math.random() < 0.5 ? '#ffd640' : '#e74c3c'),
        size: 3 + Math.random() * 4,
      });
    }
  }

  updateParticles(dt) {
    const ctx = this.ctx;
    const dts = dt / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dts;
      if (p.age > p.life) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dts;
      p.y += p.vy * dts;
      p.vy += 320 * dts;
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}

function gatePos(level, r) {
  const row = level.exit.y;
  return {
    px: r.ox + level.w * r.cell + 2,
    py: r.oy + row * r.cell,
    s: r.cell,
  };
}

function arrowOf(bus) {
  if (bus.dy === -1) return '↑';
  if (bus.dy === 1) return '↓';
  if (bus.dx === -1) return '←';
  return '→';
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 0xff) + amt, b = (n & 0xff) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}
