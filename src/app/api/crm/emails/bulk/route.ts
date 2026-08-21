import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { sendEmail, isEmailConfigured } from '@/lib/email'

interface BulkRecipient {
  to: string
  clientId?: string | null
  leadId?: string | null
  dealId?: string | null
}

// POST /api/crm/emails/bulk — массовая рассылка email
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const recipients: BulkRecipient[] = body.recipients ?? []
  const subject = body.subject?.trim()
  const html = body.html?.trim()
  const text = body.text?.trim()

  if (!subject || (!html && !text) || recipients.length === 0) {
    return NextResponse.json({ error: 'Получатели, тема и текст/html обязательны' }, { status: 400 })
  }

  let sentCount = 0
  let failedCount = 0
  const errors: string[] = []

  const emailConfigured = isEmailConfigured()

  for (const recipient of recipients) {
    const to = recipient.to?.trim()
    if (!to) continue

    let status: 'sent' | 'failed' = 'sent'
    let errorMessage: string | null = null

    if (emailConfigured) {
      try {
        await sendEmail({ to, subject, html, text })
      } catch (err) {
        status = 'failed'
        errorMessage = err instanceof Error ? err.message : 'Ошибка отправки email'
      }
    } else {
      status = 'failed'
      errorMessage = 'SMTP не настроен'
    }

    await prisma.crmEmailLog.create({
      data: {
        userId: user.id,
        dealId: recipient.dealId ?? null,
        clientId: recipient.clientId ?? null,
        leadId: recipient.leadId ?? null,
        to,
        subject,
        body: html ?? text ?? '',
        status,
        errorMessage,
      },
    })

    if (status === 'sent') sentCount++
    else {
      failedCount++
      if (errorMessage) errors.push(`${to}: ${errorMessage}`)
    }
  }

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'email_bulk_send',
      entityType: 'client',
      entityId: 'bulk',
      details: { subject, sentCount, failedCount, recipientsCount: recipients.length },
    },
  })

  return NextResponse.json({
    success: failedCount === 0,
    sentCount,
    failedCount,
    errors,
    note: emailConfigured
      ? `Отправлено ${sentCount}, ошибок ${failedCount}.`
      : 'SMTP не настроен. Письма сохранены в логах, но не отправлены.',
  })
}
