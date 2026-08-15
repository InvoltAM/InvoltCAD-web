import { Camera } from '../engine/Camera';
import { EditorState } from '../editor/EditorState';
import { Plan } from '../model/Plan';
import { ThemeManager } from '../editor/ThemeManager';
import { getSheetDimensions, Sheet } from '../model/Sheet';
import { GridRenderer } from '../render/GridRenderer';
import { RoomRenderer } from '../render/RoomRenderer';
import { DimensionRenderer } from '../render/DimensionRenderer';
import { WallDimensionRenderer } from '../render/WallDimensionRenderer';
import { WallRenderer } from '../render/WallRenderer';
import { OpeningRenderer } from '../render/OpeningRenderer';
import { DeviceRenderer } from '../render/DeviceRenderer';
import { CableRenderer } from '../render/CableRenderer';
import { PrimitiveRenderer } from '../render/PrimitiveRenderer';
import { TableRenderer } from '../render/TableRenderer';
import { SheetFrameRenderer } from '../render/SheetFrameRenderer';

const MM_TO_PX = 3.7795275591; // 96 DPI

export interface SheetRenderOptions {
  /** Масштаб печати в px на мм. По умолчанию 96 DPI. */
  resolution?: number;
  /** Отступ вокруг рамки листа, мм. */
  paddingMm?: number;
}

/**
 * Рендерит один лист проекта (Sheet) в offscreen canvas.
 * Возвращает Data URL PNG или null, если лист пуст.
 */
export function renderSheetToDataURL(
  plan: Plan,
  editorState: EditorState,
  themeManager: ThemeManager,
  sheet: Sheet,
  options: SheetRenderOptions = {},
): string | null {
  const resolution = options.resolution ?? MM_TO_PX;
  const paddingMm = options.paddingMm ?? 0;

  const dims = getSheetDimensions(sheet.pageSize, sheet.orientation);
  const printScale = sheet.printScale || 100;

  // Размеры листа в мировых единицах (мм * printScale)
  const worldW = dims.width * printScale;
  const worldH = dims.height * printScale;

  // Размер canvas в пикселях = размер листа в мм * resolution + отступы
  const canvasW = Math.max(1, Math.round((dims.width + paddingMm * 2) * resolution));
  const canvasH = Math.max(1, Math.round((dims.height + paddingMm * 2) * resolution));

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Не удалось получить 2D-контекст для рендера листа');
    return null;
  }

  // Сохраняем активный лист и переключаемся на целевой
  const previousActiveSheetId = plan.activeSheetId;
  plan.setActiveSheet(sheet.id);

  // Камера: центр листа в (0,0), масштаб такой, чтобы весь лист вместился
  const camera = new Camera(canvasW, canvasH);
  camera.fitToFrame(worldW, worldH, 1.0);

  // Заливаем фон
  ctx.fillStyle = themeManager.getColor('canvasBg');
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.save();
  camera.applyTransform(ctx);

  const layers = editorState.get('layers');

  // Порядок отрисовки как в CanvasEngine
  new GridRenderer(camera, themeManager).render(ctx);
  new SheetFrameRenderer(plan, camera, themeManager, () => {}).render(ctx);

  if (layers.rooms) {
    new RoomRenderer(plan, camera, themeManager).render(ctx);
  }
  if (layers.dimensions) {
    const renderer = new DimensionRenderer(plan, camera, themeManager);
    renderer.setSelectedDimensionIds([]);
    renderer.render(ctx);
  }
  if (layers.wallDimensions) {
    new WallDimensionRenderer(plan, camera, themeManager).render(ctx);
  }
  if (layers.walls) {
    const renderer = new WallRenderer(plan, camera, editorState, themeManager);
    renderer.setSelectedWallIds([]);
    renderer.render(ctx);
  }
  if (layers.openings) {
    const renderer = new OpeningRenderer(plan, camera, themeManager);
    renderer.setSelectedOpeningIds([]);
    renderer.render(ctx);
  }
  if (layers.devices) {
    const renderer = new DeviceRenderer(plan, camera, editorState, themeManager);
    renderer.setSelectedDeviceIds([]);
    renderer.render(ctx);
  }
  if (layers.cables) {
    const renderer = new CableRenderer(plan, camera, editorState, themeManager);
    renderer.setSelectedCableIds([]);
    renderer.render(ctx);
  }

  new PrimitiveRenderer(plan, camera, themeManager).render(ctx);
  new TableRenderer(plan, camera, themeManager).render(ctx);

  ctx.restore();

  // Восстанавливаем активный лист
  plan.setActiveSheet(previousActiveSheetId);

  return canvas.toDataURL('image/png');
}
