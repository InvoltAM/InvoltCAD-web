import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { Wall, wallDirection } from '../model/Wall';

const WALL_CLEARANCE = 400; // мм от поверхности стены

/**
 * Рендерит Wall Clearance Zone — запретную зону 40 см от поверхности стен.
 * Полупрозрачная красная подсветка помогает понять, где кабель не может прокладываться.
 */
export class WallClearanceRenderer {
  constructor(
    private plan: Plan,
    private camera: Camera,
  ) {}

  render(ctx: CanvasRenderingContext2D): void {
    if (this.plan.walls.length === 0) return;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 200, 200, 0.15)';
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.setLineDash([4 / this.camera.scale, 4 / this.camera.scale]);

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

    const s1 = this.camera.worldToScreen(p1);
    const s2 = this.camera.worldToScreen(p2);
    const s3 = this.camera.worldToScreen(p3);
    const s4 = this.camera.worldToScreen(p4);

    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.lineTo(s3.x, s3.y);
    ctx.lineTo(s4.x, s4.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
