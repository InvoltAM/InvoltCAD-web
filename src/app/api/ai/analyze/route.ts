import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { spendCredits } from '@/lib/billing/fulfillment'
import { prisma } from '@/lib/prisma'
import { SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { parseAiResponse } from '@/lib/ai/toolSchema'
import type { ValidationIssue } from '@core/rules/ValidationTypes'

const AI_API_URL = process.env.AI_API_URL
const AI_API_KEY = process.env.AI_API_KEY
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini'
const AI_ANALYZE_COST = parseInt(process.env.AI_ANALYZE_COST || '2', 10)

export interface AiAnalyzeRequest {
  projectId?: string
  planSnapshot: unknown
  type: 'devices' | 'norms' | 'loads'
}

export interface AiAnalyzeResponse {
  issues: ValidationIssue[]
  summary: string
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = (await request.json()) as AiAnalyzeRequest
  const { projectId, planSnapshot, type } = body

  if (!planSnapshot || !type) {
    return NextResponse.json({ error: 'Нет данных для анализа' }, { status: 400 })
  }

  if (!AI_API_URL || !AI_API_KEY) {
    return NextResponse.json(
      { error: 'AI-провайдер не настроен' },
      { status: 503 }
    )
  }

  const hasCredits = await spendCredits(
    user.id,
    AI_ANALYZE_COST,
    `AI-анализ плана (${type})`
  )
  if (!hasCredits) {
    return NextResponse.json(
      { error: 'Недостаточно кредитов' },
      { status: 402 }
    )
  }

  const prompt = buildAnalyzePrompt(type, planSnapshot)

  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
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
    const issues = extractIssues(parsed.message)

    await prisma.aiUsageLog.create({
      data: {
        userId: user.id,
        type: 'analyze',
        model: AI_MODEL,
        tokensIn: data.usage?.prompt_tokens ?? null,
        tokensOut: data.usage?.completion_tokens ?? null,
        costCredits: AI_ANALYZE_COST,
      },
    })

    return NextResponse.json({
      issues,
      summary: parsed.message,
    } as AiAnalyzeResponse)
  } catch (error) {
    console.error('AI analyze error:', error)
    return NextResponse.json(
      { error: 'Не удалось выполнить анализ' },
      { status: 500 }
    )
  }
}

function buildAnalyzePrompt(type: string, snapshot: unknown): string {
  const snapshotText = JSON.stringify(snapshot, null, 2)

  const prompts: Record<string, string> = {
    devices: `Проанализируй план и укажи, каких устройств не хватает. План:\n${snapshotText}\n\nВерни JSON с полем message — краткое описание, и полем actions (можно пустым).`,
    norms: `Проверь план на соответствие основным нормам (ПУЭ, СП 256). План:\n${snapshotText}\n\nВерни JSON с полем message. Для каждого нарушения опиши его текстом в message.`,
    loads: `Рассчитай примерную электрическую нагрузку по плану. План:\n${snapshotText}\n\nВерни JSON с полем message — краткий расчёт нагрузки.`,
  }

  return prompts[type] || prompts.devices
}

function extractIssues(text: string): ValidationIssue[] {
  // Простая эвристика: каждая строка, начинающаяся с "-", считается замечанием.
  const lines = text.split('\n')
  const issues: ValidationIssue[] = []
  let index = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
      issues.push({
        id: `ai-issue-${index++}`,
        type: 'plan',
        severity: 'warning',
        message: trimmed.replace(/^[-•]\s*/, ''),
      })
    }
  }

  return issues
}
