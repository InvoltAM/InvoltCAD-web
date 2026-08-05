import { Plan } from '../model/Plan';
import { Device } from '../model/Device';
import { Room } from '../geometry/RoomDetector';
import { Vector2 } from '../geometry/Vector2';

export interface RoomData {
  id: string;
  name: string;
  polygon: Vector2[];
  area: number;
  centroid: Vector2;
  devices: Device[];
  consumers: ConsumerData[];
}

export interface ConsumerData {
  id: string;
  name: string;
  category: ConsumerCategory;
  type: string;
  powerW: number;
  voltage: number;
  count: number;
  demandRatio: number;
  roomId?: string;
  deviceId?: string;
  phase: 'L1' | 'L2' | 'L3';
}

export type ConsumerCategory = 'socket' | 'switch' | 'light' | 'appliance' | 'lowcurrent' | 'heating';

export interface CircuitData {
  id: string;
  name: string;
  type: CircuitType;
  ratedCurrentA: number;
  breakerType: 'B' | 'C' | 'D' | 'dif' | 'dif-selective';
  cableType: string;
  crossSectionMm2: number;
  lengthM: number;
  phase: 'L1' | 'L2' | 'L3';
  color: string;
  consumers: ConsumerData[];
}

export type CircuitType = 'socket' | 'lighting' | 'appliance' | 'heating' | 'lowcurrent';

function stableRoomId(polygon: Vector2[]): string {
  let hash = 0;
  for (const p of polygon) {
    const combined = String(Math.round(p.x * 100)) + ',' + String(Math.round(p.y * 100));
    for (let i = 0; i < combined.length; i++) {
      hash = (hash << 5) - hash + combined.charCodeAt(i);
      hash |= 0;
    }
  }
  return 'room-' + Math.abs(hash).toString(36);
}

const DEFAULT_ROOM_NAMES = [
  'Гостиная',
  'Спальня',
  'Кухня',
  'Ванная',
  'Прихожая',
  'Коридор',
  'Детская',
  'Кабинет',
  'Санузел',
  'Балкон',
  'Кладовка',
  'Комната',
];

export function pointInPolygon(point: Vector2, polygon: Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersect =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y + 1e-9) + pi.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function buildRoomData(plan: Plan, existingConsumers: ConsumerData[] = []): RoomData[] {
  const rooms = plan.getRooms();
  const roomData: RoomData[] = rooms.map((room, index) => {
    const centroid = room.polygon.reduce((sum, p) => sum.add(p), new Vector2(0, 0)).scale(1 / (room.polygon.length || 1));
    return {
      id: stableRoomId(room.polygon),
      name: DEFAULT_ROOM_NAMES[index % DEFAULT_ROOM_NAMES.length] || `Комната ${index + 1}`,
      polygon: room.polygon.map((p) => p.clone()),
      area: room.area,
      centroid,
      devices: [],
      consumers: [],
    };
  });

  // Assign devices to rooms by their world position
  for (const device of plan.devices) {
    const pos = plan.deviceWorldPosition(device);
    if (!pos) continue;
    for (const room of roomData) {
      if (pointInPolygon(pos, room.polygon)) {
        room.devices.push(device);
        break;
      }
    }
  }

  // Assign existing consumers to rooms
  for (const consumer of existingConsumers) {
    if (consumer.roomId) {
      const room = roomData.find((r) => r.id === consumer.roomId);
      if (room) room.consumers.push(consumer);
      continue;
    }
    if (consumer.deviceId) {
      const device = plan.devices.find((d) => d.id === consumer.deviceId);
      const pos = device ? plan.deviceWorldPosition(device) : null;
      if (pos) {
        for (const room of roomData) {
          if (pointInPolygon(pos, room.polygon)) {
            room.consumers.push({ ...consumer, roomId: room.id });
            break;
          }
        }
      }
    }
  }

  return roomData;
}

export function deviceToConsumer(device: Device, roomId?: string): ConsumerData {
  const category = guessCategoryFromDeviceType(device.type);
  return {
    id: crypto.randomUUID(),
    name: device.name,
    category,
    type: device.type,
    powerW: defaultPowerW(category, device.type),
    voltage: 230,
    count: 1,
    demandRatio: 1,
    deviceId: device.id,
    roomId,
    phase: 'L1',
  };
}

export function guessCategoryFromDeviceType(type: string): ConsumerCategory {
  if (type.startsWith('socket')) return 'socket';
  if (type.startsWith('switch')) return 'switch';
  if (type.includes('light') || type === 'light') return 'light';
  if (type === 'panel' || type === 'breaker') return 'appliance';
  return 'lowcurrent';
}

export function defaultPowerW(category: ConsumerCategory, type?: string): number {
  switch (category) {
    case 'socket':
      if (type?.includes('usb')) return 15;
      if (type?.includes('uz')) return 2500;
      return 2200;
    case 'light':
      return 60;
    case 'switch':
      return 0;
    case 'appliance':
      return 3500;
    case 'heating':
      return 2000;
    case 'lowcurrent':
    default:
      return 50;
  }
}

