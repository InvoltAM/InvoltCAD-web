import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fulfillMarketplacePurchase } from './fulfillment'

// Mock Prisma client
const mockFindFirst = vi.fn()
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockUpdateMany = vi.fn()
const mockDeleteMany = vi.fn()
const mockTransaction = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    purchase: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
    deviceCatalogItem: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    projectTemplate: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    user: {
      update: (...args: unknown[]) => mockUpdate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
    creditTransaction: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
    $transaction: (fn: unknown) => mockTransaction(fn),
  },
}))

describe('fulfillMarketplacePurchase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no existing purchases
    mockFindFirst.mockResolvedValue(null)
    mockTransaction.mockImplementation(async (fn) => {
      const tx = {
        purchase: { create: mockCreate },
        deviceCatalogItem: { update: mockUpdate },
        projectTemplate: { update: mockUpdate },
        user: { update: mockUpdate },
        creditTransaction: { create: mockCreate },
      }
      return fn(tx)
    })
  })

  it('returns error for invalid metadata', async () => {
    const result = await fulfillMarketplacePurchase('pay-1', 'buyer-1', {
      itemId: '',
      itemType: 'device',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('метаданные')
  })

  it('returns error for invalid item type', async () => {
    const result = await fulfillMarketplacePurchase('pay-1', 'buyer-1', {
      itemId: 'item-1',
      itemType: 'invalid' as 'device',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Неверный тип')
  })

  it('returns alreadyProcessed when purchase by paymentId exists', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'purchase-1' })

    const result = await fulfillMarketplacePurchase('pay-1', 'buyer-1', {
      itemId: 'dev-1',
      itemType: 'device',
    })

    expect(result.success).toBe(true)
    expect(result.alreadyProcessed).toBe(true)
    expect(result.purchaseId).toBe('purchase-1')
  })

  it('returns error when item not found', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await fulfillMarketplacePurchase('pay-1', 'buyer-1', {
      itemId: 'dev-1',
      itemType: 'device',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('не найден')
  })

  it('returns error when buyer already owns item', async () => {
    mockFindUnique.mockResolvedValue({ id: 'dev-1', price: 1000, sellerId: 'seller-1', name: 'Device', nameRu: 'Устройство' })
    // First findFirst is by paymentId (null), second is by buyer/item (exists)
    mockFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'purchase-old' })

    const result = await fulfillMarketplacePurchase('pay-1', 'buyer-1', {
      itemId: 'dev-1',
      itemType: 'device',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('уже куплен')
  })

  it('creates a paid device purchase inside a transaction', async () => {
    mockFindUnique.mockResolvedValue({ id: 'dev-1', price: 1000, sellerId: 'seller-1', name: 'Device', nameRu: 'Устройство' })
    mockCreate.mockResolvedValue({ id: 'purchase-new' })

    const result = await fulfillMarketplacePurchase('pay-1', 'buyer-1', {
      itemId: 'dev-1',
      itemType: 'device',
    })

    expect(result.success).toBe(true)
    expect(result.purchaseId).toBe('purchase-new')
    expect(mockTransaction).toHaveBeenCalled()
  })

  it('creates a free purchase without seller earnings', async () => {
    mockFindUnique.mockResolvedValue({ id: 'tpl-1', price: 0, sellerId: 'seller-1', name: 'Template' })
    mockCreate.mockResolvedValue({ id: 'purchase-free' })

    const result = await fulfillMarketplacePurchase('pay-free', 'buyer-1', {
      itemId: 'tpl-1',
      itemType: 'template',
    })

    expect(result.success).toBe(true)
    expect(result.purchaseId).toBe('purchase-free')
  })
})
