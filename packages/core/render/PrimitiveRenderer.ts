import { Camera } from '../engine/Camera';
import { Plan } from '../model/Plan';
import { ThemeManager } from '../editor/ThemeManager';
import { Vector2 } from '../geometry/Vector2';

/**
 * Отрисовка примитивов рисования (полилиния, отрезок, прямоугольник, круг).
 */
export class PrimitiveRenderer {
  private selectedIds = new Set<string>();

  constructor(
    private plan: Plan,
    private camera: Camera,
    private themeManager: ThemeManager,
  ) {}

  setSelectedPrimitiveIds(ids: string[]): void {
    this.selectedIds = new Set(ids);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const color = this.themeManager.getColor('dimension');
    const selectedColor = this.themeManager.getColor('selected');
    ctx.fillStyle = color;

    for (const primitive of this.plan.primitives) {
      const points = primitive.points;
      if (points.length === 0) continue;
      const isSelected = this.selectedIds.has(primitive.id);
      ctx.strokeStyle = isSelected ? selectedColor : color;
      ctx.lineWidth = isSelected ? 2.5 / this.camera.scale : 1 / this.camera.scale;

      switch (primitive.type) {
        case 'polyline':
        case 'segment':
          if (points.length < 2) continue;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
          break;

        case 'rectangle':
          if (points.length < 2) continue;
          {
            const x = Math.min(points[0].x, points[1].x);
            const y = Math.min(points[0].y, points[1].y);
            const w = Math.abs(points[1].x - points[0].x);
            const h = Math.abs(points[1].y - points[0].y);
            ctx.strokeRect(x, y, w, h);
          }
          break;

        case 'circle':
          if (points.length < 2) continue;
          {
            const radius = points[0].distanceTo(points[1]);
            ctx.beginPath();
            ctx.arc(points[0].x, points[0].y, radius, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;

        case 'text': {
          if (!primitive.text || points.length === 0) continue;
          const pos = points[0];
          const fontSize = primitive.fontSize ?? 250;
          const fontFamily = primitive.fontFamily ?? 'ui-sans-serif, system-ui, sans-serif';
          const fontStyle = primitive.italic ? 'italic ' : '';
          const fontWeight = isSelected ? 'bold ' : '';
          ctx.font = `${fontWeight}${fontStyle}${fontSize}px ${fontFamily}`;
          ctx.fillStyle = primitive.color && !isSelected ? primitive.color : (isSelected ? selectedColor : color);
          ctx.textAlign = primitive.textAlign ?? 'left';
          ctx.textBaseline = 'top';

          // Линия выноски для callout (второй точкой задаётся конец выноски)
          if (points.length >= 2) {
            const end = points[1];
            ctx.strokeStyle = primitive.color && !isSelected ? primitive.color : (isSelected ? selectedColor : color);
            ctx.lineWidth = 1 / this.camera.scale;
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
          }

          const lines = primitive.text.split('\n');
          const lineHeight = fontSize * 1.2;
          let x = pos.x;
          if (ctx.textAlign === 'center') x = pos.x;
          else if (ctx.textAlign === 'right') x = pos.x;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? '';
            let lineX = x;
            if (ctx.textAlign === 'center') {
              const metrics = ctx.measureText(line);
              lineX = pos.x - metrics.width / 2;
            } else if (ctx.textAlign === 'right') {
              const metrics = ctx.measureText(line);
              lineX = pos.x - metrics.width;
            }
            ctx.fillText(line, lineX, pos.y + i * lineHeight);
          }
          break;
        }

        case 'table': {
          if (!primitive.table || points.length === 0) continue;
          const table = primitive.table;
          const origin = points[0];
          const cellMap = new Map<string, import('../model/DrawingPrimitive').DrawingTableCell>();
          for (const cell of table.cells) {
            cellMap.set(`${cell.row},${cell.col}`, cell);
          }
          ctx.strokeStyle = isSelected ? selectedColor : color;
          ctx.lineWidth = isSelected ? 2 / this.camera.scale : 1 / this.camera.scale;

          // Границы ячеек
          for (let r = 0; r < table.rows; r++) {
            for (let c = 0; c < table.cols; c++) {
              const key = `${r},${c}`;
              if (!cellMap.has(key)) continue;
              const cell = cellMap.get(key)!;
              const { x, y, w, h } = this.getTableCellBounds(table, origin, cell.row, cell.col);
              ctx.strokeRect(x, y, w, h);

              // Текст ячейки
              if (cell.text) {
                const fontSize = table.fontSize ?? 140;
                ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
                ctx.fillStyle = isSelected ? selectedColor : color;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(cell.text, x + fontSize * 0.2, y + fontSize * 0.2);
              }
            }
          }
          break;
        }
      }
    }
  }

  private getTableCellBounds(
    table: import('../model/DrawingPrimitive').DrawingTable,
    origin: Vector2,
    row: number,
    col: number,
  ): { x: number; y: number; w: number; h: number } {
    let x = origin.x;
    for (let c = 0; c < col; c++) {
      x += table.columnWidths[c] ?? 0;
    }
    let y = origin.y;
    for (let r = 0; r < row; r++) {
      y += table.rowHeights[r] ?? 0;
    }
    let w = table.columnWidths[col] ?? 0;
    let h = table.rowHeights[row] ?? 0;
    const cell = table.cells.find((c) => c.row === row && c.col === col);
    if (cell?.colSpan && cell.colSpan > 1) {
      for (let i = 1; i < cell.colSpan && col + i < table.cols; i++) {
        w += table.columnWidths[col + i] ?? 0;
      }
    }
    if (cell?.rowSpan && cell.rowSpan > 1) {
      for (let i = 1; i < cell.rowSpan && row + i < table.rows; i++) {
        h += table.rowHeights[row + i] ?? 0;
      }
    }
    return { x, y, w, h };
  }

  /** Hit-test примитива: ближайший сегмент/грань/окружность в пределах thresholdPx. */
  hitTest(screenPoint: { x: number; y: number }, thresholdPx = 8): import('../model/DrawingPrimitive').DrawingPrimitive | null {
    const { projectPointToSegment } = require('../geometry/Geometry');
    const world = this.camera.screenToWorld(new Vector2(screenPoint.x, screenPoint.y));
    const thresholdWorld = thresholdPx / this.camera.scale;
    let best: { primitive: import('../model/DrawingPrimitive').DrawingPrimitive; distWorld: number } | null = null;

    const toV2 = (p: { x: number; y: number }) => (p instanceof Vector2 ? p : new Vector2(p.x, p.y));

    for (const primitive of this.plan.primitives) {
      const points = primitive.points.map(toV2);
      if (points.length === 0) continue;

      if (primitive.type === 'segment' || primitive.type === 'polyline') {
        const count = primitive.type === 'segment' ? Math.min(2, points.length) : points.length;
        for (let i = 1; i < count; i++) {
          const a = points[i - 1];
          const b = points[i];
          if (!a || !b) continue;
          const proj = projectPointToSegment(world, a, b);
          if (proj.dist < thresholdWorld && (!best || proj.dist < best.distWorld)) {
            best = { primitive, distWorld: proj.dist };
          }
        }
      } else if (primitive.type === 'rectangle') {
        if (points.length < 2) continue;
        const min = points[0];
        const max = points[1];
        const corners = [min, new Vector2(max.x, min.y), max, new Vector2(min.x, max.y)];
        const edges: Array<[Vector2, Vector2]> = [
          [corners[0], corners[1]],
          [corners[1], corners[2]],
          [corners[2], corners[3]],
          [corners[3], corners[0]],
        ];
        for (const [a, b] of edges) {
          const proj = projectPointToSegment(world, a, b);
          if (proj.dist < thresholdWorld && (!best || proj.dist < best.distWorld)) {
            best = { primitive, distWorld: proj.dist };
          }
        }
      } else if (primitive.type === 'circle') {
        if (points.length < 2) continue;
        const center = points[0];
        const rim = points[1];
        const radius = center.distanceTo(rim);
        const distWorld = Math.abs(world.distanceTo(center) - radius);
        if (distWorld < thresholdWorld && (!best || distWorld < best.distWorld)) {
          best = { primitive, distWorld };
        }
      } else if (primitive.type === 'text') {
        if (!primitive.text || points.length === 0) continue;
        const pos = points[0];
        const fontSize = primitive.fontSize ?? 250;
        const lineHeight = fontSize * 1.2;
        const lines = primitive.text.split('\n');
        const textWidth = Math.max(
          ...lines.map((line) => {
            // Приблизительная ширина: 0.55 от высоты символа
            return line.length * fontSize * 0.55;
          }),
        );
        const textHeight = lines.length * lineHeight;
        let minX = pos.x;
        if (primitive.textAlign === 'center') minX = pos.x - textWidth / 2;
        else if (primitive.textAlign === 'right') minX = pos.x - textWidth;
        const minY = pos.y;
        const maxX = minX + textWidth;
        const maxY = pos.y + textHeight;
        if (
          world.x >= minX - thresholdWorld &&
          world.x <= maxX + thresholdWorld &&
          world.y >= minY - thresholdWorld &&
          world.y <= maxY + thresholdWorld
        ) {
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          const distWorld = Math.hypot(world.x - cx, world.y - cy);
          if (!best || distWorld < best.distWorld) {
            best = { primitive, distWorld };
          }
        }
      } else if (primitive.type === 'table') {
        if (!primitive.table || points.length === 0) continue;
        const origin = points[0];
        const totalW = primitive.table.columnWidths.reduce((a, b) => a + b, 0);
        const totalH = primitive.table.rowHeights.reduce((a, b) => a + b, 0);
        if (
          world.x >= origin.x - thresholdWorld &&
          world.x <= origin.x + totalW + thresholdWorld &&
          world.y >= origin.y - thresholdWorld &&
          world.y <= origin.y + totalH + thresholdWorld
        ) {
          const cx = origin.x + totalW / 2;
          const cy = origin.y + totalH / 2;
          const distWorld = Math.hypot(world.x - cx, world.y - cy);
          if (!best || distWorld < best.distWorld) {
            best = { primitive, distWorld };
          }
        }
      }
    }

    return best?.primitive ?? null;
  }
}
