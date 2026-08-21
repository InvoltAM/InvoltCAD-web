import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { sendEmail, isEmailConfigured } from '@/lib/email'

// GET /api/crm/emails — история email по сделке/клиенту/лиду
export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dealId = searchParams.get('dealId')
  const clientId = searchParams.get('clientId')
  const leadId = searchParams.get('leadId')

  const where: Record<string, unknown> = {}
  if (dealId) where.dealId = dealId
  if (clientId) where.clientId = clientId
  if (leadId) where.leadId = leadId

  const logs = await prisma.crmEmailLog.findMany({
    where,
    orderBy: { sentAt: 'desc' },
    take: 100,
  })

  return NextResponse.json(logs)
}

// POST /api/crm/emails/send — отправить email
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const to = body.to?.trim()
  const subject = body.subject?.trim()
  const html = body.html?.trim()
  const text = body.text?.trim()
  const dealId = body.dealId ?? null
  const clientId = body.clientId ?? null
  const leadId = body.leadId ?? null

  if (!to || !subject || (!html && !text)) {
    return NextResponse.json({ error: 'Получатель, тема и текст/html обязательны' }, { status: 400 })
  }

  if (dealId) {
    const deal = await prisma.crmDeal.findUnique({ where: { id: dealId } })
    if (!deal || deal.userId !== user.id) {
      return NextResponse.json({ error: 'Сделка не найдена' }, { status: 404 })
    }
  }

  if (clientId) {
    const client = await prisma.crmClient.findUnique({ where: { id: clientId } })
    if (!client || client.userId !== user.id) {
      return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
    }
  }

  if (leadId) {
    const lead = await prisma.crmLead.findUnique({ where: { id: leadId } })
    if (!lead || lead.userId !== user.id) {
      return NextResponse.json({ error: 'Лид не найден' }, { status: 404 })
    }
  }

  let status: 'sent' | 'failed' = 'sent'
  let errorMessage: string | null = null

  if (isEmailConfigured()) {
    try {
      await sendEmail({ to, subject, html, text })
    } catch (err) {
      status = 'failed'
      errorMessage = err instanceof Error ? err.message : 'Ошибка отправки email'
    }
  } else {
    status = 'failed'
    errorMessage = 'SMTP не настроен. Письмо сохранено в черновиках, но не отправлено.'
  }

  const log = await prisma.crmEmailLog.create({
    data: {
      userId: user.id,
      dealId,
      clientId,
      leadId,
      to,
      subject,
      body: html ?? text ?? '',
      status,
      errorMessage,
    },
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'email_send',
      entityType: dealId ? 'deal' : clientId ? 'client' : 'lead',
      entityId: dealId ?? clientId ?? leadId ?? to,
      details: { to, subject, sent: status === 'sent', error: errorMessage },
    },
  })

  const note = status === 'sent'
    ? 'Письмо отправлено.'
    : `Письмо не отправлено: ${errorMessage}`

  return NextResponse.json({ success: status === 'sent', note, log })
}
