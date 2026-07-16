import { Camera } from '../engine/Camera';
import { Vector2 } from '../geometry/Vector2';
import { Plan } from '../model/Plan';
import { Opening } from '../model/Opening';
import { Wall, wallDirection, wallLength } from '../model/Wall';
import { segmentIntersectsRect } from '../geometry/Geometry';
import { ThemeManager } from '../editor/ThemeManager';

/**
 * Отрисовка дверей и окон:
 * - разрыв в стене цветом фона
 * - дверь: створка + четверть-круглая дуга открывания
 * - окно: параллельные линии поперек стены + подоконник
 */
export class OpeningRenderer {
  private selectedOpeningId: string | null = null;

  constructor(
    private plan: Plan,
    private camera: Camera,
    private themeManager: ThemeManager,
  ) {}

  setSelectedOpening(id: string | null): void {
    this.selectedOpeningId = id;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = this.camera.visibleRect(0.1);

    for (const wall of this.plan.walls) {
      for (const opening of wall.openings) {
        if (this.isOpeningVisible(wall, opening, rect)) {
          this.drawOpening(ctx, wall, opening);
        }
      }
    }
  }

  private isOpeningVisible(wall: Wall, opening: Opening, rect: { min: Vector2; max: Vector2 }): boolean {
    const len = wallLength(wall);
    if (len === 0) return false;
    const dir = wallDirection(wall);
    const n = dir.perpendicular();
    const center = wall.a.add(dir.scale(opening.t * len));
    const half = opening.width / 2;
    const h = wall.thickness / 2 + 5;
    const c1 = center.add(dir.scale(-half)).add(n.scale(h));
    const c2 = center.add(dir.scale(half)).add(n.scale(h));
    const c3 = center.add(dir.scale(half)).sub(n.scale(h));
    const c4 = center.add(dir.scale(-half)).sub(n.scale(h));
    const bboxMin = new Vector2(
      Math.min(c1.x, c2.x, c3.x, c4.x),
      Math.min(c1.y, c2.y, c3.y, c4.y),
    );
    const bboxMax = new Vector2(
      Math.max(c1.x, c2.x, c3.x, c4.x),
      Math.max(c1.y, c2.y, c3.y, c4.y),
    );
    return !(bboxMax.x < rect.min.x || bboxMin.x > rect.max.x || bboxMax.y < rect.min.y || bboxMin.y > rect.max.y);
  }

  private drawOpening(ctx: CanvasRenderingContext2D, wall: Wall, opening: Opening): void {
    const len = wallLength(wall);
    if (len === 0) return;

    const dir = wallDirection(wall);
    const n = dir.perpendicular();
    const center = wall.a.add(dir.scale(opening.t * len));
    const half = opening.width / 2;
    const h = wall.thickness / 2 + 3 / this.camera.scale;

    // 1. Тень под проёмом
    this.drawOpeningShadow(ctx, center, dir, n, half, h);

    // 2. Разрыв в стене (цвет фона)
    ctx.fillStyle = this.themeManager.getColor('openingBg');
    ctx.beginPath();
    const c1 = center.add(dir.scale(-half)).add(n.scale(h));
    const c2 = center.add(dir.scale(half)).add(n.scale(h));
    const c3 = center.add(dir.scale(half)).sub(n.scale(h));
    const c4 = center.add(dir.scale(-half)).sub(n.scale(h));
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.lineTo(c3.x, c3.y);
    ctx.lineTo(c4.x, c4.y);
    ctx.closePath();
    ctx.fill();

    // 3. Специфика типа
    if (opening.type === 'door') {
      this.drawDoor(ctx, wall, opening, center, dir, n, half);
    } else {
      this.drawWindow(ctx, center, dir, n, half, wall.thickness);
    }

    // 4. Выделение
    if (opening.id === this.selectedOpeningId) {
      ctx.fillStyle = this.themeManager.getColor('selectionFill');
      ctx.fill();

      ctx.strokeStyle = this.themeManager.getColor('selected');
      ctx.lineWidth = 2 / this.camera.scale;
      ctx.stroke();
    }
  }

  private drawOpeningShadow(
    ctx: CanvasRenderingContext2D,
    center: Vector2,
    dir: Vector2,
    n: Vector2,
    half: number,
    h: number,
  ): void {
    ctx.save();
    ctx.fillStyle = this.themeManager.getColor('openingShadow');
    ctx.translate(3, 3);
    ctx.beginPath();
    const c1 = center.add(dir.scale(-half)).add(n.scale(h));
    const c2 = center.add(dir.scale(half)).add(n.scale(h));
    const c3 = center.add(dir.scale(half)).sub(n.scale(h));
    const c4 = center.add(dir.scale(-half)).sub(n.scale(h));
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.lineTo(c3.x, c3.y);
    ctx.lineTo(c4.x, c4.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawDoor(
    ctx: CanvasRenderingContext2D,
    wall: Wall,
    opening: Opening,
    center: Vector2,
    dir: Vector2,
    n: Vector2,
    half: number,
  ): void {
    const hingeSide = opening.swingSide ?? 'left';
    const openDir = opening.openDir ?? 1;

    const hingeSign = hingeSide === 'left' ? -1 : 1;
    const hinge = center.add(dir.scale(hingeSign * half));

    const wallAngle = Math.atan2(dir.y, dir.x);

    const leafAngle = wallAngle + openDir * Math.PI / 2;
    const leafEnd = hinge.add(new Vector2(
      Math.cos(leafAngle) * opening.width,
      Math.sin(leafAngle) * opening.width,
    ));

    ctx.strokeStyle = this.themeManager.getColor('openingStroke');
    ctx.lineWidth = 2 / this.camera.scale;
    ctx.beginPath();
    ctx.moveTo(hinge.x, hinge.y);
    ctx.lineTo(leafEnd.x, leafEnd.y);
    ctx.stroke();

    ctx.lineWidth = 1 / this.camera.scale;
    ctx.beginPath();
    const startAngle = wallAngle;
    const endAngle = wallAngle + openDir * Math.PI / 2;
    ctx.arc(hinge.x, hinge.y, opening.width, startAngle, endAngle, openDir < 0);
    ctx.stroke();
  }

  private drawWindow(
    ctx: CanvasRenderingContext2D,
    center: Vector2,
    dir: Vector2,
    n: Vector2,
    half: number,
    thickness: number,
  ): void {
    ctx.strokeStyle = this.themeManager.getColor('openingStroke');
    ctx.lineWidth = 1.5 / this.camera.scale;

    const offsets = [-thickness / 4, thickness / 4];
    ctx.beginPath();
    for (const off of offsets) {
      const p = center.add(n.scale(off));
      const p1 = p.add(dir.scale(-half));
      const p2 = p.add(dir.scale(half));
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    }
    ctx.stroke();

    ctx.lineWidth = 1 / this.camera.scale;
    ctx.beginPath();
    const sillOffset = thickness / 2 + 30;
    const sillCenter = center.add(n.scale(sillOffset));
    const s1 = sillCenter.add(dir.scale(-half - 20));
    const s2 = sillCenter.add(dir.scale(half + 20));
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
  }
}
