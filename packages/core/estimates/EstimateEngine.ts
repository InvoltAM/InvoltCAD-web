import { CableSpecificationItem } from '../electrical/CableRunEngine';
import { PriceItemData, PriceWorkItemData, PriceLevel, priceForLevel } from '../catalogs/PriceCatalog';

export type EstimateItemType = 'material' | 'work';
export type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export interface EstimateItemData {
  id: string;
  itemType: EstimateItemType;
  name: string;
  unit: string;
  quantity: number;
  price: number; // в копейках
  total: number; // в копейках
  sortOrder: number;
  priceItemId?: string;
}

export interface EstimateData {
  id: string;
  projectId: string;
  name: string;
  priceLevel: PriceLevel;
  discountPercent: number;
  vatPercent: number;
  totalMaterial: number;
  totalWork: number;
  total: number;
  status: EstimateStatus;
  publicSlug?: string;
  publicExpiresAt?: string;
  items: EstimateItemData[];
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceData {
  id: string;
  projectId: string;
  estimateId?: string;
  number: string;
  amount: number;
  currency: string;
  vatPercent: number;
  vatAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'cancelled';
  dueDate?: string;
  paidAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentData {
  id: string;
  projectId: string;
  type: 'contract' | 'act' | 'invoice' | 'estimate' | 'spec';
  name: string;
  status: string;
  content?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function buildEstimateFromSpecification(
  spec: CableSpecificationItem[],
  catalogItems: PriceItemData[],
  workItems: PriceWorkItemData[],
  priceLevel: PriceLevel,
  options: { name?: string; projectId: string; vatPercent?: number; discountPercent?: number } = { projectId: '' }
): EstimateData {
  const items: EstimateItemData[] = [];
  let sortOrder = 0;

  for (const specItem of spec) {
    const catalogItem = catalogItems.find((c) => c.category === specItem.category && c.unit === specItem.unit);
    if (catalogItem) {
      const price = priceForLevel(catalogItem, priceLevel);
      items.push({
        id: `item-${sortOrder}`,
        itemType: 'material',
        name: catalogItem.name,
        unit: catalogItem.unit,
        quantity: specItem.quantity,
        price,
        total: Math.round(price * specItem.quantity),
        sortOrder: sortOrder++,
        priceItemId: catalogItem.id,
      });
    } else {
      // Fallback: price 0, to be filled by user
      items.push({
        id: `item-${sortOrder}`,
        itemType: 'material',
        name: specItem.name,
        unit: specItem.unit,
        quantity: specItem.quantity,
        price: 0,
        total: 0,
        sortOrder: sortOrder++,
      });
    }
  }

  // Add default works based on quantities: 1 m cable laying per 1 m cable, 1 device install per item if applicable
  for (const specItem of spec) {
    if (specItem.category === 'cable') {
      const work = workItems.find((w) => w.category === 'cable-laying' && w.name.includes('гофре'));
      if (work) {
        const price = priceForLevel(work, priceLevel);
        items.push({
          id: `item-${sortOrder}`,
          itemType: 'work',
          name: work.name,
          unit: work.unit,
          quantity: specItem.quantity,
          price,
          total: Math.round(price * specItem.quantity),
          sortOrder: sortOrder++,
          priceItemId: work.id,
        });
      }
    }
  }

  const estimate = recalcEstimate({
    id: 'new',
    projectId: options.projectId,
    name: options.name || 'Смета от ' + new Date().toLocaleDateString('ru-RU'),
    priceLevel,
    discountPercent: options.discountPercent ?? 0,
    vatPercent: options.vatPercent ?? 0,
    totalMaterial: 0,
    totalWork: 0,
    total: 0,
    status: 'draft',
    items,
  });

  return estimate;
}

export function recalcEstimate(estimate: EstimateData): EstimateData {
  const totalMaterial = estimate.items
    .filter((i) => i.itemType === 'material')
    .reduce((sum, i) => sum + i.total, 0);
  const totalWork = estimate.items
    .filter((i) => i.itemType === 'work')
    .reduce((sum, i) => sum + i.total, 0);
  const subtotal = totalMaterial + totalWork;
  const discount = Math.round(subtotal * (estimate.discountPercent / 100));
  const afterDiscount = subtotal - discount;
  const vat = Math.round(afterDiscount * (estimate.vatPercent / 100));
  estimate.totalMaterial = totalMaterial;
  estimate.totalWork = totalWork;
  estimate.total = afterDiscount + vat;
  return estimate;
}

export function buildInvoiceFromEstimate(estimate: EstimateData, number: string): InvoiceData {
  return {
    id: 'new',
    projectId: estimate.projectId,
    estimateId: estimate.id,
    number,
    amount: estimate.total,
    currency: 'RUB',
    vatPercent: estimate.vatPercent,
    vatAmount: Math.round(estimate.total * (estimate.vatPercent / 100) / (1 + estimate.vatPercent / 100)),
    status: 'draft',
  };
}

export function generateEstimateDocument(estimate: EstimateData, projectName: string): string {
  const lines = [
    `КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ`,
    `Проект: ${projectName}`,
    `Смета: ${estimate.name}`,
    `Уровень цен: ${estimate.priceLevel === 'budget' ? 'Бюджет' : estimate.priceLevel === 'premium' ? 'Премиум' : 'Стандарт'}`,
    ``,
    `№ | Наименование | Ед. | Кол-во | Цена | Сумма`,
  ];
  for (let i = 0; i < estimate.items.length; i++) {
    const item = estimate.items[i];
    lines.push(`${i + 1} | ${item.name} | ${item.unit} | ${item.quantity} | ${(item.price / 100).toFixed(2)} | ${(item.total / 100).toFixed(2)}`);
  }
  lines.push('');
  lines.push(`Материалы: ${(estimate.totalMaterial / 100).toFixed(2)} ₽`);
  lines.push(`Работы: ${(estimate.totalWork / 100).toFixed(2)} ₽`);
  if (estimate.discountPercent > 0) lines.push(`Скидка ${estimate.discountPercent}%`);
  if (estimate.vatPercent > 0) lines.push(`НДС ${estimate.vatPercent}%`);
  lines.push(`ИТОГО: ${(estimate.total / 100).toFixed(2)} ₽`);
  lines.push('');
  lines.push('Срок и условия поставки по договорённости.');
  return lines.join('\n');
}

export function generateContractDocument(projectName: string, estimate: EstimateData, contractor?: string, customer?: string): string {
  const lines = [
    `ДОГОВОР ПОДРЯДА № ___`,
    ``,
    `г. _____________ «___» __________ 20___ г.`,
    ``,
    `Исполнитель: ${contractor || '_______________________'}`,
    `Заказчик: ${customer || '_______________________'}`,
    ``,
    `1. Предмет договора`,
    `Исполнитель обязуется выполнить электромонтажные работы по проекту «${projectName}», а Заказчик обязуется принять и оплатить результат.`,
    ``,
    `2. Стоимость работ и материалов`,
    `Общая стоимость по смете «${estimate.name}» составляет ${(estimate.total / 100).toFixed(2)} ₽ (в т.ч. НДС ${estimate.vatPercent}%).`,
    ``,
    `3. Сроки и оплата`,
    `Срок выполнения работ — по согласованию сторон. Оплата производится по счету, выставляемому Исполнителем.`,
    ``,
    `4. Подписи сторон`,
    `Исполнитель: _______________________`,
    `Заказчик: _______________________`,
  ];
  return lines.join('\n');
}

export function generateActDocument(projectName: string, estimate: EstimateData): string {
  const lines = [
    `АКТ ВЫПОЛНЕННЫХ РАБОТ`,
    ``,
    `Проект: ${projectName}`,
    `Смета: ${estimate.name}`,
    ``,
    `Стороны удостоверяют, что Исполнителем выполнены следующие работы и поставлены материалы:`,
    ``,
    `№ | Наименование | Ед. | Кол-во | Сумма`,
  ];
  for (let i = 0; i < estimate.items.length; i++) {
    const item = estimate.items[i];
    lines.push(`${i + 1} | ${item.name} | ${item.unit} | ${item.quantity} | ${(item.total / 100).toFixed(2)}`);
  }
  lines.push('');
  lines.push(`Общая стоимость: ${(estimate.total / 100).toFixed(2)} ₽`);
  lines.push('');
  lines.push('Подписи:');
  lines.push('Исполнитель: _______________________');
  lines.push('Заказчик: _______________________');
  return lines.join('\n');
}

export function generateSpecDocument(estimate: EstimateData): string {
  const lines = [
    `СПЕЦИФИКАЦИЯ МАТЕРИАЛОВ И РАБОТ`,
    ``,
    `Смета: ${estimate.name}`,
    ``,
    `№ | Наименование | Ед. | Кол-во | Цена | Сумма`,
  ];
  for (let i = 0; i < estimate.items.length; i++) {
    const item = estimate.items[i];
    lines.push(`${i + 1} | ${item.name} | ${item.unit} | ${item.quantity} | ${(item.price / 100).toFixed(2)} | ${(item.total / 100).toFixed(2)}`);
  }
  return lines.join('\n');
}
