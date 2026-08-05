import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { builtinTemplates, ProjectTemplateData } from '@core/templates/TemplateEngine'

function dto(template: any): ProjectTemplateData {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    templateType: template.templateType,
    isBuiltin: template.isBuiltin,
    thumbnail: template.thumbnail,
    data: template.data as ProjectTemplateData['data'],
    price: template.price,
    currency: template.currency,
    published: template.published,
    createdAt: template.createdAt?.toISOString(),
    updatedAt: template.updatedAt?.toISOString(),
  }
}

// GET /api/templates — список шаблонов (встроенные + пользовательские)
export async function GET(_request: NextRequest) {
  const user = await getSessionUser()
  const userTemplates = user
    ? await prisma.projectTemplate.findMany({
        where: { userId: user.id, isBuiltin: false },
        orderBy: { updatedAt: 'desc' },
      })
    : []

  const items = [
    ...builtinTemplates().map((t) => ({ ...t, isBuiltin: true })),
    ...userTemplates.map(dto),
  ]

  return NextResponse.json(items)
}

// POST /api/templates — сохранить текущий план как шаблон
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const body = await request.json()
  if (!body.name || !body.data || !body.data.plan) {
    return NextResponse.json({ error: 'Нужны name и data.plan' }, { status: 400 })
  }

  const template = await prisma.projectTemplate.create({
    data: {
      userId: user.id,
      name: body.name,
      description: body.description,
      category: body.category || 'other',
      templateType: body.templateType || 'project',
      data: body.data as any,
      thumbnail: body.thumbnail,
      published: false,
    },
  })

  return NextResponse.json(dto(template), { status: 201 })
}
