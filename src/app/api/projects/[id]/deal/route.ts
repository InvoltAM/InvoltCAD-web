import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertProjectAccess } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/projects/[id]/deal — создать сделку на основе проекта
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params

  try {
    await assertProjectAccess(id, user.id, 'editor')

    const project = await prisma.project.findUnique({
      where: { id },
      include: { crmClient: { select: { id: true, name: true } } },
    })
    if (!project) {
      return NextResponse.json({ error: 'Проект не найден' }, { status: 404 })
    }

    if (project.crmDealId) {
      return NextResponse.json({ error: 'К проекту уже привязана сделка' }, { status: 400 })
    }

    const title = project.crmClient
      ? `Сделка по проекту «${project.name}» — ${project.crmClient.name}`
      : `Сделка по проекту «${project.name}»`

    const deal = await prisma.crmDeal.create({
      data: {
        userId: user.id,
        clientId: project.crmClientId,
        title,
        stage: 'new',
        currency: 'RUB',
      },
    })

    await prisma.project.update({
      where: { id },
      data: { crmDealId: deal.id },
    })

    await prisma.crmActivityLog.create({
      data: {
        userId: user.id,
        action: 'create_deal_from_project',
        entityType: 'deal',
        entityId: deal.id,
        details: { projectId: id, projectName: project.name, clientId: project.crmClientId },
      },
    })

    return NextResponse.json(deal, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка создания сделки'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
