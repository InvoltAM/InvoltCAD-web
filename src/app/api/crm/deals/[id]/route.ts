import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

async function assertDealAccess(id: string, userId: string) {
  const deal = await prisma.crmDeal.findUnique({
    where: { id },
  })
  if (!deal) return null
  if (deal.userId !== userId) return null
  return deal
}

// PATCH /api/crm/deals/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const deal = await assertDealAccess(id, user.id)
  if (!deal) {
    return NextResponse.json({ error: 'Сделка не найдена' }, { status: 404 })
  }

  const body = await request.json()
  const data: Record<string, unknown> = {}

  if (body.title !== undefined) data.title = body.title.trim()
  if (body.clientId !== undefined) {
    if (body.clientId) {
      const client = await prisma.crmClient.findUnique({ where: { id: body.clientId } })
      if (!client || client.userId !== user.id) {
        return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
      }
      data.clientId = body.clientId
    } else {
      data.clientId = null
    }
  }
  if (body.value !== undefined) {
    const value = Number(body.value)
    data.value = Number.isFinite(value) ? value : 0
  }
  if (body.currency !== undefined) data.currency = body.currency?.trim() ?? 'RUB'
  if (body.stage !== undefined) data.stage = body.stage
  if (body.probability !== undefined) {
    const probability = Number(body.probability)
    data.probability = Number.isFinite(probability) ? Math.max(0, Math.min(100, probability)) : 0
  }
  if (body.expectedCloseDate !== undefined) {
    data.expectedCloseDate = body.expectedCloseDate ? new Date(body.expectedCloseDate) : null
  }
  if (body.closedAt !== undefined) {
    data.closedAt = body.closedAt ? new Date(body.closedAt) : null
  }

  const updated = await prisma.crmDeal.update({
    where: { id },
    data,
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'update_deal',
      entityType: 'deal',
      entityId: id,
      details: { title: updated.title, stage: updated.stage },
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/crm/deals/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const deal = await assertDealAccess(id, user.id)
  if (!deal) {
    return NextResponse.json({ error: 'Сделка не найдена' }, { status: 404 })
  }

  await prisma.crmDeal.delete({ where: { id } })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'delete_deal',
      entityType: 'deal',
      entityId: id,
      details: { title: deal.title },
    },
  })

  return NextResponse.json({ success: true })
}
