export type IconName =
  | 'wall' | 'door' | 'window' | 'device' | 'cable' | 'dimension' | 'select' | 'hand' | 'edit'
  | 'drawing' | 'polyline' | 'segment' | 'rectangle' | 'circle'
  | 'move' | 'rotate' | 'trim' | 'extend'
  | 'text' | 'table' | 'underlay' | 'calibrate' | 'eye' | 'eyeSlash'
  | 'properties' | 'layers' | 'spec' | 'menu' | 'collapseDown' | 'collapseUp' | 'ai'
  | 'themeLight' | 'themeDark' | 'themeBlueprint' | 'themePaper'
  | 'undo' | 'redo' | 'zoomIn' | 'zoomOut' | 'save' | 'exportPng' | 'exportXlsx' | 'exportSvg' | 'print' | 'import' | 'clear'
  | 'sun' | 'moon' | 'ortho' | 'grid' | 'uiScale' | 'compact' | 'ols' | 'panel' | 'validation' | 'reset' | 'projects'
  | 'sun' | 'moon' | 'ortho' | 'grid' | 'uiScale' | 'compact' | 'ols' | 'panel' | 'validation' | 'reset' | 'projects'
  | 'rooms' | 'roomNumbers' | 'estimates' | 'invoices' | 'documents' | 'catalog' | 'marking' | 'automation' | 'templates'
  | 'dotsThreeVertical' | 'stamp' | 'exportDxf' | 'exportPdf' | 'plus'
  | 'socket' | 'switch' | 'light' | 'sensor' | 'output' | 'camera' | 'sks' | 'drive' | 'smartHome'
  | 'basket'
  | 'terminal' | 'relay' | 'psu' | 'contactor' | 'bus';

const MAP: Record<IconName, string> = {
  wall: 'wall',
  door: 'door',
  window: 'app-window',
  device: 'plug',
  cable: 'line-segments',
  dimension: 'ruler',
  select: 'selection',
  hand: 'hand',
  edit: 'pencil-simple',
  drawing: 'pencil',
  polyline: 'polygon',
  segment: 'line-segment',
  rectangle: 'rectangle',
  circle: 'circle',
  move: 'arrows-out-cardinal',
  rotate: 'rotate-right',
  trim: 'scissors',
  extend: 'arrows-out-line-horizontal',
  text: 'text-t',
  table: 'table',
  underlay: 'images',
  calibrate: 'ruler',
  eye: 'eye',
  eyeSlash: 'eye-slash',
  properties: 'sliders-horizontal',
  layers: 'stack',
  spec: 'table',
  menu: 'list',
  collapseDown: 'caret-down',
  collapseUp: 'caret-up',
  ai: 'sparkle',
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
  themeLight: 'sun',
  themeDark: 'moon',
  themeBlueprint: 'grid-four',
  themePaper: 'scroll',
  ortho: 'ruler',
  grid: 'grid-four',
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
  socket: 'plug',
  switch: 'toggle-left',
  light: 'lightbulb',
  sensor: 'rss-simple',
  output: 'plugs',
  camera: 'video-camera',
  sks: 'network',
  drive: 'gear',
  smartHome: 'house-line',
  basket: 'shopping-cart',
  terminal: 'terminal',
  relay: 'toggle-right',
  psu: 'battery-charging',
  contactor: 'arrows-left-right',
  bus: 'line-segments',
};

export function icon(name: IconName): string {
  const cls = MAP[name];
  if (!cls) return '';
  return `<i class="ph ph-${cls}" aria-hidden="true"></i>`;
}
