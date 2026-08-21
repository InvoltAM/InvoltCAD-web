import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

// GET /api/crm/email-templates — список шаблонов текущего пользователя
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const templates = await prisma.crmEmailTemplate.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(templates)
}

// POST /api/crm/email-templates — создать шаблон
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const name = body.name?.trim()
  const subject = body.subject?.trim()
  const html = body.html?.trim()

  if (!name || !subject || !html) {
    return NextResponse.json({ error: 'Название, тема и текст шаблона обязательны' }, { status: 400 })
  }

  const template = await prisma.crmEmailTemplate.create({
    data: { userId: user.id, name, subject, body: html },
  })

  return NextResponse.json(template, { status: 201 })
}
