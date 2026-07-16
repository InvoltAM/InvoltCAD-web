export type ThemeName = 'light' | 'dark';

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
  | 'validationInfo';

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

  toggle(): ThemeName {
    const next = this.current === 'light' ? 'dark' : 'light';
    this.setTheme(next);
    return next;
  }

  getColor(key: ThemeColorKey): string {
    return (this.current === 'dark' ? dark : light).colors[key];
  }

  subscribe(callback: (name: ThemeName) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }
}
