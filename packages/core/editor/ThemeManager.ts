export type ThemeName = 'light' | 'dark' | 'blueprint' | 'paper';

export type ThemeColorKey =
  | 'canvasBg'
  | 'gridMinor'
  | 'gridMajor'
  | 'wall'
  | 'wallStroke'
  | 'wallShadow'
  | 'openingBg'
  | 'openingStroke'
  | 'openingShadow'
  | 'openingSelectedFill'
  | 'roomFill'
  | 'roomStroke'
  | 'roomText'
  | 'roomHandleFill'
  | 'roomHandleStroke'
  | 'cablePower'
  | 'cableLighting'
  | 'cableLowCurrent'
  | 'deviceSocket'
  | 'deviceSwitch'
  | 'devicePanel'
  | 'deviceBreaker'
  | 'deviceLight'
  | 'deviceDefault'
  | 'deviceText'
  | 'deviceIconBg'
  | 'dimension'
  | 'dimensionSelected'
  | 'dimensionTextBg'
  | 'text'
  | 'textBg'
  | 'ghostWall'
  | 'ghostOpening'
  | 'ghostSnap'
  | 'ghostSnapText'
  | 'accent'
  | 'selected'
  | 'selectionFill'
  | 'validationError'
  | 'validationWarning'
  | 'validationInfo'
  | 'sheetFrame';

interface ThemePalette {
  colors: Record<ThemeColorKey, string>;
}

const light: ThemePalette = {
  colors: {
    canvasBg: '#f4f2ee',
    gridMinor: 'rgba(0,0,0,0.06)',
    gridMajor: 'rgba(0,0,0,0.12)',
    wall: '#3a3a3a',
    wallStroke: 'rgba(0,0,0,0.15)',
    wallShadow: 'rgba(0,0,0,0.12)',
    openingBg: '#f4f2ee',
    openingStroke: '#3a3a3a',
    openingShadow: 'rgba(0,0,0,0.08)',
    openingSelectedFill: 'rgba(255, 140, 0, 0.15)',
    roomFill: 'rgba(200, 210, 200, 0.35)',
    roomStroke: 'rgba(100, 120, 100, 0.4)',
    roomText: '#3a3a3a',
    roomHandleFill: '#ff8c00',
    roomHandleStroke: '#ffffff',
    cablePower: '#ef4444',
    cableLighting: '#f59e0b',
    cableLowCurrent: '#10b981',
    deviceSocket: '#2563eb',
    deviceSwitch: '#7c3aed',
    devicePanel: '#dc2626',
    deviceBreaker: '#f59e0b',
    deviceLight: '#10b981',
    deviceDefault: '#2563eb',
    deviceText: '#111827',
    deviceIconBg: '#ffffff',
    dimension: '#1a1a1a',
    dimensionSelected: '#2563eb',
    dimensionTextBg: 'rgba(255,255,255,0.85)',
    text: '#1a1a1a',
    textBg: 'rgba(255,255,255,0.8)',
    ghostWall: 'rgba(58,58,58,0.5)',
    ghostOpening: 'rgba(255,140,0,0.4)',
    ghostSnap: '#ff8c00',
    ghostSnapText: '#1a1a1a',
    accent: '#ff8c00',
    selected: '#ff8c00',
    selectionFill: 'rgba(255, 140, 0, 0.15)',
    validationError: '#dc2626',
    validationWarning: '#eab308',
    validationInfo: '#3b82f6',
    sheetFrame: '#000000',
  },
};

const dark: ThemePalette = {
  colors: {
    canvasBg: '#1a1a1a',
    gridMinor: 'rgba(255,255,255,0.06)',
    gridMajor: 'rgba(255,255,255,0.12)',
    wall: '#c0c0c0',
    wallStroke: 'rgba(255,255,255,0.15)',
    wallShadow: 'rgba(0,0,0,0.3)',
    openingBg: '#1a1a1a',
    openingStroke: '#c0c0c0',
    openingShadow: 'rgba(0,0,0,0.3)',
    openingSelectedFill: 'rgba(255, 140, 0, 0.25)',
    roomFill: 'rgba(120, 140, 120, 0.35)',
    roomStroke: 'rgba(180, 200, 180, 0.4)',
    roomText: '#e0e0e0',
    roomHandleFill: '#ff8c00',
    roomHandleStroke: '#1a1a1a',
    cablePower: '#f87171',
    cableLighting: '#fbbf24',
    cableLowCurrent: '#34d399',
    deviceSocket: '#60a5fa',
    deviceSwitch: '#a78bfa',
    devicePanel: '#f87171',
    deviceBreaker: '#fbbf24',
    deviceLight: '#34d399',
    deviceDefault: '#60a5fa',
    deviceText: '#e0e0e0',
    deviceIconBg: '#1a1a1a',
    dimension: '#e0e0e0',
    dimensionSelected: '#60a5fa',
    dimensionTextBg: 'rgba(0,0,0,0.7)',
    text: '#e0e0e0',
    textBg: 'rgba(0,0,0,0.7)',
    ghostWall: 'rgba(255,255,255,0.5)',
    ghostOpening: 'rgba(255,140,0,0.4)',
    ghostSnap: '#ff8c00',
    ghostSnapText: '#e0e0e0',
    accent: '#ff8c00',
    selected: '#ff8c00',
    selectionFill: 'rgba(255, 140, 0, 0.25)',
    validationError: '#f87171',
    validationWarning: '#fbbf24',
    validationInfo: '#60a5fa',
    sheetFrame: '#ffffff',
  },
};

