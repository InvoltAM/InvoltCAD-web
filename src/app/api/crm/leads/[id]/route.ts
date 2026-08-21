import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

async function assertLeadAccess(id: string, userId: string) {
  const lead = await prisma.crmLead.findUnique({
    where: { id },
  })
  if (!lead) return null
  if (lead.userId !== userId) return null
  return lead
}

// PATCH /api/crm/leads/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const lead = await assertLeadAccess(id, user.id)
  if (!lead) {
    return NextResponse.json({ error: 'Лид не найден' }, { status: 404 })
  }

  const body = await request.json()
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name.trim()
  if (body.email !== undefined) data.email = body.email?.trim() ?? null
  if (body.phone !== undefined) data.phone = body.phone?.trim() ?? null
  if (body.company !== undefined) data.company = body.company?.trim() ?? null
  if (body.status !== undefined) data.status = body.status
  if (body.source !== undefined) data.source = body.source?.trim() ?? null
  if (body.notes !== undefined) data.notes = body.notes?.trim() ?? null
  if (body.telegramChatId !== undefined) data.telegramChatId = body.telegramChatId?.trim() ?? null

  const updated = await prisma.crmLead.update({
    where: { id },
    data,
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'update_lead',
      entityType: 'lead',
      entityId: id,
      details: { name: updated.name },
    },
  })

  return NextResponse.json(updated)
}

// DELETE /api/crm/leads/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const lead = await assertLeadAccess(id, user.id)
  if (!lead) {
    return NextResponse.json({ error: 'Лид не найден' }, { status: 404 })
  }

  await prisma.crmLead.delete({ where: { id } })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'delete_lead',
      entityType: 'lead',
      entityId: id,
      details: { name: lead.name },
    },
  })

  return NextResponse.json({ success: true })
}
