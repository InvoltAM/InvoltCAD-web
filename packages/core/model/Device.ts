import { DEVICE_CATALOG, findDeviceCatalogItem } from '../catalogs/DeviceCatalog';

export type DeviceType =
  | 'socket'
  | 'socket-uz'
  | 'socket-usb'
  | 'socket-ip21'
  | 'socket-ip44'
  | 'switch'
  | 'switch-2'
  | 'panel'
  | 'breaker'
  | 'light';

export interface Device {
  id: string;
  type: DeviceType;
  name: string;
  wallId: string;
  t: number;        // позиция вдоль стены, 0..1
  offset: number;   // расстояние от поверхности стены, мм (>=0)
  side: 1 | -1;     // сторона относительно направления стены
  rotation: number; // угол поворота в радианах
  /** @deprecated Высота установки от пола, мм — оставлено для совместимости сериализации БД. */
  height?: number;
  /** Смещение подписи (атрибута) от позиции по умолчанию, мировые мм. */
  nameOffset?: { x: number; y: number };
  /** Абсолютная позиция для свободно размещённых устройств (напр. светильник на потолке), мировые мм. */
  position?: { x: number; y: number };
  /** Масштаб иконки конкретного устройства (1 — размер по каталогу). */
  iconScale?: number;
}

function buildDeviceMap<T>(getter: (item: import('../catalogs/DeviceCatalog').DeviceCatalogItem) => T): Record<DeviceType, T> {
  const map = {} as Record<DeviceType, T>;
  for (const item of DEVICE_CATALOG) {
    map[item.type] = getter(item);
  }
  return map;
}

export const DEVICE_LABELS: Record<DeviceType, string> = buildDeviceMap(item => item.icon);

export const DEFAULT_DEVICE_NAMES: Record<DeviceType, string> = buildDeviceMap(item => item.fullName);

export interface DeviceSize {
  width: number;
  height: number;
}

/** Размеры устройств в миллиметрах (мировые координаты). */
export const DEVICE_SIZE: Record<DeviceType, DeviceSize> = buildDeviceMap(item => ({ width: item.width, height: item.height }));

/** Возвращает масштаб иконки устройства (1 по умолчанию). */
export function getDeviceIconScale(device: Device): number {
  return device.iconScale ?? 1;
}

export { findDeviceCatalogItem };
