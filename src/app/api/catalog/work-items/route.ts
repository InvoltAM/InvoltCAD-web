import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { builtinWorkItems, mergeCatalog } from '@core/catalogs/PriceCatalog'

// GET /api/catalog/work-items — встроенные + пользовательские работы
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const userItems = await prisma.priceWorkItem.findMany({
    where: { userId: user.id },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  const all = mergeCatalog(builtinWorkItems(), userItems.map(dbToDto))
  return NextResponse.json(all)
}

// POST /api/catalog/work-items — создать пользовательскую работу
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const item = await prisma.priceWorkItem.create({
    data: {
      userId: user.id,
      category: String(body.category || 'other-work').trim(),
      name: String(body.name || '').trim(),
      unit: String(body.unit || 'шт').trim(),
      priceBudget: Math.round(Number(body.priceBudget || 0) * 100),
      priceStandard: Math.round(Number(body.priceStandard || 0) * 100),
      pricePremium: Math.round(Number(body.pricePremium || 0) * 100),
      currency: String(body.currency || 'RUB').trim(),
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
    description: item.description,
    isBuiltin: item.isBuiltin ?? false,
    isHiddenByAdmin: item.isHiddenByAdmin ?? false,
    sortOrder: item.sortOrder,
  }
}
