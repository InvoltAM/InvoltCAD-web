import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface TelegramUpdate {
  message?: {
    chat: { id: number; type?: string }
    text?: string
    date?: number
  }
}

// POST /api/crm/telegram/webhook — входящие обновления от Telegram Bot API.
// При получении текстового сообщения сохраняет его в CrmTelegramLog
// и пытается связать с клиентом/лидом по chatId.
export async function POST(request: NextRequest) {
  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const message = update.message
  if (!message || !message.chat || !message.text) {
    return NextResponse.json({ ok: true })
  }

  const chatId = String(message.chat.id)
  const text = message.text

  const client = await prisma.crmClient.findFirst({
    where: { telegramChatId: chatId },
  })
  const lead = client
    ? null
    : await prisma.crmLead.findFirst({
        where: { telegramChatId: chatId },
      })

  await prisma.crmTelegramLog.create({
    data: {
      leadId: lead?.id ?? null,
      chatId,
      message: text,
      status: 'sent',
    },
  })

  return NextResponse.json({ ok: true })
}
