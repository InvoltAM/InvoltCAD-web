export type IecPrefix = 'QF' | 'Q' | 'S' | 'R' | 'E' | 'L' | 'W' | 'X' | 'G' | 'PE' | 'N' | 'KM' | 'K' | 'T' | 'M' | 'A' | 'F';

export interface DeviceLabel {
  id: string;
  objectId: string;
  kind: 'device' | 'cable' | 'breaker' | 'rcd' | 'contactor' | 'busbar' | 'terminal' | 'room' | 'consumer' | 'circuit';
  prefix: IecPrefix | string;
  number: number;
  suffix?: string;
  fullName: string;
  description: string;
  quantity: number;
  // printable size in mm
  widthMm: number;
  heightMm: number;
}

export interface LabelSheet {
  pageWidthMm: number;
  pageHeightMm: number;
  labels: Array<DeviceLabel & { x: number; y: number }>;
}

const DEFAULT_PREFIXES: Record<string, string> = {
  socket: 'R',
  switch: 'S',
  light: 'E',
  outlet: 'R',
  appliance: 'X',
  lowcurrent: 'G',
  heating: 'M',
  breaker: 'QF',
  rcd: 'Q',
  contactor: 'KM',
  busbar: 'PE',
  terminal: 'X',
  cable: 'W',
  circuit: 'L',
};

export function detectPrefix(type: string): string {
  return DEFAULT_PREFIXES[type] ?? 'X';
}

export function buildIecLabels(options: {
  devices: Array<{ id: string; type: string; name: string; roomName?: string }>;
  cables?: Array<{ id: string; type: string; name?: string }>;
  circuits?: Array<{ id: string; name: string; type: string }>;
  breakers?: Array<{ id: string; name: string; type: string; rating?: number }>;
  startingNumbers?: Partial<Record<string, number>>;
}): DeviceLabel[] {
  const labels: DeviceLabel[] = [];
  const counters: Record<string, number> = {};
  if (options.startingNumbers) {
    for (const [key, value] of Object.entries(options.startingNumbers)) {
      if (typeof value === 'number') counters[key] = value;
    }
  }

  const nextNumber = (prefix: string): number => {
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    return counters[prefix]!;
  };

  for (const device of options.devices) {
    const prefix = detectPrefix(device.type);
    const n = nextNumber(prefix);
    const suffix = device.roomName ? `.${device.roomName.slice(0, 3).toUpperCase()}` : '';
    labels.push({
      id: `device-${device.id}`,
      objectId: device.id,
      kind: 'device',
      prefix,
      number: n,
      suffix,
      fullName: `${prefix}${n}${suffix}`,
      description: device.name || `${prefix}${n}`,
      quantity: 1,
      widthMm: 18,
      heightMm: 38,
    });
  }

  for (const cable of options.cables ?? []) {
    const prefix = 'W';
    const n = nextNumber(prefix);
    labels.push({
      id: `cable-${cable.id}`,
      objectId: cable.id,
      kind: 'cable',
      prefix,
      number: n,
      fullName: `${prefix}${n}`,
      description: cable.name || `Кабель ${prefix}${n}`,
      quantity: 2, // две этикетки на концах
      widthMm: 12,
      heightMm: 50,
    });
  }

  for (const circuit of options.circuits ?? []) {
    const prefix = 'L';
    const n = nextNumber(prefix);
    labels.push({
      id: `circuit-${circuit.id}`,
      objectId: circuit.id,
      kind: 'circuit',
      prefix,
      number: n,
      fullName: `${prefix}${n}`,
      description: circuit.name || `Линия ${prefix}${n}`,
      quantity: 1,
      widthMm: 18,
      heightMm: 38,
    });
  }

  for (const breaker of options.breakers ?? []) {
    const prefix = breaker.type === 'breaker' ? 'QF' : breaker.type === 'rcd' ? 'Q' : breaker.type === 'contactor' ? 'KM' : 'X';
    const n = nextNumber(prefix);
    labels.push({
      id: `breaker-${breaker.id}`,
      objectId: breaker.id,
      kind: breaker.type === 'breaker' ? 'breaker' : breaker.type === 'rcd' ? 'rcd' : breaker.type === 'contactor' ? 'contactor' : 'device',
      prefix,
      number: n,
      fullName: `${prefix}${n}`,
      description: breaker.name || `${prefix}${n}`,
      quantity: 1,
      widthMm: 12,
      heightMm: 50,
    });
  }

  return labels;
}

export function layoutLabelsOnA4(labels: DeviceLabel[]): LabelSheet {
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const gap = 2;
  let x = margin;
  let y = margin;
  let rowHeight = 0;

  const placed: LabelSheet['labels'] = [];

  for (const label of labels) {
    for (let i = 0; i < label.quantity; i++) {
      if (x + label.widthMm > pageWidth - margin) {
        x = margin;
        y += rowHeight + gap;
        rowHeight = 0;
      }
      if (y + label.heightMm > pageHeight - margin) {
        // start new sheet - for simplicity we still place on same sheet (user can paginate)
        y = margin;
      }
      placed.push({ ...label, x, y });
      x += label.widthMm + gap;
      rowHeight = Math.max(rowHeight, label.heightMm);
    }
  }

  return { pageWidthMm: pageWidth, pageHeightMm: pageHeight, labels: placed };
}

export function generateLabelsSvg(sheet: LabelSheet): string {
  const { pageWidthMm, pageHeightMm, labels } = sheet;
  const mmToPx = 3.7795275591; // 96 dpi
  const w = pageWidthMm * mmToPx;
  const h = pageHeightMm * mmToPx;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="font-family:Arial,Helvetica,sans-serif">`;
  svg += `<rect width="${w}" height="${h}" fill="white"/>`;

  for (const label of labels) {
    const lx = label.x * mmToPx;
    const ly = label.y * mmToPx;
    const lw = label.widthMm * mmToPx;
    const lh = label.heightMm * mmToPx;
    svg += `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" fill="white" stroke="black" stroke-width="1"/>`;
    svg += `<text x="${lx + lw / 2}" y="${ly + lh / 2 - 4}" text-anchor="middle" font-size="${Math.min(lw / 4, 14)}" font-weight="bold" fill="black">${label.fullName}</text>`;
    svg += `<text x="${lx + lw / 2}" y="${ly + lh / 2 + 10}" text-anchor="middle" font-size="${Math.min(lw / 8, 8)}" fill="black">${label.description}</text>`;
  }

  svg += `</svg>`;
  return svg;
}

export function exportLabelsToCsv(labels: DeviceLabel[]): string {
  const header = ['Полное имя', 'Тип', 'Описание', 'Кол-во', 'Ширина,мм', 'Высота,мм'];
  const rows = labels.map((l) => [l.fullName, l.kind, l.description, String(l.quantity), String(l.widthMm), String(l.heightMm)]);
  return [header, ...rows].map((row) => row.join(';')).join('\n');
}
