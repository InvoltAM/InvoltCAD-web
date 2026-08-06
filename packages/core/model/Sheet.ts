import { Device } from './Device';
import { Cable } from './Cable';
import { Dimension } from './Dimension';

/**
 * Лист проекта: общие стены живут в Plan,
 * а устройства, кабели и размеры — отдельные на каждом листе.
 */
export type PageSize = 'A4' | 'A3' | 'A2' | 'A1' | 'A0';
export type PageOrientation = 'landscape' | 'portrait';

/** Поля основной надписи (штампа) по ГОСТ 21.1101-2013, форма 3. */
export interface SheetTitleBlock {
  /** Наименование организации */
  organization: string;
  /** Наименование объекта */
  objectName: string;
  /** Наименование чертежа / листа */
  drawingName: string;
  /** Стадия проектирования (напр. «Р») */
  stage: string;
  /** Номер листа */
  sheetNo: string;
  /** Всего листов */
  sheetTotal: string;
  /** Шифр / номер документа */
  docCode: string;
  /** Дата */
  date: string;
  /** Разработал */
  designer: string;
  /** Проверил */
  checker: string;
  /** Н.контр. */
  normController: string;
  /** Утвердил */
  approver: string;
  /** Масса (необязательно) */
  weight?: string;
  /** Масштаб (может отличаться от printScale) */
  scaleLabel?: string;
}

export interface Sheet {
  id: string;
  name: string;
  devices: Device[];
  cables: Cable[];
  dimensions: Dimension[];
  pageSize: PageSize;
  orientation: PageOrientation;
  printScale: number;
  titleBlock: SheetTitleBlock;
}

export const DEFAULT_SHEET_NAMES = [
  'Розетки',
  'Освещение',
  'Подсветки',
  'Вентиляция',
  'Теплые полы',
];

export const PAGE_SIZES: PageSize[] = ['A4', 'A3', 'A2', 'A1', 'A0'];

/** Размеры листов по ГОСТ 21.1101-2013, мм (ширина × высота). */
const SHEET_DIMENSIONS: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
  A0: { width: 841, height: 1189 },
};

export function getSheetDimensions(pageSize: PageSize, orientation: PageOrientation): { width: number; height: number } {
  const dim = SHEET_DIMENSIONS[pageSize];
  if (orientation === 'landscape') {
    return { width: dim.height, height: dim.width };
  }
  return { width: dim.width, height: dim.height };
}

export function createEmptyTitleBlock(): SheetTitleBlock {
  return {
    organization: '',
    objectName: '',
    drawingName: '',
    stage: '',
    sheetNo: '1',
    sheetTotal: '1',
    docCode: '',
    date: new Date().toLocaleDateString('ru-RU'),
    designer: '',
    checker: '',
    normController: '',
    approver: '',
    weight: '',
    scaleLabel: '',
  };
}

export function createSheet(name: string): Sheet {
  return {
    id: crypto.randomUUID(),
    name,
    devices: [],
    cables: [],
    dimensions: [],
    pageSize: 'A4',
    orientation: 'landscape',
    printScale: 100,
    titleBlock: createEmptyTitleBlock(),
  };
}

export function createDefaultSheets(): Sheet[] {
  return DEFAULT_SHEET_NAMES.map(createSheet);
}
