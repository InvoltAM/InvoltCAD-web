import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { spendCredits } from '@/lib/billing/fulfillment'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/marketplace/items/[id] — детали товара
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params

  // Ищем в устройствах
  const device = await prisma.deviceCatalogItem.findUnique({
    where: { id },
    include: {
      seller: { select: { id: true, name: true, image: true } },
      reviews: {
        include: {
          buyer: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (device) {
    return NextResponse.json({
      id: device.id,
      type: 'device',
      name: device.nameRu || device.name,
      description: device.deviceType,
      category: device.category,
      price: device.price,
      currency: device.currency,
      salesCount: device.salesCount,
      seller: device.seller,
      svg: device.svg,
      width: device.width,
      height: device.height,
      defaultHeight: device.defaultHeight,
      properties: device.properties,
      reviews: device.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        buyer: r.buyer,
        createdAt: r.createdAt,
      })),
    })
  }

  // Ищем в шаблонах
  const template = await prisma.projectTemplate.findUnique({
    where: { id },
    include: {
      seller: { select: { id: true, name: true, image: true } },
      reviews: {
        include: {
          buyer: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!template) {
    return NextResponse.json({ error: 'Товар не найден' }, { status: 404 })
  }

  return NextResponse.json({
    id: template.id,
    type: 'template',
    name: template.name,
    description: template.description,
    category: template.category,
    price: template.price,
    currency: template.currency,
    salesCount: template.salesCount,
    seller: template.seller,
    thumbnail: template.thumbnail,
    data: template.data,
    reviews: template.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      buyer: r.buyer,
      createdAt: r.createdAt,
    })),
  })
}

// POST /api/marketplace/items/[id]/purchase — покупка товара
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params

  // Ищем товар
  let item: { id: string; price: number | null; sellerId: string | null } | null = null
  let itemType: 'device' | 'template' = 'device'
  let sellerId: string | null = null

  const device = await prisma.deviceCatalogItem.findUnique({
    where: { id },
    select: { id: true, price: true, sellerId: true },
  })

  if (device) {
    item = device
    itemType = 'device'
    sellerId = device.sellerId
  } else {
    const template = await prisma.projectTemplate.findUnique({
      where: { id },
      select: { id: true, price: true, sellerId: true },
    })
    if (!template) {
      return NextResponse.json({ error: 'Товар не найден' }, { status: 404 })
    }
    item = template
    itemType = 'template'
    sellerId = template.sellerId
  }

  // Проверяем, не куплен ли уже
  const existingPurchase = await prisma.purchase.findFirst({
    where: {
      buyerId: user.id,
      itemType,
      deviceCatalogItemId: itemType === 'device' ? id : undefined,
      projectTemplateId: itemType === 'template' ? id : undefined,
    },
  })

  if (existingPurchase) {
    return NextResponse.json({ error: 'Товар уже куплен' }, { status: 400 })
  }

  const price = item.price ?? 0

  // Если цена 0 — просто добавляем в покупки
  if (price === 0) {
    await prisma.purchase.create({
      data: {
        buyerId: user.id,
        sellerId,
        itemType,
        deviceCatalogItemId: itemType === 'device' ? id : undefined,
        projectTemplateId: itemType === 'template' ? id : undefined,
        pricePaid: 0,
        platformFee: 0,
        sellerEarnings: 0,
      },
    })

    return NextResponse.json({ success: true, free: true })
  }

  // Списываем кредиты
  const success = await spendCredits(user.id, price, `Покупка ${itemType === 'device' ? 'устройства' : 'шаблона'}`)

  if (!success) {
    return NextResponse.json({ error: 'Недостаточно кредитов' }, { status: 402 })
  }

  // Рассчитываем комиссию и доход продавца
  const platformFee = Math.round(price * 0.2) // 20% комиссия
  const sellerEarnings = price - platformFee

  // Создаём покупку
  const purchase = await prisma.purchase.create({
    data: {
      buyerId: user.id,
      sellerId,
      itemType,
      deviceCatalogItemId: itemType === 'device' ? id : undefined,
      projectTemplateId: itemType === 'template' ? id : undefined,
      pricePaid: price,
      platformFee,
      sellerEarnings,
    },
  })

  // Увеличиваем счётчик продаж
  if (itemType === 'device') {
    await prisma.deviceCatalogItem.update({
      where: { id },
      data: { salesCount: { increment: 1 } },
    })
  } else {
    await prisma.projectTemplate.update({
      where: { id },
      data: { salesCount: { increment: 1 } },
    })
  }

  // Начисляем доход продавцу
  if (sellerId) {
    await prisma.user.update({
      where: { id: sellerId },
      data: { credits: { increment: sellerEarnings } },
    })
  }

  return NextResponse.json({ success: true, purchaseId: purchase.id })
}
