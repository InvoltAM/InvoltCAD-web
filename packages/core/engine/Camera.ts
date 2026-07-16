import { Vector2 } from '../geometry/Vector2';

/**
 * Камера: преобразует мировые координаты (мм) в экранные (px) и обратно.
 * camera.x, camera.y — мировые координаты центра viewport.
 */
export class Camera {
  x = 0;
  y = 0;
  scale = 0.1; // px на 1 мм

  private minScale = 0.02;
  private maxScale = 2;

  constructor(public viewportWidth = 0, public viewportHeight = 0) {}

  setViewport(w: number, h: number): void {
    this.viewportWidth = w;
    this.viewportHeight = h;
  }

  /** Мир → Экран */
  worldToScreen(p: Vector2): Vector2 {
    return new Vector2(
      (p.x - this.x) * this.scale + this.viewportWidth / 2,
      (p.y - this.y) * this.scale + this.viewportHeight / 2,
    );
  }

  /** Экран → Мир */
  screenToWorld(p: Vector2): Vector2 {
    return new Vector2(
      (p.x - this.viewportWidth / 2) / this.scale + this.x,
      (p.y - this.viewportHeight / 2) / this.scale + this.y,
    );
  }

  /** Сдвинуть камеру на вектор экранных пикселей. */
  panBy(dxScreen: number, dyScreen: number): void {
    this.x -= dxScreen / this.scale;
    this.y -= dyScreen / this.scale;
  }

  /**
   * Зум относительно экранной точки.
   * factor — множитель scale (например, 1.1 или 0.9).
   */
  zoomAt(screenPoint: Vector2, factor: number): void {
    const wx = (screenPoint.x - this.viewportWidth / 2) / this.scale + this.x;
    const wy = (screenPoint.y - this.viewportHeight / 2) / this.scale + this.y;

    const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
    this.scale = newScale;

    this.x = wx - (screenPoint.x - this.viewportWidth / 2) / newScale;
    this.y = wy - (screenPoint.y - this.viewportHeight / 2) / newScale;
  }

  /** Применить трансформацию canvas-контекста для рисования в мировых координатах. */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.translate(this.viewportWidth / 2, this.viewportHeight / 2);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.x, -this.y);
  }

  /** Установить камеру так, чтобы worldPoint был в центре viewport. */
  focusOn(worldPoint: Vector2, targetScale = 0.2): void {
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, targetScale));
    this.x = worldPoint.x;
    this.y = worldPoint.y;
  }

  /** Видимый мировой прямоугольник с запасом margin (мм). */
  visibleRect(marginFactor = 0.1): { min: Vector2; max: Vector2 } {
    const wWorld = this.viewportWidth / this.scale;
    const hWorld = this.viewportHeight / this.scale;
    const marginX = wWorld * marginFactor;
    const marginY = hWorld * marginFactor;
    return {
      min: new Vector2(this.x - wWorld / 2 - marginX, this.y - hWorld / 2 - marginY),
      max: new Vector2(this.x + wWorld / 2 + marginX, this.y + hWorld / 2 + marginY),
    };
  }
}
