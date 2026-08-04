export type IconName =
  | 'wall' | 'door' | 'window' | 'device' | 'cable' | 'dimension' | 'select' | 'hand'
  | 'properties' | 'layers' | 'spec' | 'menu' | 'collapseDown' | 'collapseUp'
  | 'undo' | 'redo' | 'zoomIn' | 'zoomOut' | 'save' | 'exportPng' | 'exportXlsx' | 'exportSvg' | 'print' | 'import' | 'clear'
  | 'sun' | 'moon' | 'ortho' | 'uiScale' | 'compact' | 'ols' | 'panel' | 'validation' | 'reset' | 'projects';

const wrap = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

const ICONS: Record<IconName, string> = {
  wall: wrap('<rect x="3" y="10" width="18" height="4"/>'),
  door: wrap('<rect x="5" y="4" width="14" height="16"/><path d="M5 20a10 10 0 0 1 10-10"/>'),
  window: wrap('<rect x="4" y="5" width="16" height="14"/><line x1="12" y1="5" x2="12" y2="19"/>'),
  device: wrap('<circle cx="12" cy="12" r="6"/><line x1="12" y1="6" x2="12" y2="3"/><line x1="9" y1="3" x2="15" y2="3"/>'),
  cable: wrap('<path d="M4 12c2-4 4-4 6 0s4 4 6 0 2-4 4-4"/>'),
  dimension: wrap('<line x1="4" y1="12" x2="20" y2="12"/><polyline points="8 8 4 12 8 16"/><polyline points="16 8 20 12 16 16"/>'),
  select: wrap('<polyline points="6 3 6 20 12 14 16 14 20 20 22 18 18 12 22 12"/>'),
  hand: wrap('<path d="M8 12V5a2 2 0 0 1 4 0v7"/><path d="M12 12V4a2 2 0 0 1 4 0v8"/><path d="M16 12v-2a2 2 0 0 1 4 0v5a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-1"/>'),
  properties: wrap('<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  layers: wrap('<rect x="4" y="4" width="16" height="4"/><rect x="4" y="10" width="16" height="4"/><rect x="4" y="16" width="16" height="4"/>'),
  spec: wrap('<rect x="6" y="4" width="12" height="16" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/>'),
  menu: wrap('<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>'),
  collapseDown: wrap('<polyline points="6 9 12 15 18 9"/>'),
  collapseUp: wrap('<polyline points="18 15 12 9 6 15"/>'),
  undo: wrap('<polyline points="9 14 4 9 9 4"/><path d="M20 20v-4a4 4 0 0 0-4-4H4"/>'),
  redo: wrap('<polyline points="15 14 20 9 15 4"/><path d="M4 20v-4a4 4 0 0 1 4-4h12"/>'),
  zoomIn: wrap('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
  zoomOut: wrap('<line x1="5" y1="12" x2="19" y2="12"/>'),
  save: wrap('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'),
  exportPng: wrap('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
  exportXlsx: wrap('<rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="8 8 12 12 8 16"/><line x1="13" y1="8" x2="13" y2="16"/><line x1="16" y1="8" x2="16" y2="16"/>'),
  exportSvg: wrap('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8l5 5 5-5"/><path d="M7 14l5 5 5-5"/>'),
  print: wrap('<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
  import: wrap('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
  clear: wrap('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  sun: wrap('<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.9" y1="4.9" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.1" y2="19.1"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.9" y1="19.1" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.1" y2="4.9"/>'),
  moon: wrap('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  ortho: wrap('<path d="M5 19V5h14M5 19h14"/>'),
  uiScale: wrap('<circle cx="12" cy="12" r="9"/><rect x="8" y="8" width="8" height="8" rx="1"/>'),
  compact: wrap('<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>'),
  ols: wrap('<path d="M4 6h16M4 12h10M4 18h6"/>'),
  panel: wrap('<rect x="4" y="4" width="16" height="16" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/>'),
  validation: wrap('<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/>'),
  reset: wrap('<path d="M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.5 15"/>'),
  projects: wrap('<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M3 7l9 6 9-6"/>'),
};

export function icon(name: IconName): string {
  return ICONS[name];
}
