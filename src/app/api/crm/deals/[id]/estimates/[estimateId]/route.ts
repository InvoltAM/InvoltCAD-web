import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

async function assertDealAccess(id: string, userId: string) {
  const deal = await prisma.crmDeal.findUnique({ where: { id } })
  if (!deal || deal.userId !== userId) return null
  return deal
}

interface RouteParams {
  params: Promise<{ id: string; estimateId: string }>
}

async function checkEstimateAccess(dealId: string, estimateId: string, userId: string) {
  const deal = await assertDealAccess(dealId, userId)
  if (!deal) throw new Error('Сделка не найдена')
  const estimate = await prisma.estimate.findUnique({ where: { id: estimateId } })
  if (!estimate || estimate.crmDealId !== dealId) throw new Error('КП не найдено')
  return estimate
}

// PUT /api/crm/deals/[id]/estimates/[estimateId] — обновить КП
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, estimateId } = await params
  try {
    await checkEstimateAccess(id, estimateId, user.id)
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name.trim()
    if (body.total !== undefined) {
      const total = Number(body.total)
      data.total = Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0
    }
    if (body.status !== undefined) data.status = body.status

    const updated = await prisma.estimate.update({
      where: { id: estimateId },
      data,
    })

    await prisma.crmActivityLog.create({
      data: {
        userId: user.id,
        action: 'update_estimate_from_deal',
        entityType: 'deal',
        entityId: id,
        details: { estimateId, name: updated.name, status: updated.status },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// DELETE /api/crm/deals/[id]/estimates/[estimateId] — удалить КП
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, estimateId } = await params
  try {
    await checkEstimateAccess(id, estimateId, user.id)
    await prisma.estimate.delete({ where: { id: estimateId } })

    await prisma.crmActivityLog.create({
      data: {
        userId: user.id,
        action: 'delete_estimate_from_deal',
        entityType: 'deal',
        entityId: id,
        details: { estimateId },
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
