import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { sendEmail, isEmailConfigured } from '@/lib/email'
import { randomUUID } from 'crypto'

async function assertDealAccess(id: string, userId: string) {
  const deal = await prisma.crmDeal.findUnique({
    where: { id },
    include: { client: { select: { email: true } }, projects: { take: 1, select: { id: true } } },
  })
  if (!deal) return null
  if (deal.userId !== userId) return null
  return deal
}

interface RouteParams {
  params: Promise<{ id: string; estimateId: string }>
}

// POST /api/crm/deals/[id]/estimates/[estimateId]/email — отправить КП по email
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id, estimateId } = await params
  const deal = await assertDealAccess(id, user.id)
  if (!deal) {
    return NextResponse.json({ error: 'Сделка не найдена' }, { status: 404 })
  }

  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, crmDealId: id },
  })
  if (!estimate) {
    return NextResponse.json({ error: 'КП не найдено' }, { status: 404 })
  }

  const body = await request.json()
  const to = body.to?.trim() || deal.client?.email
  const subject = body.subject?.trim() || `Коммерческое предложение «${estimate.name}»`

  if (!to) {
    return NextResponse.json({ error: 'Получатель не указан' }, { status: 400 })
  }

  let publicSlug = estimate.publicSlug
  if (!publicSlug) {
    publicSlug = randomUUID()
    await prisma.estimate.update({
      where: { id: estimateId },
      data: {
        publicSlug,
        publicExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'sent',
      },
    })
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/public/estimates/${publicSlug}`
  const html = body.html?.trim() || `<p>Здравствуйте!</p><p>Коммерческое предложение доступно по ссылке: <a href="${publicUrl}">${publicUrl}</a></p>`

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
      action: 'email_send_estimate',
      entityType: 'deal',
      entityId: id,
      details: { estimateId, to, sent: status === 'sent', error: errorMessage },
    },
  })

  return NextResponse.json({ success: status === 'sent', note: errorMessage, log, publicUrl })
}
