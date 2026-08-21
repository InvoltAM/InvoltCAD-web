import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { sendEmail, isEmailConfigured } from '@/lib/email'

async function assertDealAccess(id: string, userId: string) {
  const deal = await prisma.crmDeal.findUnique({
    where: { id },
    include: { client: { select: { email: true } } },
  })
  if (!deal) return null
  if (deal.userId !== userId) return null
  return deal
}

interface RouteParams {
  params: Promise<{ id: string; invoiceId: string }>
}

// POST /api/crm/deals/[id]/invoices/[invoiceId]/email — отправить счёт по email
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id, invoiceId } = await params
  const deal = await assertDealAccess(id, user.id)
  if (!deal) {
    return NextResponse.json({ error: 'Сделка не найдена' }, { status: 404 })
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, crmDealId: id },
  })
  if (!invoice) {
    return NextResponse.json({ error: 'Счёт не найден' }, { status: 404 })
  }

  const body = await request.json()
  const to = body.to?.trim() || deal.client?.email
  const subject = body.subject?.trim() || `Счёт ${invoice.number}`

  if (!to) {
    return NextResponse.json({ error: 'Получатель не указан' }, { status: 400 })
  }

  const amountStr = (invoice.amount / 100).toFixed(2)
  const html = body.html?.trim() || `<p>Здравствуйте!</p><p>Выставлен счёт ${invoice.number} на сумму ${amountStr} ${invoice.currency}.</p><p>Оплату можно произвести через карточку сделки.</p>`

  let status: 'sent' | 'failed' = 'sent'
  let errorMessage: string | null = null

  if (isEmailConfigured()) {
    try {
      await sendEmail({ to, subject, html })
    } catch (err) {
      status = 'failed'
      errorMessage = err instanceof Error ? err.message : 'Ошибка отправки email'
    }
  } else {
    status = 'failed'
    errorMessage = 'SMTP не настроен'
  }

  const log = await prisma.crmEmailLog.create({
    data: {
      userId: user.id,
      dealId: id,
      clientId: deal.clientId,
      to,
      subject,
      body: html,
      status,
      errorMessage,
    },
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'email_send_invoice',
      entityType: 'deal',
      entityId: id,
      details: { invoiceId, to, sent: status === 'sent', error: errorMessage },
    },
  })

  return NextResponse.json({ success: status === 'sent', note: errorMessage, log })
}
