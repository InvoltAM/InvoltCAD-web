import { Plan } from '../model/Plan';
import { SerializedPlan, serializePlan, deserializePlan } from '@/lib/projects/serializer';
import { Vector2 } from '../geometry/Vector2';

export type TemplateType = 'project' | 'room' | 'device';

export interface ProjectTemplateData {
  id: string;
  name: string;
  description?: string;
  category: string;
  templateType: TemplateType;
  isBuiltin: boolean;
  thumbnail?: string;
  data: TemplatePayload;
  price?: number;
  currency?: string;
  published?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplatePayload {
  version: 1;
  type: TemplateType;
  plan: SerializedPlan;
  bounds?: { min: { x: number; y: number }; max: { x: number; y: number } };
}

export interface ApplyTemplateOptions {
  mode: 'replace' | 'merge';
  offsetMm?: { x: number; y: number };
}

export function createTemplateFromPlan(
  plan: Plan,
  type: TemplateType,
  name: string,
  description?: string,
  category = 'other',
): ProjectTemplateData {
  const serialized = serializePlan(plan);
  const bounds = plan.getBounds(0);
  return {
    id: crypto.randomUUID(),
    name,
    description,
    category,
    templateType: type,
    isBuiltin: false,
    data: {
      version: 1,
      type,
      plan: serialized,
      bounds: { min: { x: bounds.min.x, y: bounds.min.y }, max: { x: bounds.max.x, y: bounds.max.y } },
    },
  };
}

export function applyTemplateToPlan(plan: Plan, template: ProjectTemplateData, options: ApplyTemplateOptions = { mode: 'replace' }): void {
  const payload = template.data;
  if (!payload || payload.version !== 1 || !payload.plan) {
    throw new Error('Некорректный формат шаблона');
  }

  const imported = deserializePlan(payload.plan);
  const offset = options.offsetMm ?? { x: 0, y: 0 };

  if (options.mode === 'replace') {
    plan.walls = [];
    plan.devices = [];
    plan.cables = [];
    plan.dimensions = [];
    plan.sheets = imported.sheets.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      devices: offsetDevices(s.devices, offset),
      cables: s.cables.map((c) => ({ ...c, id: crypto.randomUUID() })),
      dimensions: offsetDimensions(s.dimensions, offset),
    }));
    plan.activeSheetId = plan.sheets[0]?.id ?? '';
    plan.walls = imported.walls.map((w) => ({
      ...w,
      id: crypto.randomUUID(),
      a: w.a.add(new Vector2(offset.x, offset.y)),
      b: w.b.add(new Vector2(offset.x, offset.y)),
      openings: w.openings.map((o) => ({ ...o, id: crypto.randomUUID(), wallId: '' })),
    }));
    // fix wallId in openings
    for (let i = 0; i < plan.walls.length; i++) {
      const wall = plan.walls[i];
      for (const o of wall.openings) {
        o.wallId = wall.id;
      }
    }
    plan.electrical = imported.electrical ?? { consumers: [], circuits: [], distributionBoards: [], cableRuns: [], priceItems: [], priceWorkItems: [], estimates: [], invoices: [], documents: [], automationConfigs: [] };
    plan.invalidateRooms();
    return;
  }

  // merge mode: append walls, sheets etc.
  const existingSheet = plan.activeSheet;
  for (const wall of imported.walls) {
    const newWall = {
      ...wall,
      id: crypto.randomUUID(),
      a: wall.a.add(new Vector2(offset.x, offset.y)),
      b: wall.b.add(new Vector2(offset.x, offset.y)),
      openings: wall.openings.map((o) => ({ ...o, id: crypto.randomUUID(), wallId: '' })),
    };
    newWall.openings.forEach((o) => (o.wallId = newWall.id));
    plan.walls.push(newWall);
  }
  for (const device of imported.devices) {
    existingSheet.devices.push({ ...device, id: crypto.randomUUID(), position: device.position ? { x: device.position.x + offset.x, y: device.position.y + offset.y } : undefined });
  }
  for (const cable of imported.cables) {
    existingSheet.cables.push({ ...cable, id: crypto.randomUUID() });
  }
  for (const dimension of imported.dimensions) {
    existingSheet.dimensions.push({
      ...dimension,
      id: crypto.randomUUID(),
      a: dimension.a.add(new Vector2(offset.x, offset.y)),
      b: dimension.b.add(new Vector2(offset.x, offset.y)),
    });
  }
  plan.invalidateRooms();
}

