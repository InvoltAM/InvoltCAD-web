import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  const user = session?.user
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = user.id
  const now = new Date()
  const year = now.getFullYear()
  const startOfYear = new Date(year, 0, 1)

  const [clients, leads, deals, tasks] = await Promise.all([
    prisma.crmClient.findMany({ where: { userId } }),
    prisma.crmLead.findMany({ where: { userId } }),
    prisma.crmDeal.findMany({ where: { userId }, include: { client: { select: { name: true } } } }),
    prisma.crmTask.findMany({ where: { userId } }),
  ])

  // Status distributions
  const clientStatus = groupCount(clients, 'status')
  const leadStatus = groupCount(leads, 'status')
  const dealStage = groupCount(deals, 'stage')
  const taskStatus = groupCount(tasks, 'status')

  // Revenue by month
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
  const revenueByMonth = months.map((month) => ({ month, revenue: 0, deals: 0 }))
  for (const deal of deals) {
    const d = new Date(deal.createdAt)
    if (d >= startOfYear) {
      revenueByMonth[d.getMonth()].revenue += deal.value / 100
      revenueByMonth[d.getMonth()].deals += 1
    }
  }

  // Conversion: leads -> deals
  const conversionRate = leads.length > 0 ? Math.round((deals.length / leads.length) * 100) : 0

  // Won deals revenue
  const wonDeals = deals.filter((d) => d.stage === 'won')
  const wonRevenue = wonDeals.reduce((sum, d) => sum + d.value, 0) / 100

  // Top clients by deal value
  const clientValues = new Map<string, { name: string; value: number; deals: number }>()
  for (const deal of deals) {
    if (!deal.clientId) continue
    const existing = clientValues.get(deal.clientId)
    if (existing) {
      existing.value += deal.value / 100
      existing.deals += 1
    } else {
      clientValues.set(deal.clientId, {
        name: deal.client?.name ?? '—',
        value: deal.value / 100,
        deals: 1,
      })
    }
  }
  const topClients = Array.from(clientValues.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  // Task completion rate
  const totalTasks = tasks.length
  const doneTasks = tasks.filter((t) => t.status === 'done').length
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  return NextResponse.json({
    totals: {
      clients: clients.length,
      leads: leads.length,
      deals: deals.length,
      tasks: totalTasks,
      wonRevenue,
      conversionRate,
      completionRate,
    },
    distributions: {
      clientStatus,
      leadStatus,
      dealStage,
      taskStatus,
    },
    revenueByMonth,
    topClients,
  })
}

function groupCount<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  const map = new Map<string, number>()
  for (const item of items) {
    const value = String(item[key] ?? 'unknown')
    map.set(value, (map.get(value) || 0) + 1)
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
}
