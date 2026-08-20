import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { ThemeManager } from '../editor/ThemeManager';

/**
 * Отрисовка растровой подложки листа.
 * Подложка рисуется в мировых координатах: позиция левого нижнего угла + масштаб (мм на пиксель).
 */
export class UnderlayRenderer {
  private imageCache = new Map<string, HTMLImageElement>();

  constructor(
    private plan: Plan,
    private camera: Camera,
    private themeManager: ThemeManager,
    private onRenderRequest: () => void = () => {},
  ) {}

  render(ctx: CanvasRenderingContext2D): void {
    const underlay = this.plan.activeSheet.underlay;
    if (!underlay || !underlay.visible) return;

    const img = this.imageCache.get(underlay.id);
    if (!img) {
      this.loadImage(underlay.id, underlay.dataUrl);
      return;
    }

    if (!img.complete || img.naturalWidth === 0) return;

    const x = underlay.position.x;
    const y = underlay.position.y;
    const w = img.naturalWidth * underlay.scale;
    const h = img.naturalHeight * underlay.scale;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, underlay.opacity));
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  }

  private loadImage(id: string, dataUrl: string): void {
    if (this.imageCache.has(id)) return;
    const img = new Image();
    img.onload = () => {
      this.onRenderRequest();
    };
    img.src = dataUrl;
    this.imageCache.set(id, img);
  }

  /** Очистить кэш изображений. */
  clearCache(): void {
    this.imageCache.clear();
  }

  /** Получить загруженное изображение подложки (для hit-test и т.п.). */
  getImage(id: string): HTMLImageElement | undefined {
    return this.imageCache.get(id);
  }
}