/** Тема «Чертёжная бумага» — синий фон, белые линии. */
const blueprint: ThemePalette = {
  colors: {
    canvasBg: '#1e3a5f',
    gridMinor: 'rgba(255,255,255,0.06)',
    gridMajor: 'rgba(255,255,255,0.14)',
    wall: '#ffffff',
    wallStroke: 'rgba(255,255,255,0.25)',
    wallShadow: 'rgba(0,0,0,0.2)',
    openingBg: '#1e3a5f',
    openingStroke: '#ffffff',
    openingShadow: 'rgba(0,0,0,0.2)',
    openingSelectedFill: 'rgba(255, 200, 80, 0.25)',
    roomFill: 'rgba(100, 160, 220, 0.25)',
    roomStroke: 'rgba(180, 210, 240, 0.5)',
    roomText: '#ffffff',
    roomHandleFill: '#ffc850',
    roomHandleStroke: '#1e3a5f',
    cablePower: '#ff9999',
    cableLighting: '#ffd166',
    cableLowCurrent: '#7fdbca',
    deviceSocket: '#8ecae6',
    deviceSwitch: '#cdb4db',
    devicePanel: '#ff9999',
    deviceBreaker: '#ffd166',
    deviceLight: '#7fdbca',
    deviceDefault: '#8ecae6',
    deviceText: '#ffffff',
    deviceIconBg: '#1e3a5f',
    dimension: '#ffffff',
    dimensionSelected: '#8ecae6',
    dimensionTextBg: 'rgba(30,58,95,0.85)',
    text: '#ffffff',
    textBg: 'rgba(30,58,95,0.8)',
    ghostWall: 'rgba(255,255,255,0.5)',
    ghostOpening: 'rgba(255,200,80,0.4)',
    ghostSnap: '#ffc850',
    ghostSnapText: '#ffffff',
    accent: '#ffc850',
    selected: '#ffc850',
    selectionFill: 'rgba(255, 200, 80, 0.25)',
    validationError: '#ff9999',
    validationWarning: '#ffd166',
    validationInfo: '#8ecae6',
    sheetFrame: '#ffffff',
  },
};

/** Тема «Бумага» — тёплый сепия/бежевый фон, тёмные линии. */
const paper: ThemePalette = {
  colors: {
    canvasBg: '#f0e6d2',
    gridMinor: 'rgba(60,50,40,0.06)',
    gridMajor: 'rgba(60,50,40,0.12)',
    wall: '#4a4036',
    wallStroke: 'rgba(60,50,40,0.15)',
    wallShadow: 'rgba(60,50,40,0.1)',
    openingBg: '#f0e6d2',
    openingStroke: '#4a4036',
    openingShadow: 'rgba(60,50,40,0.1)',
    openingSelectedFill: 'rgba(180, 100, 40, 0.2)',
    roomFill: 'rgba(180, 160, 120, 0.3)',
    roomStroke: 'rgba(120, 100, 80, 0.45)',
    roomText: '#4a4036',
    roomHandleFill: '#b56428',
    roomHandleStroke: '#f0e6d2',
    cablePower: '#c0392b',
    cableLighting: '#d35400',
    cableLowCurrent: '#27ae60',
    deviceSocket: '#2980b9',
    deviceSwitch: '#8e44ad',
    devicePanel: '#c0392b',
    deviceBreaker: '#d35400',
    deviceLight: '#27ae60',
    deviceDefault: '#2980b9',
    deviceText: '#3d3228',
    deviceIconBg: '#f0e6d2',
    dimension: '#3d3228',
    dimensionSelected: '#2980b9',
    dimensionTextBg: 'rgba(240,230,210,0.85)',
    text: '#3d3228',
    textBg: 'rgba(240,230,210,0.8)',
    ghostWall: 'rgba(74,64,54,0.5)',
    ghostOpening: 'rgba(180,100,40,0.35)',
    ghostSnap: '#b56428',
    ghostSnapText: '#4a4036',
    accent: '#b56428',
    selected: '#b56428',
    selectionFill: 'rgba(180, 100, 40, 0.2)',
    validationError: '#c0392b',
    validationWarning: '#d35400',
    validationInfo: '#2980b9',
    sheetFrame: '#4a4036',
  },
};

/**
 * Управляет цветовой темой редактора.
 * Предоставляет палитру цветов для canvas-рендереров и UI.
 */
export class ThemeManager {
  private current: ThemeName = 'light';
  private listeners: Array<(name: ThemeName) => void> = [];

  constructor(initial: ThemeName = 'light') {
    this.current = initial;
  }

  getTheme(): ThemeName {
    return this.current;
  }

  setTheme(name: ThemeName): void {
    if (this.current === name) return;
    this.current = name;
    for (const cb of this.listeners) cb(name);
  }

  private palettes: Record<ThemeName, ThemePalette> = {
    light,
    dark,
    blueprint,
    paper,
  };

  toggle(): ThemeName {
    const order: ThemeName[] = ['light', 'dark', 'blueprint', 'paper'];
    const idx = order.indexOf(this.current);
    const next = order[(idx + 1) % order.length];
    this.setTheme(next);
    return next;
  }

  getColor(key: ThemeColorKey): string {
    return this.palettes[this.current].colors[key];
  }

  subscribe(callback: (name: ThemeName) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }
}