export function groupConsumersToCircuits(consumers: ConsumerData[]): CircuitData[] {
  // Group by category and target circuit type
  const groups: Record<string, ConsumerData[]> = {};
  for (const c of consumers) {
    const key = c.category;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }

  const circuits: CircuitData[] = [];

  // Sockets: up to 6 sockets per circuit
  const sockets = groups['socket'] || [];
  for (let i = 0; i < sockets.length; i += 6) {
    const group = sockets.slice(i, i + 6);
    const totalPower = group.reduce((sum, c) => sum + c.powerW * c.count * c.demandRatio, 0);
    circuits.push({
      id: crypto.randomUUID(),
      name: `Розетки ${Math.floor(i / 6) + 1}`,
      type: 'socket',
      ratedCurrentA: Math.max(16, Math.ceil((totalPower / 230) * 1.25 / 5) * 5),
      breakerType: totalPower > 2500 ? 'C' : 'B',
      cableType: 'ВВГнг(А)-LS 3x2.5',
      crossSectionMm2: 2.5,
      lengthM: 0,
      phase: 'L1',
      color: '#3b82f6',
      consumers: group,
    });
  }

  // Lighting: one room per circuit, but merged if total power small
  const lights = groups['light'] || [];
  const byRoom: Record<string, ConsumerData[]> = {};
  for (const l of lights) {
    if (!l.roomId) continue;
    if (!byRoom[l.roomId]) byRoom[l.roomId] = [];
    byRoom[l.roomId].push(l);
  }
  for (const roomId of Object.keys(byRoom)) {
    const group = byRoom[roomId];
    const totalPower = group.reduce((sum, c) => sum + c.powerW * c.count * c.demandRatio, 0);
    circuits.push({
      id: crypto.randomUUID(),
      name: `Освещение`,
      type: 'lighting',
      ratedCurrentA: Math.max(10, Math.ceil((totalPower / 230) * 1.25 / 5) * 5),
      breakerType: 'B',
      cableType: 'ВВГнг(А)-LS 3x1.5',
      crossSectionMm2: 1.5,
      lengthM: 0,
      phase: 'L1',
      color: '#eab308',
      consumers: group,
    });
  }

  // Appliances: each dedicated
  const appliances = groups['appliance'] || [];
  for (const c of appliances) {
    const totalPower = c.powerW * c.count * c.demandRatio;
    circuits.push({
      id: crypto.randomUUID(),
      name: c.name || 'Мощная техника',
      type: 'appliance',
      ratedCurrentA: Math.max(16, Math.ceil((totalPower / 230) * 1.25 / 5) * 5),
      breakerType: totalPower > 2500 ? 'C' : 'B',
      cableType: totalPower > 3500 ? 'ВВГнг(А)-LS 3x6' : 'ВВГнг(А)-LS 3x2.5',
      crossSectionMm2: totalPower > 3500 ? 6 : 2.5,
      lengthM: 0,
      phase: 'L1',
      color: '#ef4444',
      consumers: [c],
    });
  }

  // Heating: group by room
  const heating = groups['heating'] || [];
  const heatByRoom: Record<string, ConsumerData[]> = {};
  for (const h of heating) {
    if (!h.roomId) continue;
    if (!heatByRoom[h.roomId]) heatByRoom[h.roomId] = [];
    heatByRoom[h.roomId].push(h);
  }
  for (const roomId of Object.keys(heatByRoom)) {
    const group = heatByRoom[roomId];
    const totalPower = group.reduce((sum, c) => sum + c.powerW * c.count * c.demandRatio, 0);
    circuits.push({
      id: crypto.randomUUID(),
      name: 'Теплый пол',
      type: 'heating',
      ratedCurrentA: Math.max(16, Math.ceil((totalPower / 230) * 1.25 / 5) * 5),
      breakerType: 'C',
      cableType: 'ВВГнг(А)-LS 3x2.5',
      crossSectionMm2: 2.5,
      lengthM: 0,
      phase: 'L1',
      color: '#f97316',
      consumers: group,
    });
  }

  // Low current: one circuit
  const low = groups['lowcurrent'] || [];
  if (low.length > 0) {
    circuits.push({
      id: crypto.randomUUID(),
      name: 'Слаботочка',
      type: 'lowcurrent',
      ratedCurrentA: 6,
      breakerType: 'B',
      cableType: 'UTP Cat.5e',
      crossSectionMm2: 0,
      lengthM: 0,
      phase: 'L1',
      color: '#22c55e',
      consumers: low,
    });
  }

  return circuits;
}

export function estimateCircuitLength(circuit: CircuitData, rooms: RoomData[]): number {
  // Naive estimate: from board location (first room centroid or 0,0) to each consumer centroid
  let total = 0;
  const boardRoom = rooms[0];
  const boardPos = boardRoom ? boardRoom.centroid : new Vector2(0, 0);
  for (const c of circuit.consumers) {
    const room = rooms.find((r) => r.id === c.roomId);
    const pos = room ? room.centroid : boardPos;
    total += boardPos.distanceTo(pos) / 1000; // mm -> m
  }
  // Add 15% reserve
  return Math.round(total * 1.15);
}
