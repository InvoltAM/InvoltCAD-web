import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

// POST /api/crm/telegram/send — отправка сообщения (сохраняет в лог)
// Реальная отправка через Telegram Bot API будет добавлена позже при наличии TELEGRAM_BOT_TOKEN.
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const chatId = body.chatId?.trim()
  const message = body.message?.trim()
  const leadId = body.leadId ?? null

  if (!chatId || !message) {
    return NextResponse.json({ error: 'chatId и message обязательны' }, { status: 400 })
  }

  if (leadId) {
    const lead = await prisma.crmLead.findUnique({ where: { id: leadId } })
    if (!lead || lead.userId !== user.id) {
      return NextResponse.json({ error: 'Лид не найден' }, { status: 404 })
    }
  }

  // Здесь позже будет реальная отправка через Telegram Bot API.
  // Сейчас сохраняем в лог как отправленное.
  const log = await prisma.crmTelegramLog.create({
    data: {
      leadId,
      chatId,
      message,
      status: 'sent',
    },
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'telegram_send',
      entityType: leadId ? 'lead' : 'client',
      entityId: leadId ?? chatId,
      details: { chatId, messagePreview: message.slice(0, 100) },
    },
  })

  return NextResponse.json({
    success: true,
    note: 'Сообщение сохранено в логе. Реальная отправка через Telegram Bot API будет настроена позже.',
    log,
  })
}
