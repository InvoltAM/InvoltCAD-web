import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { createPayment } from '@/lib/billing/yookassa'
import { prisma } from '@/lib/prisma'

// POST /api/billing/checkout — создание платежа
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const { planSlug, interval, creditsAmount, itemId, itemType } = body

  let amountRub: number
  let description: string
  let purpose: string
  let metadata: Record<string, string> = {}

  if (planSlug) {
    // Оплата подписки
    const plan = await prisma.plan.findUnique({
      where: { slug: planSlug },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Тариф не найден' }, { status: 404 })
    }

    amountRub = interval === 'year' ? plan.priceYearly : plan.priceMonthly
    description = `Подписка ${plan.name} (${interval === 'year' ? 'год' : 'месяц'})`
    purpose = 'subscription'
    metadata = {
      userId: user.id,
      planSlug: planSlug ?? '',
      interval: interval ?? '',
      creditsAmount: String(creditsAmount ?? 0),
    }
  } else if (creditsAmount) {
    // Покупка кредитов
    amountRub = creditsAmount * 10 // 1 кредит = 10 руб (настроить)
    description = `Покупка ${creditsAmount} кредитов`
    purpose = 'credits'
    metadata = {
      userId: user.id,
      planSlug: planSlug ?? '',
      interval: interval ?? '',
      creditsAmount: String(creditsAmount ?? 0),
    }
  } else if (itemId && itemType) {
    // Покупка маркетплейс-айтема
    if (itemType !== 'device' && itemType !== 'template') {
      return NextResponse.json({ error: 'Неверный тип товара' }, { status: 400 })
    }

    let item: { name: string; price: number | null; sellerId: string | null } | null = null
    if (itemType === 'device') {
      item = await prisma.deviceCatalogItem.findUnique({
        where: { id: itemId, published: true },
        select: { name: true, nameRu: true, price: true, sellerId: true },
      })
    } else {
      item = await prisma.projectTemplate.findUnique({
        where: { id: itemId, published: true },
        select: { name: true, price: true, sellerId: true },
      })
    }

    if (!item) {
      return NextResponse.json({ error: 'Товар не найден' }, { status: 404 })
    }

    const existingPurchase = await prisma.purchase.findFirst({
      where: {
        buyerId: user.id,
        itemType,
        deviceCatalogItemId: itemType === 'device' ? itemId : undefined,
        projectTemplateId: itemType === 'template' ? itemId : undefined,
      },
    })
    if (existingPurchase) {
      return NextResponse.json({ error: 'Товар уже куплен' }, { status: 400 })
    }

    const price = item.price ?? 0
    amountRub = price
    description = `Покупка «${item.name}»`
    purpose = 'marketplace'
    metadata = {
      userId: user.id,
      itemId,
      itemType,
      sellerId: item.sellerId ?? '',
    }
  } else {
    return NextResponse.json({ error: 'Не указан план, кредиты или товар' }, { status: 400 })
  }

  try {
    const payment = await createPayment(
      amountRub,
      description,
      `${process.env.NEXT_PUBLIC_APP_URL}/billing/success`,
      metadata
    )

    // Сохраняем платёж в БД
    await prisma.payment.create({
      data: {
        userId: user.id,
        provider: 'yookassa',
        providerPaymentId: payment.id,
        amount: Math.round(amountRub * 100), // в копейках
        currency: 'RUB',
        status: 'pending',
        purpose,
        metadata,
      },
    })

    return NextResponse.json({
      paymentId: payment.id,
      confirmationUrl: payment.confirmation?.confirmation_url,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка создания платежа'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
