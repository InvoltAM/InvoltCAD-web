import { DeviceType } from '../model/Device';

export interface DeviceCatalogItem {
  type: DeviceType;
  category: 'socket' | 'switch' | 'panel' | 'light' | 'breaker';
  label: string; // короткое название в UI
  fullName: string; // имя по умолчанию для спецификации
  icon: string;
  width: number; // мм
  height: number; // мм
}

/**
 * Библиотека электрооборудования.
 */
export const DEVICE_CATALOG: DeviceCatalogItem[] = [
  { type: 'socket', category: 'socket', label: 'Розетка', fullName: 'Розетка', icon: '⏚', width: 600, height: 600 },
  { type: 'socket-uz', category: 'socket', label: 'Розетка с/з', fullName: 'Розетка с заземлением', icon: '⏚', width: 600, height: 600 },
  { type: 'socket-usb', category: 'socket', label: 'Розетка USB', fullName: 'Розетка USB', icon: '🔌', width: 600, height: 600 },
  { type: 'switch', category: 'switch', label: 'Выключатель', fullName: 'Выключатель', icon: '⏻', width: 600, height: 600 },
  { type: 'switch-2', category: 'switch', label: 'Выкл. 2-кл', fullName: 'Выключатель двухклавишный', icon: '⏻', width: 700, height: 700 },
  { type: 'panel', category: 'panel', label: 'Щит', fullName: 'Щит', icon: 'Щ', width: 800, height: 1000 },
  { type: 'breaker', category: 'breaker', label: 'Автомат', fullName: 'Автоматический выключатель', icon: 'А', width: 500, height: 800 },
  { type: 'light', category: 'light', label: 'Светильник', fullName: 'Светильник', icon: '💡', width: 800, height: 800 },
];

export const DEVICE_CATEGORIES: Record<DeviceCatalogItem['category'], string> = {
  socket: 'Розетки',
  switch: 'Выключатели',
  panel: 'Щиты',
  breaker: 'Автоматы',
  light: 'Светильники',
};

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = (() => {
  const map = {} as Record<DeviceType, string>;
  for (const item of DEVICE_CATALOG) {
    map[item.type] = item.label;
  }
  return map;
})();

export function findDeviceCatalogItem(type: DeviceType): DeviceCatalogItem | undefined {
  return DEVICE_CATALOG.find(item => item.type === type);
}
