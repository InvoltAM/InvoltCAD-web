export type PriceLevel = 'budget' | 'standard' | 'premium';

export interface PriceItemData {
  id: string;
  userId?: string | null;
  category: string;
  name: string;
  unit: string;
  priceBudget: number; // в копейках
  priceStandard: number;
  pricePremium: number;
  currency: string;
  vendor?: string;
  sku?: string;
  article?: string;
  description?: string;
  isBuiltin: boolean;
  isHiddenByAdmin: boolean;
  sortOrder: number;
}

export interface PriceWorkItemData {
  id: string;
  userId?: string | null;
  category: string;
  name: string;
  unit: string;
  priceBudget: number;
  priceStandard: number;
  pricePremium: number;
  currency: string;
  description?: string;
  isBuiltin: boolean;
  isHiddenByAdmin: boolean;
  sortOrder: number;
}

export const BUILTIN_CATEGORIES = [
  'cable',
  'breaker',
  'rcd',
  'din-rail',
  'box',
  'conduit',
  'cable-channel',
  'fitting',
  'mounting',
  'other',
] as const;

export const BUILTIN_WORK_CATEGORIES = [
  'cable-laying',
  'device-install',
  'panel-assembly',
  'electrical-work',
  'other-work',
] as const;

export const CATEGORY_NAMES: Record<string, string> = {
  cable: 'Кабели',
  breaker: 'Автоматические выключатели',
  rcd: 'УЗО / Дифавтоматы',
  'din-rail': 'DIN-рейки и шины',
  box: 'Коробки и подрозетники',
  conduit: 'Трубы и гофра',
  'cable-channel': 'Кабель-каналы',
  fitting: 'Крепёж и фитинги',
  mounting: 'Монтажные материалы',
  other: 'Прочее',
  'cable-laying': 'Прокладка кабеля',
  'device-install': 'Установка устройств',
  'panel-assembly': 'Сборка щита',
  'electrical-work': 'Электромонтажные работы',
  'other-work': 'Прочие работы',
};

