import { describe, it, expect } from 'vitest';
import { builtinItems, builtinWorkItems, mergeCatalog, priceForLevel, formatPriceRubKopecks, parsePriceRubKopecks, CATEGORY_NAMES } from './PriceCatalog';

describe('PriceCatalog', () => {
  it('returns built-in items with stable ids', () => {
    const items = builtinItems();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].isBuiltin).toBe(true);
    expect(items[0].id).toMatch(/^builtin-item-/);
  });

  it('selects correct price by level', () => {
    const item = { priceBudget: 100, priceStandard: 200, pricePremium: 300 };
    expect(priceForLevel(item, 'budget')).toBe(100);
    expect(priceForLevel(item, 'standard')).toBe(200);
    expect(priceForLevel(item, 'premium')).toBe(300);
  });

  it('formats and parses rubles/kopecks', () => {
    expect(formatPriceRubKopecks(12345)).toContain('123,45');
    expect(parsePriceRubKopecks('123,45')).toBe(12345);
    expect(parsePriceRubKopecks('123.45')).toBe(12345);
    expect(parsePriceRubKopecks('1 234,50')).toBe(123450);
  });

  it('merges builtin and user items sorted by category and sortOrder', () => {
    const userItems = [
      { id: 'u1', isBuiltin: false, isHiddenByAdmin: false, category: 'cable', name: 'B', sortOrder: 0, userId: 'user1', priceBudget: 0, priceStandard: 0, pricePremium: 0, unit: 'м', currency: 'RUB' },
      { id: 'u2', isBuiltin: false, isHiddenByAdmin: false, category: 'breaker', name: 'A', sortOrder: 0, userId: 'user1', priceBudget: 0, priceStandard: 0, pricePremium: 0, unit: 'шт', currency: 'RUB' },
    ];
    const merged = mergeCatalog(builtinItems(), userItems as any);
    const categories = merged.map((i) => i.category);
    expect(categories.indexOf('breaker')).toBeLessThan(categories.indexOf('cable'));
  });

  it('provides category names', () => {
    expect(CATEGORY_NAMES['cable']).toBe('Кабели');
    expect(CATEGORY_NAMES['other-work']).toBe('Прочие работы');
  });
});
