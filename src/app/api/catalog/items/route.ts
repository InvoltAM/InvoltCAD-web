import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { builtinItems, mergeCatalog } from '@core/catalogs/PriceCatalog'

// GET /api/catalog/items — встроенные + пользовательские позиции материалов
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const userItems = await prisma.priceItem.findMany({
    where: { userId: user.id },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  const all = mergeCatalog(builtinItems(), userItems.map(dbToDto))
  return NextResponse.json(all)
}

// POST /api/catalog/items — создать пользовательскую позицию материала
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const item = await prisma.priceItem.create({
    data: {
      userId: user.id,
      category: String(body.category || 'other').trim(),
      name: String(body.name || '').trim(),
      unit: String(body.unit || 'шт').trim(),
      priceBudget: Math.round(Number(body.priceBudget || 0) * 100),
      priceStandard: Math.round(Number(body.priceStandard || 0) * 100),
      pricePremium: Math.round(Number(body.pricePremium || 0) * 100),
      currency: String(body.currency || 'RUB').trim(),
      vendor: body.vendor ? String(body.vendor).trim() : null,
      sku: body.sku ? String(body.sku).trim() : null,
      article: body.article ? String(body.article).trim() : null,
      description: body.description ? String(body.description).trim() : null,
      sortOrder: Number(body.sortOrder ?? 0),
    },
  })

  return NextResponse.json(dbToDto(item), { status: 201 })
}

function dbToDto(item: any) {
  return {
    id: item.id,
    userId: item.userId,
    category: item.category,
    name: item.name,
    unit: item.unit,
    priceBudget: item.priceBudget,
    priceStandard: item.priceStandard,
    pricePremium: item.pricePremium,
    currency: item.currency,
    vendor: item.vendor,
    sku: item.sku,
    article: item.article,
    description: item.description,
    isBuiltin: item.isBuiltin ?? false,
    isHiddenByAdmin: item.isHiddenByAdmin ?? false,
    sortOrder: item.sortOrder,
  }
}
