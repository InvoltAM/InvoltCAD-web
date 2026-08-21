import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

// GET /api/crm/events — список событий календаря
export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Record<string, unknown> = { userId: user.id }
  if (from || to) {
    where.start = {}
    if (from) (where.start as Record<string, Date>).gte = new Date(from)
    if (to) (where.start as Record<string, Date>).lte = new Date(to)
  }

  const events = await prisma.crmCalendarEvent.findMany({
    where,
    orderBy: { start: 'asc' },
  })

  return NextResponse.json(events)
}

// POST /api/crm/events — создание события
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const title = body.title?.trim()
  if (!title) {
    return NextResponse.json({ error: 'Название события обязательно' }, { status: 400 })
  }
  if (!body.start) {
    return NextResponse.json({ error: 'Дата начала обязательна' }, { status: 400 })
  }

  const relatedType = body.relatedType ?? null
  const relatedId = body.relatedId ?? null
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

  const start = new Date(body.start)
  const end = body.end ? new Date(body.end) : null

  const event = await prisma.crmCalendarEvent.create({
    data: {
      userId: user.id,
      title,
      start,
      end,
      allDay: body.allDay ?? false,
      type: body.type ?? 'meeting',
      relatedType,
      relatedId,
    },
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'create_event',
      entityType: 'event',
      entityId: event.id,
      details: { title: event.title, start: event.start.toISOString() },
    },
  })

  return NextResponse.json(event, { status: 201 })
}
