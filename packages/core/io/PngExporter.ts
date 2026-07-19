import { Camera } from '../engine/Camera';
import { EditorState } from '../editor/EditorState';
import { Plan } from '../model/Plan';
import { GridRenderer } from '../render/GridRenderer';
import { RoomRenderer } from '../render/RoomRenderer';
import { DimensionRenderer } from '../render/DimensionRenderer';
import { WallDimensionRenderer } from '../render/WallDimensionRenderer';
import { WallRenderer } from '../render/WallRenderer';
import { OpeningRenderer } from '../render/OpeningRenderer';
import { DeviceRenderer } from '../render/DeviceRenderer';
import { CableRenderer } from '../render/CableRenderer';
import { ThemeManager } from '../editor/ThemeManager';

const TITLE_HEIGHT = 48;

export interface PngExportOptions {
  filename?: string;
  title?: string;
  scale?: number;
  margin?: number;
}

/**
 * Экспорт плана в PNG.
 * Рендерит план на offscreen canvas с заданным масштабом и заголовком.
 */
export class PngExporter {
  constructor(
    private plan: Plan,
    private editorState: EditorState,
    private themeManager: ThemeManager,
  ) {}

  export(options: PngExportOptions = {}): void {
    const filename = options.filename ?? 'involtcad-plan.png';
    const dataUrl = this.renderToDataURL(options);
    if (!dataUrl) return;

    const url = dataUrl;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /** Рендерит план в canvas и возвращает Data URL PNG. */
  renderToDataURL(options: PngExportOptions = {}): string | null {
    const canvas = this.renderToCanvas(options);
    return canvas ? canvas.toDataURL('image/png') : null;
  }

  private renderToCanvas(options: PngExportOptions = {}): HTMLCanvasElement | null {
    const title = options.title ?? 'План';
    const scale = options.scale ?? 2;
    const margin = options.margin ?? 200;

    const isEmpty =
      this.plan.walls.length === 0 &&
      this.plan.devices.length === 0 &&
      this.plan.dimensions.length === 0 &&
      this.plan.cables.length === 0;

    if (isEmpty) {
      alert('Нечего экспортировать');
      return null;
    }

    const bounds = this.plan.getBounds(margin);
    const worldW = bounds.max.x - bounds.min.x;
    const worldH = bounds.max.y - bounds.min.y;

    if (!isFinite(worldW) || !isFinite(worldH) || worldW <= 0 || worldH <= 0) {
      alert('Нечего экспортировать');
      return null;
    }

    const titleHeight = title ? TITLE_HEIGHT : 0;
    const cssW = Math.max(1, Math.round(worldW * scale));
    const cssH = Math.max(1, Math.round(worldH * scale)) + titleHeight;

    const canvas = document.createElement('canvas');
    canvas.width = cssW;
    canvas.height = cssH;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Не удалось получить 2D-контекст для PNG-экспорта');
      return null;
    }

    ctx.fillStyle = this.themeManager.getColor('canvasBg');
    ctx.fillRect(0, 0, cssW, cssH);

    const camera = new Camera(cssW, cssH - titleHeight);
    camera.scale = scale;
    camera.x = bounds.min.x + worldW / 2;
    camera.y = bounds.min.y + worldH / 2;

    ctx.save();
    ctx.translate(0, titleHeight);
    camera.applyTransform(ctx);

    const layers = this.editorState.get('layers');

    new GridRenderer(camera, this.themeManager).render(ctx);

    if (layers.rooms) {
      new RoomRenderer(this.plan, camera, this.themeManager).render(ctx);
    }

    if (layers.dimensions) {
      const renderer = new DimensionRenderer(this.plan, camera, this.themeManager);
      renderer.setSelectedDimension(null);
      renderer.render(ctx);
    }

    if (layers.wallDimensions) {
      new WallDimensionRenderer(this.plan, camera, this.themeManager).render(ctx);
    }

    if (layers.walls) {
      const renderer = new WallRenderer(this.plan, camera, this.editorState, this.themeManager);
      renderer.setSelectedWall(null);
      renderer.render(ctx);
    }

    if (layers.openings) {
      const renderer = new OpeningRenderer(this.plan, camera, this.themeManager);
      renderer.setSelectedOpening(null);
      renderer.render(ctx);
    }

    if (layers.devices) {
      const renderer = new DeviceRenderer(this.plan, camera, this.editorState, this.themeManager);
      renderer.setSelectedDevice(null);
      renderer.render(ctx);
    }

    if (layers.cables) {
      const renderer = new CableRenderer(this.plan, camera, this.editorState, this.themeManager);
      renderer.setSelectedCable(null);
      renderer.render(ctx);
    }

    ctx.restore();

    if (titleHeight) {
      ctx.fillStyle = this.themeManager.getColor('text');
      ctx.font = 'bold 24px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(title, 20, 14);
    }

    return canvas;
  }
}
