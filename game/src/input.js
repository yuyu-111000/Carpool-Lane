// input.js —— 指针输入：拖动（网格吸附）+ 点击两模式

export class Input {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.cb = callbacks; // { onMove(carId, target), onSelect(carId), onDragPreview(carId, target) }
    this.drag = null;
    canvas.style.touchAction = 'none';

    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => this.up(e));
    canvas.addEventListener('pointercancel', e => this.cancel(e));
  }

  down(e) {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const hit = this.cb.hitTest(e.clientX, e.clientY);
    if (!hit) return;
    const { carId, targets } = hit;
    this.drag = { carId, targets, startX: e.clientX, startY: e.clientY, moved: false };
    this.cb.onSelect(carId);
  }

  move(e) {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.startX;
    const dy = e.clientY - this.drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 6) this.drag.moved = true;
    const target = this.cb.projectDrag(this.drag.carId, e.clientX, e.clientY, this.drag.targets);
    this.cb.onDragPreview(this.drag.carId, target);
  }

  up(e) {
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    if (d.moved) {
      const target = this.cb.projectDrag(d.carId, e.clientX, e.clientY, d.targets);
      if (target !== null) this.cb.onMove(d.carId, target);
      else this.cb.onDragPreview(d.carId, null);
    } else {
      // 点击模式：点车选中后再点目标格
      const cell = this.cb.cellAt(e.clientX, e.clientY);
      if (cell) this.cb.onTapCell(d.carId, cell);
    }
  }

  cancel() {
    if (this.drag) this.cb.onDragPreview(this.drag.carId, null);
    this.drag = null;
  }
}
