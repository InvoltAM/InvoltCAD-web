import { Plan } from '../model/Plan';
import { Device, DeviceType, defaultDeviceHeight } from '../model/Device';
import { Room } from '../geometry/RoomDetector';
import { Vector2 } from '../geometry/Vector2';
import { pointInPolygon } from '../geometry/Geometry';
import {
  ValidationResult,
  addIssue,
  nextIssueId,
} from './ValidationTypes';

const SOCKET_TYPES: DeviceType[] = ['socket', 'socket-uz', 'socket-usb'];

function isSocket(type: DeviceType): boolean {
  return SOCKET_TYPES.includes(type);
}

function devicePosition(plan: Plan, device: Device): Vector2 {
  return plan.deviceWorldPosition(device);
}

/** Расстояние от точки устройства до ближайшего внутреннего угла комнаты. */
function distanceToNearestCorner(position: Vector2, roomPolygon: Vector2[]): number {
  let minDist = Infinity;
  for (const p of roomPolygon) {
    const d = position.distanceTo(p);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

/** Расстояние вдоль стены от устройства до ближайшей двери. */
function distanceToNearestDoor(plan: Plan, device: Device): number {
  const wall = plan.findWall(device.wallId);
  if (!wall) return Infinity;

  const len = wall.a.distanceTo(wall.b);
  if (len === 0) return Infinity;

  const deviceDist = device.t * len;
  let minDist = Infinity;

  for (const opening of wall.openings) {
    if (opening.type !== 'door') continue;
    const doorCenterDist = opening.t * len;
    const doorHalf = opening.width / 2;
    // Расстояние от центра устройства до ближайшей кромки двери
    const distToEdge = Math.abs(deviceDist - doorCenterDist) - doorHalf;
    if (distToEdge < minDist) minDist = distToEdge;
  }

  return minDist;
}

/** Проверка: устройство внутри комнаты (по внутреннему контуру). */
function findDeviceRoom(plan: Plan, device: Device, rooms: Room[]): number | null {
  const pos = devicePosition(plan, device);
  for (let i = 0; i < rooms.length; i++) {
    if (pointInPolygon(pos, rooms[i].polygon)) {
      return i;
    }
  }
  return null;
}

interface ExpectedHeight {
  expected: number;
  tolerance: number;
}

function expectedHeight(type: DeviceType): ExpectedHeight {
  switch (type) {
    case 'socket':
    case 'socket-uz':
    case 'socket-usb':
      return { expected: 300, tolerance: 50 };
    case 'switch':
    case 'switch-2':
      return { expected: 900, tolerance: 50 };
    case 'panel':
    case 'breaker':
      return { expected: 1500, tolerance: 100 };
    case 'light':
      return { expected: 2500, tolerance: 100 };
    default:
      return { expected: defaultDeviceHeight(type), tolerance: 50 };
  }
}

/**
 * Проверяет расстановку устройств.
 * - Минимальное количество розеток в комнате.
 * - Расстояние от углов и дверей.
 * - Высота установки.
 */
export function validateDevices(plan: Plan, rooms: Room[]): ValidationResult {
  const result: ValidationResult = { issues: [], errors: 0, warnings: 0, infos: 0 };

  // Группируем устройства по комнатам
  const devicesByRoom: Map<number, Device[]> = new Map();
  for (const device of plan.devices) {
    const roomIndex = findDeviceRoom(plan, device, rooms);
    if (roomIndex !== null) {
      if (!devicesByRoom.has(roomIndex)) devicesByRoom.set(roomIndex, []);
      devicesByRoom.get(roomIndex)!.push(device);
    }
  }

  // Минимальное количество розеток
  const MIN_ROOM_AREA_MM2 = 2_000_000; // 2 м²
  const SOCKETS_PER_10M2 = 1;
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    if (room.area < MIN_ROOM_AREA_MM2) continue;

    const devicesInRoom = devicesByRoom.get(i) ?? [];
    const socketCount = devicesInRoom.filter(d => isSocket(d.type)).length;
    const required = 1 + Math.ceil(room.area / 10_000_000) * SOCKETS_PER_10M2;

    if (socketCount < required) {
      addIssue(result, {
        id: nextIssueId(),
        type: 'room',
        severity: 'warning',
        message: `Комната ${i + 1}: рекомендуется минимум ${required} розетка(и), найдено ${socketCount}`,
        roomIndex: i,
        position: polygonCentroid(room.polygon),
      });
    }
  }

  // Расстояния и высота для каждого устройства
  const MIN_CORNER_DISTANCE = 100; // мм
  const MIN_DOOR_DISTANCE = 150; // мм

  for (const device of plan.devices) {
    const roomIndex = findDeviceRoom(plan, device, rooms);
    const pos = devicePosition(plan, device);

    // Расстояние от углов
    if (roomIndex !== null) {
      const cornerDist = distanceToNearestCorner(pos, rooms[roomIndex].polygon);
      if (cornerDist < MIN_CORNER_DISTANCE) {
        addIssue(result, {
          id: nextIssueId(),
          type: 'device',
          severity: 'warning',
          message: `Устройство "${device.name}" слишком близко к углу комнаты (${Math.round(cornerDist)} мм)`,
          objectId: device.id,
          position: pos,
        });
      }
    }

    // Расстояние от дверей
    const doorDist = distanceToNearestDoor(plan, device);
    if (doorDist < MIN_DOOR_DISTANCE) {
      addIssue(result, {
        id: nextIssueId(),
        type: 'device',
        severity: 'warning',
        message: `Устройство "${device.name}" слишком близко к двери (${Math.round(doorDist)} мм)`,
        objectId: device.id,
        position: pos,
      });
    }

    // Высота установки
    const height = device.height ?? defaultDeviceHeight(device.type);
    const { expected, tolerance } = expectedHeight(device.type);
    if (Math.abs(height - expected) > tolerance) {
      addIssue(result, {
        id: nextIssueId(),
        type: 'device',
        severity: 'warning',
        message: `Устройство "${device.name}": высота ${height} мм отличается от рекомендуемой ${expected} ± ${tolerance} мм`,
        objectId: device.id,
        position: pos,
      });
    }

    // Розетки в потенциально влажных зонах (простая эвристика: низкая высота)
    if (isSocket(device.type) && height < 1100) {
      addIssue(result, {
        id: nextIssueId(),
        type: 'device',
        severity: 'info',
        message: `Розетка "${device.name}" установлена на высоте ${height} мм. Для влажных помещений рекомендуется ≥ 1100 мм с УЗО.`,
        objectId: device.id,
        position: pos,
      });
    }
  }

  return result;
}

function polygonCentroid(poly: Vector2[]): Vector2 {
  let cx = 0;
  let cy = 0;
  for (const p of poly) {
    cx += p.x;
    cy += p.y;
  }
  return new Vector2(cx / poly.length, cy / poly.length);
}

export { devicePosition };
