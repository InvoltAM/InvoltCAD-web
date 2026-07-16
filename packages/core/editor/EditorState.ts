import { ToolName } from '../tools/ToolManager';
import { DeviceType } from '../model/Device';
import { ValidationIssue } from '../rules/ValidationTypes';
import { ThemeName } from './ThemeManager';

export interface DisplayLayers {
  rooms: boolean;
  walls: boolean;
  openings: boolean;
  dimensions: boolean;
  wallDimensions: boolean;
  devices: boolean;
  cables: boolean;
}

export interface SnapSettings {
  grid: boolean;
  wallLines: boolean;
  endpoints: boolean;
}

export type WallJoinStyle = 'square' | 'round' | 'miter' | 'bevel' | 'none';

export interface EditorStateData {
  currentTool: ToolName;
  selectedWallId: string | null;
  selectedOpeningId: string | null;
  selectedDeviceId: string | null;
  selectedCableId: string | null;
  selectedDimensionId: string | null;
  selectedRoomIndex: number | null;
  selectedDeviceType: DeviceType;
  zoom: number;
  layers: DisplayLayers;
  snap: SnapSettings;
  wallThickness: number;
  doorWidth: number;
  windowWidth: number;
  defaultCableType: import('../model/Cable').CableType;
  defaultCableSection: number;
  deviceIconScale: number;
  wallJoinStyle: WallJoinStyle;
  validationIssues: ValidationIssue[];
  showValidation: boolean;
  theme: ThemeName;
  uiScale: number;
  compactPanels: boolean;
}

type Listener<T> = (value: T) => void;

/**
 * Центральное состояние редактора с простым pub/sub.
 * UI и инструменты подписываются на изменения, не размазывая состояние по модулям.
 */
export class EditorState {
  private data: EditorStateData = {
    currentTool: 'wall',
    selectedWallId: null,
    selectedOpeningId: null,
    selectedDeviceId: null,
    selectedCableId: null,
    selectedDimensionId: null,
    selectedRoomIndex: null,
    selectedDeviceType: 'socket',
    zoom: 0.1,
    layers: { rooms: true, walls: true, openings: true, dimensions: true, wallDimensions: false, devices: true, cables: true },
    snap: { grid: true, wallLines: true, endpoints: true },
    wallThickness: 200,
    doorWidth: 900,
    windowWidth: 1200,
    defaultCableType: 'power',
    defaultCableSection: 2.5,
    deviceIconScale: 1,
    wallJoinStyle: 'square',
    validationIssues: [],
    showValidation: true,
    theme: 'light',
    uiScale: 1,
    compactPanels: false,
  };

  private listeners: {
    [K in keyof EditorStateData]?: Array<Listener<EditorStateData[K]>>;
  } = {};

  get<K extends keyof EditorStateData>(key: K): EditorStateData[K] {
    return this.data[key];
  }

  set<K extends keyof EditorStateData>(key: K, value: EditorStateData[K]): void {
    if (this.data[key] === value) return;
    this.data[key] = value;
    this.emit(key, value);
  }

  subscribe<K extends keyof EditorStateData>(
    key: K,
    listener: Listener<EditorStateData[K]>,
  ): () => void {
    if (!this.listeners[key]) this.listeners[key] = [];
    (this.listeners[key] as Array<Listener<EditorStateData[K]>>).push(listener);
    return () => {
      const arr = this.listeners[key] as Array<Listener<EditorStateData[K]>>;
      const idx = arr.indexOf(listener);
      if (idx !== -1) arr.splice(idx, 1);
    };
  }

  private emit<K extends keyof EditorStateData>(key: K, value: EditorStateData[K]): void {
    const arr = this.listeners[key] as Array<Listener<EditorStateData[K]>> | undefined;
    if (!arr) return;
    for (const listener of arr) listener(value);
  }
}
