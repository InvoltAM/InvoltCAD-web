import type { DeviceType } from '../model/Device';
import { DEVICE_LABELS } from '../model/Device';
import type { CustomDevice } from '../model/CustomDevice';
import type { DrawingPrimitive } from '../model/DrawingPrimitive';
import { Vector2 } from '../geometry/Vector2';

/**
 * Рисует условное графическое обозначение устройства в центре текущей
 * canvas-системы координат. Размер символа масштабируется относительно
 * переданного размера `size` (сторона квадрата иконки в мировых единицах).
 *
 * Для пользовательских устройств (`custom-<id>`) нужно передать массив
 * `customDevices`, иначе отобразится fallback-иконка.
 */
export function drawDeviceSymbol(
  ctx: CanvasRenderingContext2D,
  type: DeviceType,
  size: number,
  customDevices?: CustomDevice[],
): void {
  const s = size * 0.75;
  const half = s / 2;

  if (type.startsWith('custom-')) {
    const id = type.slice('custom-'.length);
    const device = customDevices?.find((d) => d.id === id);
    if (device && device.primitives.length > 0) {
      drawCustomDeviceSymbol(ctx, device.primitives, size);
      return;
    }
  }

  switch (type) {
    case 'socket-ip21':
    case 'socket-ip44': {
      // Корпус / монтажная коробка
      ctx.strokeRect(-half, -half, s, s);
      // Лицевая панель — круг
      ctx.beginPath();
      ctx.arc(0, -2, s * 0.28, 0, Math.PI * 2);
      ctx.stroke();
      // Контакты: PE сверху, L слева снизу, N справа снизу
      const r = s * 0.055;
      ctx.beginPath();
      ctx.arc(0, -2 - s * 0.14, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-s * 0.14, -2 + s * 0.09, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s * 0.14, -2 + s * 0.09, r, 0, Math.PI * 2);
      ctx.fill();
      // Заземление
      ctx.beginPath();
      ctx.moveTo(0, -2 + s * 0.09 + r);
      ctx.lineTo(0, half - s * 0.08);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.18, half - s * 0.08);
      ctx.lineTo(s * 0.18, half - s * 0.08);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.1, half - s * 0.02);
      ctx.lineTo(s * 0.1, half - s * 0.02);
      ctx.stroke();
      if (type === 'socket-ip44') {
        ctx.font = `${s * 0.16}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('IP44', 0, half + 2);
      }
      break;
    }
    default: {
      // Fallback на текстовую иконку из каталога
      ctx.font = `${size * 0.55}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(DEVICE_LABELS[type], 0, 0);
      break;
    }
  }
}

/** Рисует примитивы пользовательского символа, отмасштабированные и отцентрированные. */
function drawCustomDeviceSymbol(
  ctx: CanvasRenderingContext2D,
  primitives: DrawingPrimitive[],
  size: number,
): void {
  const { scale, offset } = fitPrimitives(primitives, size);

  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.scale(scale, scale);

  for (const primitive of primitives) {
    drawPrimitivePath(ctx, primitive);
  }

  ctx.restore();
}

/** Рассчитывает масштаб и смещение для вписания примитивов в квадрат `size`. */
function fitPrimitives(
  primitives: DrawingPrimitive[],
  size: number,
): { bounds: { min: Vector2; max: Vector2 }; scale: number; offset: Vector2 } {
  const points = primitives.flatMap((p) => p.points);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return {
      bounds: { min: new Vector2(0, 0), max: new Vector2(0, 0) },
      scale: 1,
      offset: new Vector2(0, 0),
    };
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const padding = size * 0.1;
  const available = size - padding * 2;
  const scale = Math.min(available / width, available / height, 1);

  const boundsCenterX = (minX + maxX) / 2;
  const boundsCenterY = (minY + maxY) / 2;
  const offset = new Vector2(-boundsCenterX * scale, -boundsCenterY * scale);

  return {
    bounds: { min: new Vector2(minX, minY), max: new Vector2(maxX, maxY) },
    scale,
    offset,
  };
}

/** Рисует один примитив (только контур). */
function drawPrimitivePath(ctx: CanvasRenderingContext2D, primitive: DrawingPrimitive): void {
  const points = primitive.points;
  if (points.length === 0) return;

  ctx.beginPath();
  switch (primitive.type) {
    case 'segment':
    case 'polyline': {
      if (points.length < 2) break;
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      break;
    }
    case 'rectangle': {
      if (points.length < 2) break;
      const x = Math.min(points[0].x, points[1].x);
      const y = Math.min(points[0].y, points[1].y);
      const w = Math.abs(points[1].x - points[0].x);
      const h = Math.abs(points[1].y - points[0].y);
      ctx.strokeRect(x, y, w, h);
      break;
    }
    case 'circle': {
      if (points.length < 2) break;
      const radius = points[0].distanceTo(points[1]);
      ctx.arc(points[0].x, points[0].y, radius, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
  }
}

/**
 * Возвращает SVG-разметку для превью пользовательского устройства.
 * Используется в React-палитре, чтобы значок в кнопке совпадал
 * с символом на плане.
 */
export function customDeviceToSvg(
  primitives: DrawingPrimitive[],
  size: number,
): string {
  const { scale, offset } = fitPrimitives(primitives, size);
  const s = size;
  let paths = '';

  for (const primitive of primitives) {
    const points = primitive.points;
    if (points.length === 0) continue;
    const toSvg = (p: Vector2) => {
      const x = p.x * scale + offset.x + s / 2;
      const y = p.y * scale + offset.y + s / 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    };

    switch (primitive.type) {
      case 'segment':
      case 'polyline': {
        if (points.length < 2) continue;
        paths += `<polyline points="${points.map(toSvg).join(' ')}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
        break;
      }
      case 'rectangle': {
        if (points.length < 2) continue;
        const x1 = points[0].x * scale + offset.x + s / 2;
        const y1 = points[0].y * scale + offset.y + s / 2;
        const x2 = points[1].x * scale + offset.x + s / 2;
        const y2 = points[1].y * scale + offset.y + s / 2;
        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        const w = Math.abs(x2 - x1);
        const h = Math.abs(y2 - y1);
        paths += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="none" stroke="currentColor" stroke-width="1.5"/>`;
        break;
      }
      case 'circle': {
        if (points.length < 2) continue;
        const center = points[0];
        const rim = points[1];
        const cx = center.x * scale + offset.x + s / 2;
        const cy = center.y * scale + offset.y + s / 2;
        const r = center.distanceTo(rim) * scale;
        paths += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="none" stroke="currentColor" stroke-width="1.5"/>`;
        break;
      }
    }
  }

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
}
