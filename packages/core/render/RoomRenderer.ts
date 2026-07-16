import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { Vector2 } from '../geometry/Vector2';
import { Wall } from '../model/Wall';
import { ThemeManager } from '../editor/ThemeManager';

const HANDLE_WORLD_THRESHOLD = 5; // мм

/**
 * Отрисовка заливки комнат и их площадей.
 * Для выделенной комнаты рисуются маркеры её угловых точек (концы стен).
 */
export class RoomRenderer {
  private selectedRoomIndex: number | null = null;

  constructor(
    private plan: Plan,
    private camera: Camera,
    private themeManager: ThemeManager,
  ) {}

  setSelectedRoom(index: number | null): void {
    this.selectedRoomIndex = index;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const rooms = this.plan.getRooms();
    if (rooms.length === 0) return;

    const rect = this.camera.visibleRect(0.1);

    ctx.fillStyle = this.themeManager.getColor('roomFill');
    ctx.strokeStyle = this.themeManager.getColor('roomStroke');
    ctx.lineWidth = 1 / this.camera.scale;
    ctx.font = `${12 / this.camera.scale}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      if (!this.isRoomVisible(room.polygon, rect)) continue;
      const poly = room.polygon;
      if (poly.length < 3) continue;

      const selected = i === this.selectedRoomIndex;

      ctx.beginPath();
      this.addPolygonToPath(ctx, poly);
      for (const hole of room.holes) {
        this.addPolygonToPath(ctx, hole);
      }
      ctx.fill();
      ctx.stroke();

      if (selected) {
        ctx.save();
        ctx.strokeStyle = this.themeManager.getColor('selected');
        ctx.lineWidth = 2 / this.camera.scale;
        ctx.stroke();
        ctx.restore();

        const endpoints = this.getRoomBoundaryEndpoints(room.polygon);
        const handleSize = 5 / this.camera.scale;
        for (const p of endpoints) {
          ctx.fillStyle = this.themeManager.getColor('roomHandleFill');
          ctx.strokeStyle = this.themeManager.getColor('roomHandleStroke');
          ctx.lineWidth = 1 / this.camera.scale;
          ctx.fillRect(p.x - handleSize, p.y - handleSize, handleSize * 2, handleSize * 2);
          ctx.strokeRect(p.x - handleSize, p.y - handleSize, handleSize * 2, handleSize * 2);
        }
      }

      let cx = 0;
      let cy = 0;
      for (const p of poly) {
        cx += p.x;
        cy += p.y;
      }
      cx /= poly.length;
      cy /= poly.length;

      const areaM2 = (room.area / 1_000_000).toFixed(2);
      ctx.fillStyle = this.themeManager.getColor('roomText');
      ctx.fillText(`${areaM2} м²`, cx, cy);
      ctx.fillStyle = this.themeManager.getColor('roomFill');
    }
  }

  private addPolygonToPath(ctx: CanvasRenderingContext2D, poly: Vector2[]): void {
    if (poly.length < 3) return;
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let j = 1; j < poly.length; j++) {
      ctx.lineTo(poly[j].x, poly[j].y);
    }
    ctx.closePath();
  }

  private isRoomVisible(poly: Vector2[], rect: { min: Vector2; max: Vector2 }): boolean {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of poly) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return !(maxX < rect.min.x || minX > rect.max.x || maxY < rect.min.y || minY > rect.max.y);
  }

  private getRoomBoundaryEndpoints(polygon: Vector2[]): Vector2[] {
    const result: Vector2[] = [];
    const seen = new Set<string>();
    for (const wall of this.plan.walls) {
      for (const p of [wall.a, wall.b]) {
        if (this.isPointOnPolygonBoundary(p, polygon, wall.thickness + HANDLE_WORLD_THRESHOLD)) {
          const key = `${Math.round(p.x)},${Math.round(p.y)}`;
          if (!seen.has(key)) {
            seen.add(key);
            result.push(p);
          }
        }
      }
    }
    return result;
  }

  private isPointOnPolygonBoundary(p: Vector2, polygon: Vector2[], threshold: number): boolean {
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % n];
      if (this.distanceToSegment(p, a, b) <= threshold) return true;
    }
    return false;
  }

  private distanceToSegment(p: Vector2, a: Vector2, b: Vector2): number {
    const v = b.sub(a);
    const lenSq = v.dot(v);
    if (lenSq === 0) return p.distanceTo(a);
    let t = p.sub(a).dot(v) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return p.distanceTo(a.add(v.scale(t)));
  }
}
