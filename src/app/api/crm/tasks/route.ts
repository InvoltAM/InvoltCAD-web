import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

// GET /api/crm/tasks — список задач
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const tasks = await prisma.crmTask.findMany({
    where: { userId: user.id },
    orderBy: { dueDate: 'asc' },
  })

  return NextResponse.json(tasks)
}

// POST /api/crm/tasks — создание задачи
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const title = body.title?.trim()
  if (!title) {
    return NextResponse.json({ error: 'Название задачи обязательно' }, { status: 400 })
  }

  const relatedType = body.relatedType ?? null
  const relatedId = body.relatedId ?? null
  if (relatedType && !['client', 'lead', 'deal', 'event'].includes(relatedType)) {
    return NextResponse.json({ error: 'Неверный тип связи' }, { status: 400 })
  }

  // Проверяем, что связанный объект принадлежит пользователю
  if (relatedId) {
    let entity = null
    switch (relatedType) {
      case 'client':
        entity = await prisma.crmClient.findUnique({ where: { id: relatedId } })
        break
      case 'lead':
        entity = await prisma.crmLead.findUnique({ where: { id: relatedId } })
        break
      case 'deal':
        entity = await prisma.crmDeal.findUnique({ where: { id: relatedId } })
        break
    }
    if (!entity || entity.userId !== user.id) {
      return NextResponse.json({ error: 'Связанный объект не найден' }, { status: 404 })
    }
  }

  const task = await prisma.crmTask.create({
    data: {
      userId: user.id,
      title,
      description: body.description?.trim() ?? null,
      status: body.status ?? 'todo',
      priority: body.priority ?? 'medium',
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      relatedType,
      relatedId,
    },
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'create_task',
      entityType: 'task',
      entityId: task.id,
      details: { title: task.title, status: task.status },
    },
  })

  return NextResponse.json(task, { status: 201 })
}
