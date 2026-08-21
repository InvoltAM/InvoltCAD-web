import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

async function assertDealAccess(id: string, userId: string) {
  const deal = await prisma.crmDeal.findUnique({ where: { id } })
  if (!deal) return null
  if (deal.userId !== userId) return null
  return deal
}

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/crm/deals/[id]/documents — документы по сделке
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

  const documents = await prisma.document.findMany({
    where: { crmDealId: id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(documents)
}
