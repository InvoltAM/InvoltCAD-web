import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { EditorState } from '../editor/EditorState';
import { Vector2 } from '../geometry/Vector2';
import { ThemeManager, ThemeColorKey } from '../editor/ThemeManager';

function typeToColorKey(type: string): ThemeColorKey {
  switch (type) {
    case 'power': return 'cablePower';
    case 'lighting': return 'cableLighting';
    case 'low-current': return 'cableLowCurrent';
    default: return 'cablePower';
  }
}

export class CableRenderer {
  private selectedCableId: string | null = null;

  constructor(
    private plan: Plan,
    private camera: Camera,
    private editorState: EditorState,
    private themeManager: ThemeManager,
  ) {}

  setSelectedCable(id: string | null): void {
    this.selectedCableId = id;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.editorState.get('layers').cables) return;

    const rect = this.camera.visibleRect(0.1);

    for (const cable of this.plan.cables) {
      const from = this.plan.findDevice(cable.fromDeviceId);
      const to = this.plan.findDevice(cable.toDeviceId);
      if (!from || !to) continue;

      const route = cable.route.length >= 2
        ? cable.route
        : [this.plan.deviceWorldPosition(from), this.plan.deviceWorldPosition(to)];

      if (!this.isRouteVisible(route, rect)) continue;

      const selected = this.selectedCableId === cable.id;
      ctx.strokeStyle = selected ? this.themeManager.getColor('selected') : this.themeManager.getColor(typeToColorKey(cable.type));
      ctx.lineWidth = Math.max(2, selected ? 5 * this.camera.scale : 4 * this.camera.scale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      for (let i = 0; i < route.length; i++) {
        const p = this.camera.worldToScreen(route[i]);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      const a = this.camera.worldToScreen(route[0]);
      const b = this.camera.worldToScreen(route[route.length - 1]);
      ctx.fillStyle = ctx.strokeStyle;
      this.drawDot(ctx, a.x, a.y, 3 * this.camera.scale);
      this.drawDot(ctx, b.x, b.y, 3 * this.camera.scale);

      if (route.length >= 2) {
        const mid = route[Math.floor(route.length / 2)];
        const s = this.camera.worldToScreen(mid);
        ctx.fillStyle = this.themeManager.getColor('text');
        ctx.font = `12px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const label = `${(cable.length / 1000).toFixed(2)} м`;
        ctx.fillText(label, s.x, s.y - 4);
      }
    }
  }

  private isRouteVisible(route: Vector2[], rect: { min: Vector2; max: Vector2 }): boolean {
    if (route.length === 0) return false;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of route) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return !(maxX < rect.min.x || minX > rect.max.x || maxY < rect.min.y || minY > rect.max.y);
  }

  private drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, r), 0, Math.PI * 2);
    ctx.fill();
  }
}
