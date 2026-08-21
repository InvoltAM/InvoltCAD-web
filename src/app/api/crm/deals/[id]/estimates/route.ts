import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

async function assertDealAccess(id: string, userId: string) {
  const deal = await prisma.crmDeal.findUnique({
    where: { id },
    include: { projects: { take: 1, select: { id: true } } },
  })
  if (!deal) return null
  if (deal.userId !== userId) return null
  return deal
}

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/crm/deals/[id]/estimates — КП по сделке
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const deal = await assertDealAccess(id, user.id)
  if (!deal) {
    return NextResponse.json({ error: 'Сделка не найдена' }, { status: 404 })
  }

  const estimates = await prisma.estimate.findMany({
    where: { crmDealId: id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(estimates)
}

// POST /api/crm/deals/[id]/estimates — создать КП из сделки
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const deal = await assertDealAccess(id, user.id)
  if (!deal) {
    return NextResponse.json({ error: 'Сделка не найдена' }, { status: 404 })
  }

  const projectId = deal.projects[0]?.id
  if (!projectId) {
    return NextResponse.json({ error: 'У сделки нет связанного проекта' }, { status: 400 })
  }

  const body = await request.json()
  const name = body.name?.trim() || `КП по сделке «${deal.title}»`

  const estimate = await prisma.estimate.create({
    data: {
      projectId,
      crmDealId: id,
      name,
      total: deal.value,
      status: 'draft',
    },
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'create_estimate_from_deal',
      entityType: 'deal',
      entityId: id,
      details: { estimateId: estimate.id, projectId, name },
    },
  })

  return NextResponse.json(estimate, { status: 201 })
}
