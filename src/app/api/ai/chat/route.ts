import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getSessionUser } from '@/lib/projects/access'
import { spendCredits } from '@/lib/billing/fulfillment'
import { prisma } from '@/lib/prisma'
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/ai/prompts'
import { parseAiResponse } from '@/lib/ai/toolSchema'

const AI_API_URL = process.env.AI_API_URL
const AI_API_KEY = process.env.AI_API_KEY
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini'
const AI_COST_CREDITS = parseInt(process.env.AI_COST_CREDITS || '1', 10)

export interface AiChatRequest {
  projectId?: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  planSnapshot?: unknown
}

// POST /api/ai/chat
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = (await request.json()) as AiChatRequest
  const { projectId, messages, planSnapshot } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Нет сообщений' }, { status: 400 })
  }

  if (!AI_API_URL || !AI_API_KEY) {
    return NextResponse.json(
      { error: 'AI-провайдер не настроен' },
      { status: 503 }
    )
  }

  const lastMessage = messages[messages.length - 1]
  const userPrompt = buildUserPrompt(lastMessage.content, planSnapshot)

  // Списываем кредиты
  const hasCredits = await spendCredits(
    user.id,
    AI_COST_CREDITS,
    'AI-ассистент'
  )
  if (!hasCredits) {
    return NextResponse.json(
      { error: 'Недостаточно кредитов' },
      { status: 402 }
    )
  }

  try {
    const llmMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userPrompt },
    ]

    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: llmMessages,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('AI provider error:', text)
      throw new Error('Ошибка AI-провайдера')
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content as string | undefined
    if (!rawContent) {
      throw new Error('Пустой ответ AI')
    }

    const parsed = parseAiResponse(rawContent)

    // Сохраняем сообщения в БД
    await prisma.$transaction([
      prisma.aiChatMessage.create({
        data: {
          userId: user.id,
          projectId: projectId ?? null,
          role: 'user',
          content: lastMessage.content,
          costCredits: AI_COST_CREDITS,
        },
      }),
      prisma.aiChatMessage.create({
        data: {
          userId: user.id,
          projectId: projectId ?? null,
          role: 'assistant',
          content: parsed.message,
          actions: (parsed.actions ?? []) as Prisma.InputJsonValue,
          costCredits: 0,
        },
      }),
    ])

    await prisma.aiUsageLog.create({
      data: {
        userId: user.id,
        type: 'chat',
        model: AI_MODEL,
        tokensIn: data.usage?.prompt_tokens ?? null,
        tokensOut: data.usage?.completion_tokens ?? null,
        costCredits: AI_COST_CREDITS,
      },
    })

    return NextResponse.json({
      message: parsed.message,
      actions: parsed.actions ?? [],
    })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json(
      { error: 'Не удалось получить ответ от AI' },
      { status: 500 }
    )
  }
}
