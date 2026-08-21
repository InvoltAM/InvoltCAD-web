import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

async function assertClientAccess(id: string, userId: string) {
  const client = await prisma.crmClient.findUnique({
    where: { id },
  })
  if (!client) return null
  if (client.userId !== userId) return null
  return client
}

// PATCH /api/crm/clients/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const client = await assertClientAccess(id, user.id)
  if (!client) {
    return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
  }

  const body = await request.json()
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name.trim()
  if (body.company !== undefined) data.company = body.company?.trim() ?? null
  if (body.email !== undefined) data.email = body.email?.trim() ?? null
  if (body.phone !== undefined) data.phone = body.phone?.trim() ?? null
  if (body.address !== undefined) data.address = body.address?.trim() ?? null
  if (body.status !== undefined) data.status = body.status
  if (body.source !== undefined) data.source = body.source?.trim() ?? null
  if (body.notes !== undefined) data.notes = body.notes?.trim() ?? null

  const updated = await prisma.crmClient.update({
    where: { id },
    data,
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'update_client',
      entityType: 'client',
      entityId: id,
      details: { name: updated.name },
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/crm/clients/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const client = await assertClientAccess(id, user.id)
  if (!client) {
    return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
  }

  await prisma.crmClient.delete({ where: { id } })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'delete_client',
      entityType: 'client',
      entityId: id,
      details: { name: client.name },
    },
  })

  return NextResponse.json({ success: true })
}
