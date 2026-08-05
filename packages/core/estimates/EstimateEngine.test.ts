import { describe, it, expect } from 'vitest';
import { buildEstimateFromSpecification, recalcEstimate, buildInvoiceFromEstimate, generateEstimateDocument, generateContractDocument, generateActDocument, generateSpecDocument } from './EstimateEngine';
import { CableSpecificationItem } from '../electrical/CableRunEngine';
import { PriceItemData, PriceWorkItemData } from '../catalogs/PriceCatalog';

describe('EstimateEngine', () => {
  const catalogItems: PriceItemData[] = [
    { id: 'c1', category: 'cable', name: 'ВВГнг 3x2.5', unit: 'м', priceBudget: 6500, priceStandard: 9500, pricePremium: 14000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 0 },
  ];
  const workItems: PriceWorkItemData[] = [
    { id: 'w1', category: 'cable-laying', name: 'Прокладка кабеля в гофре', unit: 'м', priceBudget: 8000, priceStandard: 12000, pricePremium: 18000, currency: 'RUB', isBuiltin: true, isHiddenByAdmin: false, sortOrder: 0 },
  ];

  it('builds estimate from specification', () => {
    const spec: CableSpecificationItem[] = [
      { id: 's1', category: 'cable', name: 'Кабель силовой 2.5 мм²', unit: 'м', quantity: 10 },
    ];
    const estimate = buildEstimateFromSpecification(spec, catalogItems, workItems, 'standard', { projectId: 'p1' });
    expect(estimate.items).toHaveLength(2); // material + work
    expect(estimate.items[0].total).toBe(95000); // 9500 * 10
    expect(estimate.items[1].total).toBe(120000); // 12000 * 10
  });

  it('recalculates totals with discount and vat', () => {
    const estimate = recalcEstimate({
      id: '1',
      projectId: 'p1',
      name: 'Test',
      priceLevel: 'standard',
      discountPercent: 10,
      vatPercent: 20,
      totalMaterial: 0,
      totalWork: 0,
      total: 0,
      status: 'draft',
      items: [
        { id: 'i1', itemType: 'material', name: 'M', unit: 'шт', quantity: 2, price: 10000, total: 20000, sortOrder: 0 },
        { id: 'i2', itemType: 'work', name: 'W', unit: 'шт', quantity: 1, price: 50000, total: 50000, sortOrder: 1 },
      ],
    });
    expect(estimate.totalMaterial).toBe(20000);
    expect(estimate.totalWork).toBe(50000);
    const subtotal = 70000;
    const discount = 7000;
    const after = 63000;
    const vat = Math.round(after * 0.2);
    expect(estimate.total).toBe(after + vat);
  });

  it('builds invoice from estimate', () => {
    const estimate = recalcEstimate({
      id: 'e1',
      projectId: 'p1',
      name: 'Test',
      priceLevel: 'standard',
      discountPercent: 0,
      vatPercent: 20,
      totalMaterial: 0,
      totalWork: 0,
      total: 0,
      status: 'draft',
      items: [
        { id: 'i1', itemType: 'material', name: 'M', unit: 'шт', quantity: 1, price: 12000, total: 12000, sortOrder: 0 },
      ],
    });
    const invoice = buildInvoiceFromEstimate(estimate, 'СЧ-001');
    expect(invoice.amount).toBe(estimate.total);
    expect(invoice.number).toBe('СЧ-001');
  });

  it('generates documents', () => {
    const estimate = recalcEstimate({
      id: 'e1', projectId: 'p1', name: 'Смета', priceLevel: 'standard', discountPercent: 0, vatPercent: 20,
      totalMaterial: 0, totalWork: 0, total: 0, status: 'draft',
      items: [{ id: 'i1', itemType: 'material', name: 'Кабель', unit: 'м', quantity: 10, price: 10000, total: 100000, sortOrder: 0 }],
    });
    expect(generateEstimateDocument(estimate, 'Квартира')).toContain('КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ');
    expect(generateContractDocument('Квартира', estimate)).toContain('ДОГОВОР ПОДРЯДА');
    expect(generateActDocument('Квартира', estimate)).toContain('АКТ ВЫПОЛНЕННЫХ РАБОТ');
    expect(generateSpecDocument(estimate)).toContain('СПЕЦИФИКАЦИЯ');
  });
});
