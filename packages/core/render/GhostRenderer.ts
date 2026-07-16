import { Camera } from '../engine/Camera';
import { Vector2 } from '../geometry/Vector2';
import { SnapResult } from '../snap/SnapEngine';
import { ThemeManager } from '../editor/ThemeManager';

/**
 * Слой предпросмотра: рисуемая стена, маркер snap, подсветка стены,
 * лупа для touch-рисования.
 */
export class GhostRenderer {
  private magnifier: HTMLCanvasElement | null = null;
  private magnifierCtx: CanvasRenderingContext2D | null = null;

  constructor(
    private camera: Camera,
    private themeManager: ThemeManager,
  ) {}

  /**
   * Рисует "резиновую" стену от start до end.
   */
  drawWallGhost(
    ctx: CanvasRenderingContext2D,
    start: Vector2,
    end: Vector2,
    thickness: number,
  ): void {
    const dir = end.sub(start);
    const len = dir.length();
    if (len === 0) return;
    const d = dir.normalized();
    const n = d.perpendicular();
    const h = thickness / 2;

    const p1 = start.add(n.scale(h));
    const p2 = end.add(n.scale(h));
    const p3 = end.sub(n.scale(h));
    const p4 = start.sub(n.scale(h));

    ctx.fillStyle = this.themeManager.getColor('ghostWall');
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();

    this.drawDimensionLabel(ctx, start, end, Math.round(len));
  }

  /**
   * Подсветка проема на стене: полупрозрачный прямоугольник ширины openingWidth.
   */
  drawOpeningGhost(
    ctx: CanvasRenderingContext2D,
    wallA: Vector2,
    wallB: Vector2,
    t: number,
    openingWidth: number,
    wallThickness: number,
  ): void {
    const dir = wallB.sub(wallA);
    const len = dir.length();
    if (len === 0) return;
    const d = dir.normalized();
    const n = d.perpendicular();
    const center = wallA.add(d.scale(t * len));
    const half = openingWidth / 2;
    const h = wallThickness / 2 + 2 / this.camera.scale;

    ctx.fillStyle = this.themeManager.getColor('ghostOpening');
    ctx.beginPath();
    const c1 = center.add(d.scale(-half)).add(n.scale(h));
    const c2 = center.add(d.scale(half)).add(n.scale(h));
    const c3 = center.add(d.scale(half)).sub(n.scale(h));
    const c4 = center.add(d.scale(-half)).sub(n.scale(h));
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.lineTo(c3.x, c3.y);
    ctx.lineTo(c4.x, c4.y);
    ctx.closePath();
    ctx.fill();
  }

  /** Маркер snap-точки и подсветка стены. */
  drawSnapMarker(ctx: CanvasRenderingContext2D, snap: SnapResult): void {
    const color = this.themeManager.getColor('ghostSnap');
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1 / this.camera.scale;
    const r = 6 / this.camera.scale;
    ctx.beginPath();
    ctx.arc(snap.point.x, snap.point.y, r, 0, Math.PI * 2);
    ctx.stroke();

    if (snap.wall) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / this.camera.scale;
      ctx.beginPath();
      ctx.moveTo(snap.wall.a.x, snap.wall.a.y);
      ctx.lineTo(snap.wall.b.x, snap.wall.b.y);
      ctx.stroke();
    }
  }

  /** Размерная подпись длины стены. */
  private drawDimensionLabel(
    ctx: CanvasRenderingContext2D,
    start: Vector2,
    end: Vector2,
    lengthMm: number,
  ): void {
    const mid = start.add(end).scale(0.5);
    const dir = end.sub(start);
    const len = dir.length();
    if (len === 0) return;
    const n = dir.normalized().perpendicular();
    const offset = 12 / this.camera.scale;
    const pos = mid.add(n.scale(offset));

    const text = `${lengthMm} мм`;
    ctx.font = `${14 / this.camera.scale}px sans-serif`;
    const metrics = ctx.measureText(text);
    const padding = 4 / this.camera.scale;
    const w = metrics.width + padding * 2;
    const h = (16 / this.camera.scale) + padding * 2;

    ctx.fillStyle = this.themeManager.getColor('textBg');
    ctx.beginPath();
    ctx.roundRect?.(pos.x - w / 2, pos.y - h / 2, w, h, 4 / this.camera.scale);
    ctx.fill();

    ctx.fillStyle = this.themeManager.getColor('ghostSnapText');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pos.x, pos.y);
  }

  /** Ghost устройства. */
  drawDeviceGhost(
    ctx: CanvasRenderingContext2D,
    pos: Vector2,
    type: string,
    width: number,
    height: number,
    side = 1,
  ): void {
    ctx.strokeStyle = this.themeManager.getColor('ghostWall');
    ctx.fillStyle = this.themeManager.getColor('deviceIconBg');
    ctx.lineWidth = 1 / this.camera.scale;
    ctx.beginPath();
    ctx.rect(pos.x - width / 2, pos.y - height / 2, width, height);
    ctx.fill();
    ctx.stroke();
  }

  /**
   * Лупа для touch-рисования.
   * sourceCanvas — основной canvas, из которого берется фрагмент.
   */
  renderMagnifier(
    sourceCanvas: HTMLCanvasElement,
    screenPoint: Vector2,
    radius = 60,
    zoom = 2,
  ): HTMLCanvasElement {
    if (!this.magnifier) {
      this.magnifier = document.createElement('canvas');
      this.magnifier.width = radius * 2;
      this.magnifier.height = radius * 2;
      this.magnifierCtx = this.magnifier.getContext('2d');
    }
    if (!this.magnifierCtx) return this.magnifier;

    const ctx = this.magnifierCtx;
    ctx.clearRect(0, 0, radius * 2, radius * 2);

    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.clip();

    const srcX = Math.max(0, screenPoint.x - radius / zoom);
    const srcY = Math.max(0, screenPoint.y - radius / zoom);
    const srcW = (radius * 2) / zoom;
    const srcH = (radius * 2) / zoom;

    ctx.drawImage(
      sourceCanvas,
      srcX, srcY, srcW, srcH,
      0, 0, radius * 2, radius * 2,
    );

    const accent = this.themeManager.getColor('accent');
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(radius - 8, radius);
    ctx.lineTo(radius + 8, radius);
    ctx.moveTo(radius, radius - 8);
    ctx.lineTo(radius, radius + 8);
    ctx.stroke();

    ctx.restore();

    ctx.strokeStyle = this.themeManager.getColor('text');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.stroke();

    return this.magnifier;
  }
}
