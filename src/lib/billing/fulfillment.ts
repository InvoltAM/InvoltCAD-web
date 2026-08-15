import { prisma } from '@/lib/prisma'
import { getPlanLimits } from './limits'

export async function activateSubscription(
  userId: string,
  planSlug: string,
  interval: 'month' | 'year',
  provider: string,
  providerSubscriptionId?: string
): Promise<void> {
  const plan = await prisma.plan.findUnique({
    where: { slug: planSlug },
  })

  if (!plan) {
    throw new Error(`Тариф ${planSlug} не найден`)
  }

  const now = new Date()
  const periodEnd = new Date(now)
  if (interval === 'month') {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  }

  // Деактивируем старые подписки
  await prisma.userSubscription.updateMany({
    where: {
      userId,
      status: 'active',
    },
    data: {
      status: 'cancelled',
      cancelAtPeriodEnd: true,
    },
  })

  // Создаём новую подписку
  await prisma.userSubscription.create({
    data: {
      userId,
      planId: plan.id,
      status: 'active',
      interval,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      provider,
      providerSubscriptionId,
    },
  })

  // Начисляем кредиты, включённые в тариф
  const limits = getPlanLimits(planSlug)
  if (limits.creditsIncludedMonthly > 0) {
    await prisma.creditTransaction.create({
      data: {
        userId,
        amount: limits.creditsIncludedMonthly,
        type: 'subscription_grant',
        description: `Ежемесячные кредиты по тарифу ${plan.name}`,
      },
    })

    await prisma.user.update({
      where: { id: userId },
      data: {
        credits: {
          increment: limits.creditsIncludedMonthly,
        },
      },
    })
  }
}

export async function addCredits(
  userId: string,
  amount: number,
  type: string,
  description: string,
  paymentId?: string
): Promise<void> {
  await prisma.creditTransaction.create({
    data: {
      userId,
      amount,
      type,
      description,
      paymentId,
    },
  })

  await prisma.user.update({
    where: { id: userId },
    data: {
      credits: {
        increment: amount,
      },
    },
  })
}

export async function spendCredits(
  userId: string,
  amount: number,
  description: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  })

  if (!user || user.credits < amount) {
    return false
  }

  await prisma.creditTransaction.create({
    data: {
      userId,
      amount: -amount,
      type: 'usage',
      description,
    },
  })

  await prisma.user.update({
    where: { id: userId },
    data: {
      credits: {
        decrement: amount,
      },
    },
  })

  return true
}

export interface MarketplacePurchaseMetadata {
  itemId: string
  itemType: 'device' | 'template'
}

export interface MarketplacePurchaseResult {
  success: boolean
  alreadyProcessed?: boolean
  purchaseId?: string
  error?: string
}

/**
 * Выполняет покупку маркетплейс-айтема после успешного платежа.
 * Идемпотентна: повторный вызов с тем же paymentId вернет alreadyProcessed.
 */
export async function fulfillMarketplacePurchase(
  paymentId: string,
  buyerId: string,
  metadata: MarketplacePurchaseMetadata
): Promise<MarketplacePurchaseResult> {
  const { itemId, itemType } = metadata

  if (!itemId || !itemType) {
    return { success: false, error: 'Отсутствуют метаданные товара' }
  }

  if (itemType !== 'device' && itemType !== 'template') {
    return { success: false, error: 'Неверный тип товара' }
  }

  // Идемпотентность: если Purchase для этого платежа уже есть — не создаём дубль
  const existingByPayment = await prisma.purchase.findFirst({
    where: { paymentId },
  })
  if (existingByPayment) {
    return { success: true, alreadyProcessed: true, purchaseId: existingByPayment.id }
  }

  // Ищем товар и проверяем, не куплен ли уже
  let item: { id: string; price: number | null; sellerId: string | null } | null = null
  let sellerId: string | null = null
  let itemName = ''

  if (itemType === 'device') {
    const device = await prisma.deviceCatalogItem.findUnique({
      where: { id: itemId },
      select: { id: true, price: true, sellerId: true, name: true, nameRu: true },
    })
    if (device) {
      item = device
      sellerId = device.sellerId
      itemName = device.nameRu || device.name || 'Устройство'
    }
  } else {
    const template = await prisma.projectTemplate.findUnique({
      where: { id: itemId },
      select: { id: true, price: true, sellerId: true, name: true },
    })
    if (template) {
      item = template
      sellerId = template.sellerId
      itemName = template.name || 'Шаблон'
    }
  }

  if (!item) {
    return { success: false, error: 'Товар не найден' }
  }

  const existingByBuyer = await prisma.purchase.findFirst({
    where: {
      buyerId,
      itemType,
      deviceCatalogItemId: itemType === 'device' ? itemId : undefined,
      projectTemplateId: itemType === 'template' ? itemId : undefined,
    },
  })
  if (existingByBuyer) {
    return { success: false, error: 'Товар уже куплен' }
  }

  const price = item.price ?? 0

  // Если цена 0 — просто добавляем в покупки без транзакций
  if (price === 0) {
    const purchase = await prisma.purchase.create({
      data: {
        buyerId,
        sellerId,
        itemType,
        deviceCatalogItemId: itemType === 'device' ? itemId : undefined,
        projectTemplateId: itemType === 'template' ? itemId : undefined,
        pricePaid: 0,
        platformFee: 0,
        sellerEarnings: 0,
        paymentId,
      },
    })
    return { success: true, purchaseId: purchase.id }
  }

  const platformFee = Math.round(price * 0.2) // 20% комиссия
  const sellerEarnings = price - platformFee

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        buyerId,
        sellerId,
        itemType,
        deviceCatalogItemId: itemType === 'device' ? itemId : undefined,
        projectTemplateId: itemType === 'template' ? itemId : undefined,
        pricePaid: price,
        platformFee,
        sellerEarnings,
        paymentId,
      },
    })

    if (itemType === 'device') {
      await tx.deviceCatalogItem.update({
        where: { id: itemId },
        data: { salesCount: { increment: 1 } },
      })
    } else {
      await tx.projectTemplate.update({
        where: { id: itemId },
        data: { salesCount: { increment: 1 } },
      })
    }

    if (sellerId) {
      await tx.user.update({
        where: { id: sellerId },
        data: { credits: { increment: sellerEarnings } },
      })
      await tx.creditTransaction.create({
        data: {
          userId: sellerId,
          amount: sellerEarnings,
          type: 'marketplace_sale',
          description: `Доход от продажи «${itemName}»`,
          paymentId,
        },
      })
    }

    return created
  })

  return { success: true, purchaseId: purchase.id }
}
