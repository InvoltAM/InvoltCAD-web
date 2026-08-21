import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

async function assertTaskAccess(id: string, userId: string) {
  const task = await prisma.crmTask.findUnique({
    where: { id },
  })
  if (!task) return null
  if (task.userId !== userId) return null
  return task
}

// PATCH /api/crm/tasks/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const task = await assertTaskAccess(id, user.id)
  if (!task) {
    return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 })
  }

  const body = await request.json()
  const data: Record<string, unknown> = {}

  if (body.title !== undefined) data.title = body.title.trim()
  if (body.description !== undefined) data.description = body.description?.trim() ?? null
  if (body.status !== undefined) data.status = body.status
  if (body.priority !== undefined) data.priority = body.priority
  if (body.dueDate !== undefined) {
    data.dueDate = body.dueDate ? new Date(body.dueDate) : null
  }

  if (body.relatedType !== undefined || body.relatedId !== undefined) {
    const relatedType = body.relatedType ?? task.relatedType
    const relatedId = body.relatedId ?? task.relatedId

    if (relatedType && !['client', 'lead', 'deal', 'event'].includes(relatedType)) {
      return NextResponse.json({ error: 'Неверный тип связи' }, { status: 400 })
    }

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

    data.relatedType = relatedType
    data.relatedId = relatedId
  }

  const updated = await prisma.crmTask.update({
    where: { id },
    data,
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'update_task',
      entityType: 'task',
      entityId: id,
      details: { title: updated.title, status: updated.status },
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/crm/tasks/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const task = await assertTaskAccess(id, user.id)
  if (!task) {
    return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 })
  }

  await prisma.crmTask.delete({ where: { id } })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'delete_task',
      entityType: 'task',
      entityId: id,
      details: { title: task.title },
    },
  })

  return NextResponse.json({ success: true })
}
