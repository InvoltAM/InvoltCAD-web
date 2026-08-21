import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

async function assertEventAccess(id: string, userId: string) {
  const event = await prisma.crmCalendarEvent.findUnique({
    where: { id },
  })
  if (!event) return null
  if (event.userId !== userId) return null
  return event
}

// PATCH /api/crm/events/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const event = await assertEventAccess(id, user.id)
  if (!event) {
    return NextResponse.json({ error: 'Событие не найдено' }, { status: 404 })
  }

  const body = await request.json()
  const data: Record<string, unknown> = {}

  if (body.title !== undefined) data.title = body.title.trim()
  if (body.start !== undefined) data.start = new Date(body.start)
  if (body.end !== undefined) data.end = body.end ? new Date(body.end) : null
  if (body.allDay !== undefined) data.allDay = body.allDay
  if (body.type !== undefined) data.type = body.type

  if (body.relatedType !== undefined || body.relatedId !== undefined) {
    const relatedType = body.relatedType ?? event.relatedType
    const relatedId = body.relatedId ?? event.relatedId

    if (relatedType && !['client', 'lead', 'deal'].includes(relatedType)) {
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

  const updated = await prisma.crmCalendarEvent.update({
    where: { id },
    data,
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'update_event',
      entityType: 'event',
      entityId: id,
      details: { title: updated.title, start: updated.start.toISOString() },
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/crm/events/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const event = await assertEventAccess(id, user.id)
  if (!event) {
    return NextResponse.json({ error: 'Событие не найдено' }, { status: 404 })
  }

  await prisma.crmCalendarEvent.delete({ where: { id } })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'delete_event',
      entityType: 'event',
      entityId: id,
      details: { title: event.title },
    },
  })

  return NextResponse.json({ success: true })
}
