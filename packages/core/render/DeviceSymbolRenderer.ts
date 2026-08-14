import type { DeviceType } from '../model/Device';
import { DEVICE_LABELS } from '../model/Device';

/**
 * Рисует условное графическое обозначение устройства в центре текущей
 * canvas-системы координат. Размер символа масштабируется относительно
 * переданного размера `size` (сторона квадрата иконки в мировых единицах).
 */
export function drawDeviceSymbol(
  ctx: CanvasRenderingContext2D,
  type: DeviceType,
  size: number,
): void {
  const s = size * 0.75;
  const half = s / 2;

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
