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
  /** № проекта / шифр */
  projectCode: string;
  /** Адрес объекта */
  address: string;
  /** Раздел */
  section: string;
  /** Наименование */
  drawingTitle: string;
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
  /** Название компании / организация */
  company: string;
  /** Data URL логотипа компании */
  companyLogo: string;
  /** Разработал */
  designer: string;
  /** Подпись Разработал */
  signatureDesigner: string;
  /** Проверил */
  checker: string;
  /** Подпись Проверил */
  signatureChecker: string;
  /** Н.контр. */
  normController: string;
  /** Подпись Н.контр. */
  signatureNormController: string;
  /** ГИП */
  gip: string;
  /** Подпись ГИП */
  signatureGip: string;
  /** Утвердил */
  approver: string;
  /** Подпись Утвердил */
  signatureApprover: string;
  /** Согласовал */
  reviewer: string;
  /** Подпись Согласовал */
  signatureReviewer: string;
  /** Масса (необязательно) */
  weight?: string;
  /** Масштаб (может отличаться от printScale) */
  scaleLabel?: string;
  /** Видимость полей основной надписи */
  show: TitleBlockVisibility;
}

/** Флаги видимости каждой графы основной надписи. */
export interface TitleBlockVisibility {
  organization: boolean;
  objectName: boolean;
  drawingName: boolean;
  projectCode: boolean;
  address: boolean;
  section: boolean;
  drawingTitle: boolean;
  stage: boolean;
  sheetNo: boolean;
  sheetTotal: boolean;
  docCode: boolean;
  date: boolean;
  designer: boolean;
  checker: boolean;
  normController: boolean;
  gip: boolean;
  approver: boolean;
  reviewer: boolean;
  weight: boolean;
  scaleLabel: boolean;
  company: boolean;
  /** Видимость строки 1 (Утвердил) */
  row1: boolean;
  /** Видимость строки 2 (Н.контр.) */
  row2: boolean;
  /** Видимость строки 3 (ГИП) */
  row3: boolean;
  /** Видимость строки 4 (Проверил) */
  row4: boolean;
  /** Видимость строки 5 (Согласовал) */
  row5: boolean;
  /** Видимость строки 6 (Разработал) */
  row6: boolean;
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
    projectCode: '',
    address: '',
    section: '',
    drawingTitle: '',
    stage: '',
    sheetNo: '1',
    sheetTotal: '1',
    docCode: '',
    date: new Date().toLocaleDateString('ru-RU'),
    designer: '',
    signatureDesigner: '',
    checker: '',
    signatureChecker: '',
    normController: '',
    signatureNormController: '',
    gip: '',
    signatureGip: '',
    approver: '',
    signatureApprover: '',
    reviewer: '',
    signatureReviewer: '',
    weight: '',
    scaleLabel: '',
    company: '',
    companyLogo: '',
    show: {
      organization: true,
      objectName: true,
      drawingName: true,
      projectCode: true,
      address: true,
      section: true,
      drawingTitle: true,
      stage: true,
      sheetNo: true,
      sheetTotal: true,
      docCode: true,
      date: true,
      designer: true,
      checker: true,
      normController: true,
      gip: true,
      approver: true,
      reviewer: true,
      weight: true,
      scaleLabel: true,
      company: true,
      row1: true,
      row2: true,
      row3: true,
      row4: true,
      row5: true,
      row6: true,
    },
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
