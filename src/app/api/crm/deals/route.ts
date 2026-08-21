import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

// GET /api/crm/deals — список сделок
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const deals = await prisma.crmDeal.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: { client: { select: { id: true, name: true } } },
  })

  return NextResponse.json(deals)
}

// POST /api/crm/deals — создание сделки
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const title = body.title?.trim()
  if (!title) {
    return NextResponse.json({ error: 'Название сделки обязательно' }, { status: 400 })
  }

  // Если указан clientId, проверяем, что клиент принадлежит пользователю
  if (body.clientId) {
    const client = await prisma.crmClient.findUnique({
      where: { id: body.clientId },
    })
    if (!client || client.userId !== user.id) {
      return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
    }
  }

  const value = body.value !== undefined ? Number(body.value) : 0
  const probability = body.probability !== undefined ? Number(body.probability) : 0

  const deal = await prisma.crmDeal.create({
    data: {
      userId: user.id,
      clientId: body.clientId ?? null,
      title,
      value: Number.isFinite(value) ? value : 0,
      currency: body.currency?.trim() ?? 'RUB',
      stage: body.stage ?? 'new',
      probability: Number.isFinite(probability) ? Math.max(0, Math.min(100, probability)) : 0,
      expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
    },
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'create_deal',
      entityType: 'deal',
      entityId: deal.id,
      details: { title: deal.title, value: deal.value, stage: deal.stage },
    },
  })

  return NextResponse.json(deal, { status: 201 })
}