export const BUILTIN_ITEMS: Omit<PriceItemData, 'id'>[] = [
  { category: 'cable', name: 'ВВГнг(А)-LS 3×1,5', unit: 'м', priceBudget: 4500, priceStandard: 6500, pricePremium: 9500, currency: 'RUB', vendor: 'Севкабель', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 1 },
  { category: 'cable', name: 'ВВГнг(А)-LS 3×2,5', unit: 'м', priceBudget: 6500, priceStandard: 9500, pricePremium: 14000, currency: 'RUB', vendor: 'Севкабель', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 2 },
  { category: 'cable', name: 'ВВГнг(А)-LS 3×4', unit: 'м', priceBudget: 10500, priceStandard: 15500, pricePremium: 22000, currency: 'RUB', vendor: 'Севкабель', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 3 },
  { category: 'cable', name: 'ВВГнг(А)-LS 5×2,5', unit: 'м', priceBudget: 12000, priceStandard: 18000, pricePremium: 26000, currency: 'RUB', vendor: 'Севкабель', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 4 },
  { category: 'cable', name: 'NYM 3×1,5', unit: 'м', priceBudget: 5500, priceStandard: 8000, pricePremium: 11500, currency: 'RUB', vendor: 'Nexans', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 5 },
  { category: 'cable', name: 'NYM 3×2,5', unit: 'м', priceBudget: 8000, priceStandard: 12000, pricePremium: 17000, currency: 'RUB', vendor: 'Nexans', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 6 },
  { category: 'cable', name: 'Кабель слаботочный UTP Cat.5e', unit: 'м', priceBudget: 2500, priceStandard: 4000, pricePremium: 6000, currency: 'RUB', vendor: 'Hyperline', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 7 },

  { category: 'breaker', name: 'Автомат 1P 16А хар-ка C', unit: 'шт', priceBudget: 18000, priceStandard: 28000, pricePremium: 45000, currency: 'RUB', vendor: 'Schneider Electric', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 10 },
  { category: 'breaker', name: 'Автомат 1P 25А хар-ка C', unit: 'шт', priceBudget: 18000, priceStandard: 28000, pricePremium: 45000, currency: 'RUB', vendor: 'Schneider Electric', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 11 },
  { category: 'breaker', name: 'Автомат 2P 40А хар-ка C', unit: 'шт', priceBudget: 35000, priceStandard: 55000, pricePremium: 85000, currency: 'RUB', vendor: 'Schneider Electric', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 12 },
  { category: 'breaker', name: 'Автомат 3P 16А хар-ка C', unit: 'шт', priceBudget: 45000, priceStandard: 70000, pricePremium: 110000, currency: 'RUB', vendor: 'ABB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 13 },

  { category: 'rcd', name: 'УЗО 2P 25А 30мА', unit: 'шт', priceBudget: 45000, priceStandard: 75000, pricePremium: 120000, currency: 'RUB', vendor: 'Schneider Electric', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 20 },
  { category: 'rcd', name: 'УЗО 2P 40А 30мА', unit: 'шт', priceBudget: 55000, priceStandard: 90000, pricePremium: 140000, currency: 'RUB', vendor: 'Schneider Electric', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 21 },
  { category: 'rcd', name: 'Дифавтомат 1P+N 16А 30мА', unit: 'шт', priceBudget: 65000, priceStandard: 110000, pricePremium: 180000, currency: 'RUB', vendor: 'ABB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 22 },

  { category: 'din-rail', name: 'DIN-рейка оцинкованная 1 м', unit: 'шт', priceBudget: 15000, priceStandard: 25000, pricePremium: 40000, currency: 'RUB', vendor: 'Schneider Electric', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 30 },
  { category: 'din-rail', name: 'Шина N 6×9 мм (1 м)', unit: 'шт', priceBudget: 8000, priceStandard: 14000, pricePremium: 22000, currency: 'RUB', vendor: 'Schneider Electric', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 31 },
  { category: 'din-rail', name: 'Шина PE 6×9 мм (1 м)', unit: 'шт', priceBudget: 8000, priceStandard: 14000, pricePremium: 22000, currency: 'RUB', vendor: 'Schneider Electric', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 32 },

  { category: 'box', name: 'Подрозетник 60×60 пластик', unit: 'шт', priceBudget: 2500, priceStandard: 4500, pricePremium: 8000, currency: 'RUB', vendor: 'Schneider Electric', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 40 },
  { category: 'box', name: 'Распаячная коробка 100×100', unit: 'шт', priceBudget: 5000, priceStandard: 9000, pricePremium: 15000, currency: 'RUB', vendor: 'Schneider Electric', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 41 },
  { category: 'box', name: 'Коробка для наружного монтажа', unit: 'шт', priceBudget: 7000, priceStandard: 12000, pricePremium: 20000, currency: 'RUB', vendor: 'Schneider Electric', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 42 },

  { category: 'conduit', name: 'Гофротруба ПНД 16 мм', unit: 'м', priceBudget: 1200, priceStandard: 2000, pricePremium: 3500, currency: 'RUB', vendor: 'Рувинил', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 50 },
  { category: 'conduit', name: 'Гофротруба ПНД 20 мм', unit: 'м', priceBudget: 1800, priceStandard: 3000, pricePremium: 5000, currency: 'RUB', vendor: 'Рувинил', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 51 },
  { category: 'conduit', name: 'Труба жёсткая ПВХ 20 мм', unit: 'м', priceBudget: 2500, priceStandard: 4500, pricePremium: 7000, currency: 'RUB', vendor: 'Промрукав', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 52 },

  { category: 'cable-channel', name: 'Кабель-канал 12×12', unit: 'м', priceBudget: 1800, priceStandard: 3000, pricePremium: 5000, currency: 'RUB', vendor: 'Legrand', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 60 },
  { category: 'cable-channel', name: 'Кабель-канал 16×16', unit: 'м', priceBudget: 2500, priceStandard: 4500, pricePremium: 7000, currency: 'RUB', vendor: 'Legrand', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 61 },
  { category: 'cable-channel', name: 'Кабель-канал 25×16', unit: 'м', priceBudget: 4000, priceStandard: 7000, pricePremium: 11000, currency: 'RUB', vendor: 'Legrand', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 62 },

  { category: 'fitting', name: 'Крепёж для гофры (скоба 16 мм)', unit: 'шт', priceBudget: 500, priceStandard: 900, pricePremium: 1500, currency: 'RUB', vendor: 'Рувинил', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 70 },
  { category: 'fitting', name: 'Винт саморез 4×40', unit: 'шт', priceBudget: 100, priceStandard: 200, pricePremium: 400, currency: 'RUB', vendor: 'Tech-Krep', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 71 },
  { category: 'fitting', name: 'Дюбель-гвоздь 6×40', unit: 'шт', priceBudget: 150, priceStandard: 300, pricePremium: 600, currency: 'RUB', vendor: 'Tech-Krep', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 72 },

  { category: 'mounting', name: 'Монтажная пена 500 мл', unit: 'шт', priceBudget: 25000, priceStandard: 45000, pricePremium: 70000, currency: 'RUB', vendor: 'Tytan', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 80 },
  { category: 'mounting', name: 'Изолента ПВХ 20 м', unit: 'шт', priceBudget: 1500, priceStandard: 3000, pricePremium: 5000, currency: 'RUB', vendor: '3M', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 81 },
  { category: 'mounting', name: 'Сизы кабельные (набор)', unit: 'шт', priceBudget: 2000, priceStandard: 4000, pricePremium: 7000, currency: 'RUB', vendor: 'DKC', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 82 },

  { category: 'other', name: 'Розетка 16А белая', unit: 'шт', priceBudget: 8000, priceStandard: 15000, pricePremium: 25000, currency: 'RUB', vendor: 'Legrand', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 90 },
  { category: 'other', name: 'Выключатель 1-клавишный белый', unit: 'шт', priceBudget: 7000, priceStandard: 13000, pricePremium: 22000, currency: 'RUB', vendor: 'Legrand', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 91 },
  { category: 'other', name: 'Светильник точечный LED 7W', unit: 'шт', priceBudget: 25000, priceStandard: 45000, pricePremium: 75000, currency: 'RUB', vendor: 'Philips', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 92 },
];

export const BUILTIN_WORK_ITEMS: Omit<PriceWorkItemData, 'id'>[] = [
  { category: 'cable-laying', name: 'Прокладка кабеля в гофре', unit: 'м', priceBudget: 8000, priceStandard: 12000, pricePremium: 18000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 1 },
  { category: 'cable-laying', name: 'Прокладка кабеля в кабель-канале', unit: 'м', priceBudget: 10000, priceStandard: 15000, pricePremium: 22000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 2 },
  { category: 'cable-laying', name: 'Штробление под кабель (бетон)', unit: 'м', priceBudget: 25000, priceStandard: 40000, pricePremium: 60000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 3 },
  { category: 'cable-laying', name: 'Штробление под кабель (кирпич/гипс)', unit: 'м', priceBudget: 15000, priceStandard: 25000, pricePremium: 38000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 4 },

  { category: 'device-install', name: 'Установка розетки/выключателя', unit: 'шт', priceBudget: 25000, priceStandard: 40000, pricePremium: 60000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 10 },
  { category: 'device-install', name: 'Установка светильника', unit: 'шт', priceBudget: 35000, priceStandard: 55000, pricePremium: 85000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 11 },
  { category: 'device-install', name: 'Установка подрозетника', unit: 'шт', priceBudget: 15000, priceStandard: 25000, pricePremium: 38000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 12 },
  { category: 'device-install', name: 'Установка распаячной коробки', unit: 'шт', priceBudget: 25000, priceStandard: 40000, pricePremium: 60000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 13 },

  { category: 'panel-assembly', name: 'Сборка щита (до 24 модулей)', unit: 'шт', priceBudget: 120000, priceStandard: 200000, pricePremium: 320000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 20 },
  { category: 'panel-assembly', name: 'Сборка щита (25–48 модулей)', unit: 'шт', priceBudget: 180000, priceStandard: 300000, pricePremium: 480000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 21 },
  { category: 'panel-assembly', name: 'Установка автомата/УЗО на DIN-рейку', unit: 'шт', priceBudget: 8000, priceStandard: 15000, pricePremium: 25000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 22 },

  { category: 'electrical-work', name: 'Подключение вводного кабеля', unit: 'шт', priceBudget: 50000, priceStandard: 80000, pricePremium: 120000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 30 },
  { category: 'electrical-work', name: 'Проверка и измерение сопротивления изоляции', unit: 'шт', priceBudget: 30000, priceStandard: 50000, pricePremium: 80000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 31 },
  { category: 'electrical-work', name: 'Пусконаладка и тестирование', unit: 'шт', priceBudget: 60000, priceStandard: 100000, pricePremium: 160000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 32 },

  { category: 'other-work', name: 'Выезд на объект (в пределах города)', unit: 'шт', priceBudget: 150000, priceStandard: 250000, pricePremium: 400000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 40 },
  { category: 'other-work', name: 'Проектирование и согласование', unit: 'час', priceBudget: 100000, priceStandard: 200000, pricePremium: 350000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 41 },
];

export function priceForLevel(item: Pick<PriceItemData | PriceWorkItemData, 'priceBudget' | 'priceStandard' | 'pricePremium'>, level: PriceLevel): number {
  if (level === 'budget') return item.priceBudget;
  if (level === 'premium') return item.pricePremium;
  return item.priceStandard;
}

export function formatPriceRubKopecks(kopecks: number): string {
  return (kopecks / 100).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 });
}

export function parsePriceRubKopecks(value: string): number {
  const normalized = value.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, '');
  const rub = parseFloat(normalized || '0');
  return Math.round(rub * 100);
}

export function builtinItems(): PriceItemData[] {
  return BUILTIN_ITEMS.map((item, index) => ({ ...item, id: `builtin-item-${index}` }));
}

export function builtinWorkItems(): PriceWorkItemData[] {
  return BUILTIN_WORK_ITEMS.map((item, index) => ({ ...item, id: `builtin-work-${index}` }));
}

export function mergeCatalog<T extends { id: string; isBuiltin: boolean; userId?: string | null; isHiddenByAdmin: boolean; category: string; name: string; sortOrder: number }>(
  builtin: T[],
  userItems: T[],
): T[] {
  const visibleBuiltin = builtin.filter((i) => !i.isHiddenByAdmin);
  const merged = [...visibleBuiltin, ...userItems];
  merged.sort((a, b) => {
    const catA = CATEGORY_NAMES[a.category] ?? a.category;
    const catB = CATEGORY_NAMES[b.category] ?? b.category;
    if (catA !== catB) return catA.localeCompare(catB);
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  });
  return merged;
}
