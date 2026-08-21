import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

interface TelegramApiResponse {
  ok: boolean
  result?: { message_id: number }
  description?: string
  error_code?: number
}

async function sendTelegramMessage(chatId: string, text: string): Promise<TelegramApiResponse> {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  })
  return (await res.json()) as TelegramApiResponse
}

// POST /api/crm/telegram/send — отправка сообщения клиенту/лиду.
// Если задан TELEGRAM_BOT_TOKEN, выполняется реальная отправка через Telegram Bot API,
// иначе сообщение только сохраняется в логе.
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const chatId = body.chatId?.trim()
  const message = body.message?.trim()
  const leadId = body.leadId ?? null
  const clientId = body.clientId ?? null

  if (!chatId || !message) {
    return NextResponse.json({ error: 'chatId и message обязательны' }, { status: 400 })
  }

  if (leadId) {
    const lead = await prisma.crmLead.findUnique({ where: { id: leadId } })
    if (!lead || lead.userId !== user.id) {
      return NextResponse.json({ error: 'Лид не найден' }, { status: 404 })
    }
  }

  if (clientId) {
    const client = await prisma.crmClient.findUnique({ where: { id: clientId } })
    if (!client || client.userId !== user.id) {
      return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
    }
  }

  let status: 'sent' | 'failed' = 'sent'
  let errorMessage: string | null = null

  if (TELEGRAM_BOT_TOKEN) {
    try {
      const result = await sendTelegramMessage(chatId, message)
      if (!result.ok) {
        status = 'failed'
        errorMessage = result.description ?? `Telegram error ${result.error_code ?? ''}`
      }
    } catch (err) {
      status = 'failed'
      errorMessage = err instanceof Error ? err.message : 'Ошибка отправки в Telegram'
    }
  }

  const log = await prisma.crmTelegramLog.create({
    data: {
      leadId,
      chatId,
      message,
      status,
      errorMessage,
    },
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'telegram_send',
      entityType: leadId ? 'lead' : 'client',
      entityId: leadId ?? clientId ?? chatId,
      details: {
        chatId,
        messagePreview: message.slice(0, 100),
        sent: status === 'sent',
        error: errorMessage,
      },
    },
  })

  const note = TELEGRAM_BOT_TOKEN
    ? status === 'sent'
      ? 'Сообщение отправлено через Telegram Bot API.'
      : `Не удалось отправить сообщение: ${errorMessage}`
    : 'Сообщение сохранено в логе. Для реальной отправки настройте TELEGRAM_BOT_TOKEN.'

  return NextResponse.json({
    success: status === 'sent',
    note,
    log,
  })
}
