import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

const STAGES = ['new', 'negotiation', 'proposal', 'won', 'lost'] as const

// GET /api/crm/deals/funnel — сделки, сгруппированные по этапам воронки
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const deals = await prisma.crmDeal.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: { client: { select: { name: true } } },
  })

  const columns = STAGES.map((stage) => ({
    stage,
    deals: deals.filter((d) => d.stage === stage),
    count: 0,
    value: 0,
  }))

  for (const col of columns) {
    col.count = col.deals.length
    col.value = col.deals.reduce((sum, d) => sum + d.value, 0)
  }

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0)
  const wonValue = columns.find((c) => c.stage === 'won')?.value ?? 0
  const conversionRate = totalValue > 0 ? (wonValue / totalValue) * 100 : 0

  return NextResponse.json({ columns, totalValue, wonValue, conversionRate })
}