function offsetDevices(devices: any[], offset: { x: number; y: number }): any[] {
  return devices.map((d) => ({
    ...d,
    id: crypto.randomUUID(),
    position: d.position ? { x: d.position.x + offset.x, y: d.position.y + offset.y } : undefined,
  }));
}

function offsetDimensions(dimensions: any[], offset: { x: number; y: number }): any[] {
  return dimensions.map((d) => ({
    ...d,
    id: crypto.randomUUID(),
    a: { x: d.a.x + offset.x, y: d.a.y + offset.y },
    b: { x: d.b.x + offset.x, y: d.b.y + offset.y },
  }));
}

export function exportTemplateToJson(template: ProjectTemplateData): string {
  return JSON.stringify({
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    templateType: template.templateType,
    data: template.data,
  }, null, 2);
}

export function importTemplateFromJson(text: string): ProjectTemplateData {
  const parsed = JSON.parse(text);
  if (!parsed.data || parsed.data.version !== 1 || !parsed.data.plan) {
    throw new Error('Некорректный JSON-файл шаблона');
  }
  return {
    id: parsed.id || crypto.randomUUID(),
    name: parsed.name || 'Импортированный шаблон',
    description: parsed.description,
    category: parsed.category || 'other',
    templateType: parsed.templateType || 'project',
    isBuiltin: false,
    data: parsed.data,
  };
}

export function builtinTemplates(): ProjectTemplateData[] {
  return [
    createSingleRoomTemplate(),
    createTwoRoomTemplate(),
    createOfficeCellTemplate(),
  ];
}

function createSingleRoomTemplate(): ProjectTemplateData {
  const id = 'builtin-single-room';
  const plan: SerializedPlan = {
    walls: [
      { id: 'w1', startX: 0, startY: 0, endX: 5000, endY: 0, thickness: 200 },
      { id: 'w2', startX: 5000, startY: 0, endX: 5000, endY: 4000, thickness: 200 },
      { id: 'w3', startX: 5000, startY: 4000, endX: 0, endY: 4000, thickness: 200 },
      { id: 'w4', startX: 0, startY: 4000, endX: 0, endY: 0, thickness: 200 },
    ],
    openings: [],
    devices: [
      { id: 'd1', deviceType: 'socket', name: 'Розетка 1', wallId: 'w1', t: 0.2, side: 1, offset: 0, rotation: 0 },
      { id: 'd2', deviceType: 'socket', name: 'Розетка 2', wallId: 'w1', t: 0.8, side: 1, offset: 0, rotation: 0 },
      { id: 'd3', deviceType: 'light', name: 'Свет', wallId: '', t: 0, side: 1, offset: 0, rotation: 0, position: { x: 2500, y: 2000 } },
    ],
    cables: [],
    dimensions: [],
    electrical: {
      consumers: [], circuits: [], distributionBoards: [], cableRuns: [],
      priceItems: [], priceWorkItems: [], estimates: [], invoices: [], documents: [], automationConfigs: [],
    },
  };
  return {
    id,
    name: 'Комната 5×4 м',
    description: 'Однокомнатный шаблон с двумя розетками и светильником',
    category: 'room',
    templateType: 'room',
    isBuiltin: true,
    data: { version: 1, type: 'room', plan, bounds: { min: { x: 0, y: 0 }, max: { x: 5000, y: 4000 } } },
  };
}

