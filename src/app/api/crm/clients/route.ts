import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

// GET /api/crm/clients — список клиентов
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const clients = await prisma.crmClient.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(clients)
}

// POST /api/crm/clients — создание клиента
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'Имя клиента обязательно' }, { status: 400 })
  }

  const client = await prisma.crmClient.create({
    data: {
      userId: user.id,
      name,
      company: body.company?.trim() ?? null,
      email: body.email?.trim() ?? null,
      phone: body.phone?.trim() ?? null,
      address: body.address?.trim() ?? null,
      status: body.status ?? 'active',
      source: body.source?.trim() ?? null,
      notes: body.notes?.trim() ?? null,
    },
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'create_client',
      entityType: 'client',
      entityId: client.id,
      details: { name: client.name },
    },
  })

  return NextResponse.json(client, { status: 201 })
}
