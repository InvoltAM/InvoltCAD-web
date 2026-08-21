import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

// GET /api/crm/leads — список лидов
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const leads = await prisma.crmLead.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(leads)
}

// POST /api/crm/leads — создание лида
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'Имя лида обязательно' }, { status: 400 })
  }

  const lead = await prisma.crmLead.create({
    data: {
      userId: user.id,
      name,
      email: body.email?.trim() ?? null,
      phone: body.phone?.trim() ?? null,
      company: body.company?.trim() ?? null,
      status: body.status ?? 'new',
      source: body.source?.trim() ?? null,
      notes: body.notes?.trim() ?? null,
      telegramChatId: body.telegramChatId?.trim() ?? null,
    },
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'create_lead',
      entityType: 'lead',
      entityId: lead.id,
      details: { name: lead.name },
    },
  })

  return NextResponse.json(lead, { status: 201 })
}
