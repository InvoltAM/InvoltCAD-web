export type IconName =
  | 'wall' | 'door' | 'window' | 'device' | 'cable' | 'dimension' | 'select' | 'hand'
  | 'drawing' | 'polyline' | 'segment' | 'rectangle' | 'circle'
  | 'properties' | 'layers' | 'spec' | 'menu' | 'collapseDown' | 'collapseUp'
  | 'undo' | 'redo' | 'zoomIn' | 'zoomOut' | 'save' | 'exportPng' | 'exportXlsx' | 'exportSvg' | 'print' | 'import' | 'clear'
  | 'sun' | 'moon' | 'ortho' | 'uiScale' | 'compact' | 'ols' | 'panel' | 'validation' | 'reset' | 'projects'
  | 'sun' | 'moon' | 'ortho' | 'uiScale' | 'compact' | 'ols' | 'panel' | 'validation' | 'reset' | 'projects'
  | 'rooms' | 'roomNumbers' | 'estimates' | 'invoices' | 'documents' | 'catalog' | 'marking' | 'automation' | 'templates'
  | 'dotsThreeVertical' | 'stamp' | 'exportDxf' | 'exportPdf' | 'plus';

const MAP: Record<IconName, string> = {
  wall: 'wall',
  door: 'door',
  window: 'app-window',
  device: 'plug',
  cable: 'line-segments',
  dimension: 'ruler',
  select: 'selection',
  hand: 'hand',
  drawing: 'pencil',
  polyline: 'polygon',
  segment: 'line-segment',
  rectangle: 'rectangle',
  circle: 'circle',
  properties: 'sliders-horizontal',
  layers: 'stack',
  spec: 'table',
  menu: 'list',
  collapseDown: 'caret-down',
  collapseUp: 'caret-up',
  undo: 'arrow-counter-clockwise',
  redo: 'arrow-clockwise',
  zoomIn: 'magnifying-glass-plus',
  zoomOut: 'magnifying-glass-minus',
  save: 'floppy-disk',
  exportPng: 'image',
  exportXlsx: 'table',
  exportSvg: 'file-svg',
  exportDxf: 'file-cad',
  exportPdf: 'file-pdf',
  print: 'printer',
  import: 'upload',
  clear: 'trash',
  sun: 'sun',
  moon: 'moon',
  ortho: 'ruler',
  uiScale: 'arrows-out',
  compact: 'squares-four',
  ols: 'lightning',
  panel: 'layout',
  validation: 'check-circle',
  reset: 'arrows-counter-clockwise',
  projects: 'folders',
  rooms: 'grid-four',
  roomNumbers: 'hash',
  estimates: 'receipt',
  invoices: 'invoice',
  documents: 'file-text',
  catalog: 'book-open',
  marking: 'tag',
  automation: 'lightning',
  templates: 'copy',
  dotsThreeVertical: 'dots-three-vertical',
  stamp: 'stamp',
  plus: 'plus',
};

export function icon(name: IconName): string {
  const cls = MAP[name];
  if (!cls) return '';
  return `<i class="ph ph-${cls}" aria-hidden="true"></i>`;
}
