import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

// GET /api/crm/telegram — логи сообщений Telegram
export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('leadId')
  const clientId = searchParams.get('clientId')

  if (leadId) {
    const lead = await prisma.crmLead.findUnique({ where: { id: leadId } })
    if (!lead || lead.userId !== user.id) {
      return NextResponse.json({ error: 'Лид не найден' }, { status: 404 })
    }
  }

  let chatIdFilter: string | null = null
  if (clientId) {
    const client = await prisma.crmClient.findUnique({ where: { id: clientId } })
    if (!client || client.userId !== user.id) {
      return NextResponse.json({ error: 'Клиент не найден' }, { status: 404 })
    }
    chatIdFilter = client.telegramChatId
  }

  const where: Record<string, unknown> = {}
  if (leadId) where.leadId = leadId
  if (clientId) {
    where.chatId = chatIdFilter ?? '__no_chat_id__'
  }

  const logs = await prisma.crmTelegramLog.findMany({
    where,
    orderBy: { sentAt: 'desc' },
    take: 100,
  })

  return NextResponse.json(logs)
}

// POST /api/crm/telegram — сохранить полученное/отправленное сообщение
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const chatId = body.chatId?.trim()
  const message = body.message?.trim()
  if (!chatId || !message) {
    return NextResponse.json({ error: 'chatId и message обязательны' }, { status: 400 })
  }

  // Если указан leadId, проверяем доступ
  if (body.leadId) {
    const lead = await prisma.crmLead.findUnique({ where: { id: body.leadId } })
    if (!lead || lead.userId !== user.id) {
      return NextResponse.json({ error: 'Лид не найден' }, { status: 404 })
    }
  }

  const log = await prisma.crmTelegramLog.create({
    data: {
      leadId: body.leadId ?? null,
      chatId,
      message,
      status: body.status ?? 'sent',
      errorMessage: body.errorMessage?.trim() ?? null,
    },
  })

  await prisma.crmActivityLog.create({
    data: {
      userId: user.id,
      action: 'telegram_message',
      entityType: body.leadId ? 'lead' : 'client',
      entityId: body.leadId ?? chatId,
      details: { chatId, messagePreview: message.slice(0, 100) },
    },
  })

  return NextResponse.json(log, { status: 201 })
}
