import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { ProjectTemplateData } from '@core/templates/TemplateEngine'

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

interface RouteParams {
  params: Promise<{ id: string }>
}

async function checkOwnTemplate(id: string, userId: string) {
  const template = await prisma.projectTemplate.findUnique({ where: { id } })
  if (!template || template.userId !== userId || template.isBuiltin) {
    throw new Error('Шаблон не найден')
  }
  return template
}

// PUT /api/templates/[id] — обновить шаблон
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
  try {
    await checkOwnTemplate(id, user.id)
    const body = await request.json()

    const template = await prisma.projectTemplate.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        category: body.category,
        templateType: body.templateType,
        data: body.data ? (body.data as any) : undefined,
        thumbnail: body.thumbnail,
      },
    })

    return NextResponse.json(dto(template))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// DELETE /api/templates/[id] — удалить шаблон
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
  try {
    await checkOwnTemplate(id, user.id)
    await prisma.projectTemplate.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
