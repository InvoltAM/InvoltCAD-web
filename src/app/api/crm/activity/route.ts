import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

const ACTION_LABELS: Record<string, string> = {
  create_client: 'Создан клиент',
  update_client: 'Обновлён клиент',
  delete_client: 'Удалён клиент',
  create_lead: 'Создан лид',
  update_lead: 'Обновлён лид',
  delete_lead: 'Удалён лид',
  create_deal: 'Создана сделка',
  update_deal: 'Обновлена сделка',
  delete_deal: 'Удалена сделка',
  create_task: 'Создана задача',
  update_task: 'Обновлена задача',
  delete_task: 'Удалена задача',
  create_event: 'Создано событие',
  update_event: 'Обновлено событие',
  delete_event: 'Удалено событие',
}

// GET /api/crm/activity — лента активности
export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100)
  const offset = Math.max(Number(searchParams.get('offset') ?? '0'), 0)

  const logs = await prisma.crmActivityLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  })

  return NextResponse.json(
    logs.map((log) => ({
      ...log,
      actionLabel: ACTION_LABELS[log.action] ?? log.action,
    }))
  )
}