function createTwoRoomTemplate(): ProjectTemplateData {
  const id = 'builtin-two-room';
  const plan: SerializedPlan = {
    walls: [
      { id: 'w1', startX: 0, startY: 0, endX: 6000, endY: 0, thickness: 200 },
      { id: 'w2', startX: 6000, startY: 0, endX: 6000, endY: 3000, thickness: 200 },
      { id: 'w3', startX: 6000, startY: 3000, endX: 3000, endY: 3000, thickness: 200 },
      { id: 'w4', startX: 3000, startY: 3000, endX: 3000, endY: 6000, thickness: 200 },
      { id: 'w5', startX: 3000, startY: 6000, endX: 0, endY: 6000, thickness: 200 },
      { id: 'w6', startX: 0, startY: 6000, endX: 0, endY: 0, thickness: 200 },
      { id: 'w7', startX: 3000, startY: 0, endX: 3000, endY: 3000, thickness: 200 },
    ],
    openings: [
      { id: 'o1', wallId: 'w7', t: 0.5, width: 900, type: 'door', height: 2000, swingSide: 'left', openDir: 1 },
    ],
    devices: [
      { id: 'd1', deviceType: 'socket', name: 'Розетка гостиная', wallId: 'w1', t: 0.3, side: 1, offset: 0, rotation: 0 },
      { id: 'd2', deviceType: 'socket', name: 'Розетка спальня', wallId: 'w3', t: 0.7, side: 1, offset: 0, rotation: 0 },
      { id: 'd3', deviceType: 'light', name: 'Свет гостиная', wallId: '', t: 0, side: 1, offset: 0, rotation: 0, position: { x: 1500, y: 1500 } },
      { id: 'd4', deviceType: 'light', name: 'Свет спальня', wallId: '', t: 0, side: 1, offset: 0, rotation: 0, position: { x: 4500, y: 4500 } },
    ],
    cables: [],
    dimensions: [],
    electrical: {
      consumers: [], circuits: [], distributionBoards: [], cableRuns: [],
      priceItems: [], priceWorkItems: [], estimates: [], invoices: [], documents: [], automationConfigs: [],
    },
  };
  return {
    id,
    name: '2-комнатная квартира 6×6 м',
    description: 'Двухкомнатный шаблон с дверью и базовыми устройствами',
    category: 'apartment',
    templateType: 'project',
    isBuiltin: true,
    data: { version: 1, type: 'project', plan, bounds: { min: { x: 0, y: 0 }, max: { x: 6000, y: 6000 } } },
  };
}

function createOfficeCellTemplate(): ProjectTemplateData {
  const id = 'builtin-office-cell';
  const plan: SerializedPlan = {
    walls: [
      { id: 'w1', startX: 0, startY: 0, endX: 4000, endY: 0, thickness: 150 },
      { id: 'w2', startX: 4000, startY: 0, endX: 4000, endY: 3000, thickness: 150 },
      { id: 'w3', startX: 4000, startY: 3000, endX: 0, endY: 3000, thickness: 150 },
      { id: 'w4', startX: 0, startY: 3000, endX: 0, endY: 0, thickness: 150 },
    ],
    openings: [
      { id: 'o1', wallId: 'w1', t: 0.5, width: 900, type: 'door', height: 2000, swingSide: 'left', openDir: 1 },
    ],
    devices: [
      { id: 'd1', deviceType: 'socket', name: 'Розетка рабочая', wallId: 'w2', t: 0.3, side: -1, offset: 0, rotation: 0 },
      { id: 'd2', deviceType: 'socket', name: 'Розетка рабочая', wallId: 'w2', t: 0.7, side: -1, offset: 0, rotation: 0 },
      { id: 'd3', deviceType: 'light', name: 'Свет', wallId: '', t: 0, side: 1, offset: 0, rotation: 0, position: { x: 2000, y: 1500 } },
    ],
    cables: [],
    dimensions: [],
    electrical: {
      consumers: [], circuits: [], distributionBoards: [], cableRuns: [],
      priceItems: [], priceWorkItems: [], estimates: [], invoices: [], documents: [], automationConfigs: [],
    },
  };
  return {
    id,
    name: 'Офисная ячейка 4×3 м',
    description: 'Маленький офис с двумя розетками и светильником',
    category: 'office',
    templateType: 'room',
    isBuiltin: true,
    data: { version: 1, type: 'room', plan, bounds: { min: { x: 0, y: 0 }, max: { x: 4000, y: 3000 } } },
  };
}
