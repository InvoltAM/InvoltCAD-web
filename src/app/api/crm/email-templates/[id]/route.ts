import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

async function assertTemplateAccess(id: string, userId: string) {
  const template = await prisma.crmEmailTemplate.findUnique({ where: { id } })
  if (!template || template.userId !== userId) return null
  return template
}

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH /api/crm/email-templates/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const template = await assertTemplateAccess(id, user.id)
  if (!template) {
    return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
  }

  const body = await request.json()
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name?.trim()
  if (body.subject !== undefined) data.subject = body.subject?.trim()
  if (body.html !== undefined) data.body = body.html?.trim()

  const updated = await prisma.crmEmailTemplate.update({
    where: { id },
    data,
  })

  return NextResponse.json(updated)
}

// DELETE /api/crm/email-templates/[id]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const template = await assertTemplateAccess(id, user.id)
  if (!template) {
    return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
  }

  await prisma.crmEmailTemplate.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
