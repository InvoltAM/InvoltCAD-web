import { DEVICE_CATALOG, findDeviceCatalogItem } from '../catalogs/DeviceCatalog';

export type DeviceType =
  | 'socket'
  | 'socket-uz'
  | 'socket-usb'
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
  height?: number;  // высота установки от пола, мм
}

/** Стандартная высота установки устройства от пола, мм. */
export function defaultDeviceHeight(type: DeviceType): number {
  switch (type) {
    case 'socket':
    case 'socket-uz':
    case 'socket-usb':
      return 300;
    case 'switch':
    case 'switch-2':
      return 900;
    case 'panel':
    case 'breaker':
      return 1500;
    case 'light':
      return 2500;
    default:
      return 300;
  }
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

export { findDeviceCatalogItem };
