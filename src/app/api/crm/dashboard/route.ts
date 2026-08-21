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
  const startOfMonth = new Date(year, now.getMonth(), 1)

  const [
    clientsCount,
    leadsCount,
    dealsCount,
    tasksCount,
    eventsCount,
    deals,
    recentDeals,
    recentClients,
    activityLogs,
  ] = await Promise.all([
    prisma.crmClient.count({ where: { userId } }),
    prisma.crmLead.count({ where: { userId } }),
    prisma.crmDeal.count({ where: { userId } }),
    prisma.crmTask.count({ where: { userId } }),
    prisma.crmCalendarEvent.count({ where: { userId } }),
    prisma.crmDeal.findMany({
      where: { userId },
      include: { client: { select: { name: true } } },
    }),
    prisma.crmDeal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { client: { select: { name: true } } },
    }),
    prisma.crmClient.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, company: true, createdAt: true },
    }),
    prisma.crmActivityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ])

  // Revenue by month for current year
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
  const revenueByMonth = months.map((month) => ({ month, revenue: 0 }))
  for (const deal of deals) {
    const d = new Date(deal.createdAt)
    if (d >= startOfYear) {
      revenueByMonth[d.getMonth()].revenue += deal.value / 100
    }
  }

  // Deals by stage
  const stageLabels: Record<string, string> = {
    new: 'Новая',
    negotiation: 'Переговоры',
    proposal: 'Предложение',
    won: 'Выиграно',
    lost: 'Проиграно',
  }
  const stageColors: Record<string, string> = {
    new: '#8B5CF6',
    negotiation: '#3B82F6',
    proposal: '#F59E0B',
    won: '#10B981',
    lost: '#6B7280',
  }
  const stageMap = new Map<string, number>()
  for (const deal of deals) {
    stageMap.set(deal.stage, (stageMap.get(deal.stage) || 0) + 1)
  }
  const dealsByStage = Array.from(stageMap.entries()).map(([stage, count]) => ({
    name: stageLabels[stage] ?? stage,
    value: count,
    color: stageColors[stage] ?? '#6B7280',
    stage,
  }))

  // Total revenue and debts
  const totalRevenue = deals.reduce((sum, d) => sum + d.value, 0) / 100
  const totalDebt = deals
    .filter((d) => d.stage !== 'won' && d.stage !== 'lost')
    .reduce((sum, d) => sum + d.value, 0) / 100

  // Tasks stats
  const [doneTasks, overdueTasks] = await Promise.all([
    prisma.crmTask.count({ where: { userId, status: 'done' } }),
    prisma.crmTask.count({
      where: {
        userId,
        status: { not: 'done' },
        dueDate: { lt: now },
      },
    }),
  ])

  // Recent activity items
  const activity = activityLogs.map((log) => ({
    id: log.id,
    type: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    description: formatActivityDescription(log),
    date: log.createdAt.toISOString(),
  }))

  return NextResponse.json({
    counts: {
      clients: clientsCount,
      leads: leadsCount,
      deals: dealsCount,
      tasks: tasksCount,
      events: eventsCount,
    },
    kpi: {
      totalRevenue,
      totalDebt,
      doneTasks,
      overdueTasks,
    },
    revenueByMonth,
    dealsByStage,
    recentDeals: recentDeals.map((d) => ({
      id: d.id,
      name: d.title,
      client: d.client?.name ?? '—',
      value: d.value / 100,
      stage: d.stage,
      createdAt: d.createdAt.toISOString(),
    })),
    recentClients,
    activity,
  })
}

function formatActivityDescription(log: { action: string; entityType: string | null; details: unknown }): string {
  const details = typeof log.details === 'object' && log.details !== null ? log.details as Record<string, unknown> : {}
  switch (log.action) {
    case 'create_client':
      return `Добавлен клиент «${details.name ?? '—'}»`
    case 'update_client':
      return `Обновлен клиент «${details.name ?? '—'}»`
    case 'create_deal':
      return `Создана сделка «${details.title ?? '—'}»`
    case 'update_deal_stage':
      return `Сделка «${details.title ?? '—'}» перешла на этап «${details.stage ?? '—'}»`
    case 'create_task':
      return `Добавлена задача «${details.title ?? '—'}»`
    case 'complete_task':
      return `Задача «${details.title ?? '—'}» выполнена`
    case 'create_event':
      return `Добавлено событие «${details.title ?? '—'}»`
    case 'send_email':
      return `Отправлено письмо «${details.subject ?? '—'}»`
    default:
      return `${log.action}${log.entityType ? ` (${log.entityType})` : ''}`
  }
}
