import { Plan } from '../model/Plan';
import { Wall, wallDirection } from '../model/Wall';

const WALL_CLEARANCE = 400; // мм от поверхности стены

/**
 * Рендерит Wall Clearance Zone — запретную зону 40 см от поверхности стен.
 * Рисование ведётся в мировых координатах (контекст уже трансформирован камерой).
 */
export class WallClearanceRenderer {
  constructor(private plan: Plan) {}

  render(ctx: CanvasRenderingContext2D): void {
    if (this.plan.walls.length === 0) return;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 200, 200, 0.15)';
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';

    for (const wall of this.plan.walls) {
      this.renderWallZone(ctx, wall);
    }

    ctx.restore();
  }

  private renderWallZone(ctx: CanvasRenderingContext2D, wall: Wall): void {
    const dir = wallDirection(wall);
    if (dir.length() < 1e-9) return;
    const n = dir.perpendicular();
    const h = wall.thickness / 2 + WALL_CLEARANCE;

    const p1 = wall.a.add(n.scale(h));
    const p2 = wall.b.add(n.scale(h));
    const p3 = wall.b.sub(n.scale(h));
    const p4 = wall.a.sub(n.scale(h));

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
