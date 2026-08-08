import { Plan } from '../model/Plan';
import { Vector2 } from '../geometry/Vector2';
import { wallPolyline } from '../model/Wall';
import { findDeviceCatalogItem } from '../model/Device';

const LAYERS = [
  { name: 'WALLS', color: 7 },
  { name: 'OPENINGS', color: 1 },
  { name: 'DEVICES', color: 5 },
  { name: 'CABLES', color: 2 },
  { name: 'DIMENSIONS', color: 3 },
  { name: 'ROOMS', color: 8 },
];

function pair(code: number, value: string | number): string {
  return `${code}\n${value}\n`;
}

function point2d(x: number, y: number): string {
  // Редактор использует Y-down; DXF использует Y-up — инвертируем Y.
  return pair(10, x.toFixed(3)) + pair(20, (-y).toFixed(3));
}

function headerSection(): string {
  return (
    pair(0, 'SECTION') +
    pair(2, 'HEADER') +
    pair(9, '$INSUNITS') +
    pair(70, 4) +
    pair(0, 'ENDSEC')
  );
}

function tablesSection(): string {
  let s = pair(0, 'SECTION') + pair(2, 'TABLES') + pair(0, 'TABLE') + pair(2, 'LAYER') + pair(70, LAYERS.length);
  for (const layer of LAYERS) {
    s += pair(0, 'LAYER') + pair(2, layer.name) + pair(70, 0) + pair(62, layer.color) + pair(6, 'CONTINUOUS');
  }
  s += pair(0, 'ENDTAB') + pair(0, 'ENDSEC');
  return s;
}

function entitiesStart(): string {
  return pair(0, 'SECTION') + pair(2, 'ENTITIES');
}

function entitiesEnd(): string {
  return pair(0, 'ENDSEC');
}

function eof(): string {
  return pair(0, 'EOF');
}

function lwpolyline(points: Vector2[], layer: string, closed = false): string {
  let s = pair(0, 'LWPOLYLINE') + pair(8, layer) + pair(90, points.length) + pair(70, closed ? 1 : 0);
  for (const p of points) {
    s += point2d(p.x, p.y);
  }
  return s;
}

function line(a: Vector2, b: Vector2, layer: string): string {
  return pair(0, 'LINE') + pair(8, layer) + point2d(a.x, a.y) + pair(11, b.x.toFixed(3)) + pair(21, (-b.y).toFixed(3));
}

function circle(center: Vector2, radius: number, layer: string): string {
  return pair(0, 'CIRCLE') + pair(8, layer) + point2d(center.x, center.y) + pair(40, radius.toFixed(3));
}

function text(content: string, pos: Vector2, height: number, layer: string, rotation = 0): string {
  return (
    pair(0, 'TEXT') +
    pair(8, layer) +
    point2d(pos.x, pos.y) +
    pair(40, height.toFixed(3)) +
    pair(1, content) +
    pair(50, rotation.toFixed(3))
  );
}

function exportWalls(plan: Plan): string {
  let s = '';
  for (const wall of plan.walls) {
    const pts = wallPolyline(wall, 100);
    s += lwpolyline(pts, 'WALLS', false);
  }
  return s;
}

function exportOpenings(plan: Plan): string {
  let s = '';
  for (const wall of plan.walls) {
    const len = wall.a.distanceTo(wall.b);
    if (len === 0) continue;
    const dir = wall.b.sub(wall.a).scale(1 / len);
    for (const opening of wall.openings) {
      const center = wall.a.add(dir.scale(opening.t * len));
      const half = dir.scale(opening.width / 2);
      const a = center.sub(half);
      const b = center.add(half);
      s += line(a, b, 'OPENINGS');
    }
  }
  return s;
}

function exportDevices(plan: Plan): string {
  let s = '';
  for (const device of plan.devices) {
    const pos = plan.deviceWorldPosition(device);
    const item = findDeviceCatalogItem(device.type);
    const radius = item ? Math.max(item.width, item.height) / 2 : 50;
    s += circle(pos, radius, 'DEVICES');
    if (device.name) {
      s += text(device.name, pos.add(new Vector2(0, -radius - 10)), 12, 'DEVICES');
    }
  }
  return s;
}

function exportCables(plan: Plan): string {
  let s = '';
  for (const cable of plan.cables) {
    if (cable.route.length < 2) continue;
    s += lwpolyline(cable.route, 'CABLES', false);
  }
  return s;
}

function exportDimensions(plan: Plan): string {
  let s = '';
  for (const dim of plan.dimensions) {
    s += line(dim.a, dim.b, 'DIMENSIONS');
    const mid = dim.a.add(dim.b).scale(0.5);
    const label = dim.text ?? Math.round(dim.length).toString();
    s += text(label, mid, 12, 'DIMENSIONS');
  }
  return s;
}

function exportRooms(plan: Plan): string {
  let s = '';
  for (const room of plan.getRooms()) {
    if (room.polygon.length < 3) continue;
    s += lwpolyline(room.polygon, 'ROOMS', true);
  }
  return s;
}

function generateDxf(plan: Plan): string {
  return (
    headerSection() +
    tablesSection() +
    entitiesStart() +
    exportWalls(plan) +
    exportOpenings(plan) +
    exportDevices(plan) +
    exportCables(plan) +
    exportDimensions(plan) +
    exportRooms(plan) +
    entitiesEnd() +
    eof()
  );
}

/**
 * Экспорт плана в DXF-файл.
 * Генерирует минимальный DXF (ASCII) с осями стен, проёмами, устройствами,
 * кабелями, размерами и контурами комнат.
 */
export function exportToDxf(plan: Plan, filename = 'involtcad-plan.dxf'): void {
  const dxf = generateDxf(plan);
  const blob = new Blob([dxf], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
