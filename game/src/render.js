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

    // 底盘（沥青）
    ctx.fillStyle = '#2b303b';
    ctx.fillRect(this.ox, this.oy, this.cell * level.w, this.cell * level.h);

    // 网格
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= level.w; i++) {
      ctx.beginPath();
      ctx.moveTo(this.ox + i * this.cell + 0.5, this.oy);
      ctx.lineTo(this.ox + i * this.cell + 0.5, this.oy + this.cell * level.h);
      ctx.stroke();
    }
    for (let j = 0; j <= level.h; j++) {
      ctx.beginPath();
      ctx.moveTo(this.ox, this.oy + j * this.cell + 0.5);
      ctx.lineTo(this.ox + this.cell * level.w, this.oy + j * this.cell + 0.5);
      ctx.stroke();
    }

    // 墙
    for (const w of level.walls) {
      const { px, py, s } = this.cellRect(level, w.x, w.y);
      ctx.fillStyle = '#565f6e';
      roundRect(ctx, px + 2, py + 2, s - 4, s - 4, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(px + 2, py + 2, s - 4, (s - 4) * 0.3);
    }

    // 出口：外侧延续路面 + 车道虚线 + 道闸
    const g = gatePos(level, this);
    this.drawExit(level, g, view.gateOpen);

    // 乘客
    for (const p of level.pickups) {
      if (state.picked.includes(p.id)) continue;
      const { px, py, s } = this.cellRect(level, p.x, p.y);
      const bob = Math.sin(this.time / 300) * 3;
      ctx.font = `${Math.floor(s * 0.62)}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧍', px + s / 2, py + s / 2 + bob);
      // 待接光环
      ctx.strokeStyle = `rgba(255,214,64,${0.5 + 0.3 * Math.sin(this.time / 200)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px + s / 2, py + s / 2, s * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      if (p.order != null) {
        ctx.fillStyle = '#ffd640';
        ctx.font = `bold ${Math.floor(s * 0.3)}px sans-serif`;
        ctx.fillText(String(p.order), px + s * 0.82, py + s * 0.18);
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
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, px + 2, py + 3, wpx, hpx, 8);
    ctx.fill();

    // 车身
    ctx.fillStyle = hero ? '#e74c3c' : bus ? '#f1c40f' : CAR_COLORS[(car.id.charCodeAt(0) + car.len) % CAR_COLORS.length];
    roundRect(ctx, px, py, wpx, hpx, 8);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      roundRect(ctx, px, py, wpx, hpx, 8);
      ctx.stroke();
    } else if (view.hintCar === car.id) {
      ctx.strokeStyle = `rgba(255,184,0,${0.5 + 0.4 * Math.sin(this.time / 120)})`;
      ctx.lineWidth = 4;
      roundRect(ctx, px - 2, py - 2, wpx + 4, hpx + 4, 9);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      roundRect(ctx, px, py, wpx, hpx, 8);
      ctx.stroke();
    }

    // 车窗（英雄车用 emoji 整车表现，不画窗块）
    if (!hero) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      if (isH) {
        roundRect(ctx, px + wpx * 0.55, py + hpx * 0.18, wpx * 0.22, hpx * 0.28, 3); ctx.fill();
        roundRect(ctx, px + wpx * 0.18, py + hpx * 0.18, wpx * 0.2, hpx * 0.28, 3); ctx.fill();
      } else {
        roundRect(ctx, px + wpx * 0.18, py + hpx * 0.08, wpx * 0.64, hpx * 0.12, 3); ctx.fill();
        roundRect(ctx, px + wpx * 0.18, py + hpx * 0.5, wpx * 0.64, hpx * 0.12, 3); ctx.fill();
      }
    }

    // 英雄车：师傅标识 + 已接乘客数
    if (hero) {
      ctx.font = `${Math.floor(this.cell * 0.62)}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🚕', px + wpx / 2, py + hpx / 2);
      if (level.pickups.length) {
        const n = state.picked.length;
        if (n > 0) {
          ctx.fillStyle = '#2ecc71';
          ctx.beginPath();
          ctx.arc(px + wpx - 4, py + 6, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(String(n), px + wpx - 4, py + 7);
        }
      }
    }

    // 班车箭头
    if (bus) {
      ctx.fillStyle = '#7f6000';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      const cx = px + wpx / 2, cy = py + hpx / 2;
      ctx.fillText(arrowOf(car.bus), cx, cy + 6);
    }
  }

  // 出口：外侧延续路面 + 琥珀车道虚线 + 红白条纹道闸（停车场栏杆语义）
  drawExit(level, g, open) {
    const ctx = this.ctx;
    const roadW = this.cssW - g.px;
    // 外侧延续路面
    ctx.fillStyle = '#1d2026';
    ctx.fillRect(g.px, g.py + 3, roadW, g.s - 6);
    // 车道虚线指向外
    ctx.strokeStyle = 'rgba(255,184,0,0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(g.px + 2, g.py + g.s / 2);
    ctx.lineTo(this.cssW - 3, g.py + g.s / 2);
    ctx.stroke();
    ctx.setLineDash([]);
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
