import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertProjectAccess } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { EstimateData, EstimateItemData } from '@core/estimates/EstimateEngine'

interface RouteParams {
  params: Promise<{ id: string; estimateId: string }>
}

function estimateToDto(estimate: any): EstimateData {
  return {
    id: estimate.id,
    projectId: estimate.projectId,
    name: estimate.name,
    priceLevel: estimate.priceLevel,
    discountPercent: estimate.discountPercent,
    vatPercent: estimate.vatPercent,
    totalMaterial: estimate.totalMaterial,
    totalWork: estimate.totalWork,
    total: estimate.total,
    status: estimate.status,
    items: (estimate.items ?? []).map((item: any): EstimateItemData => ({
      id: item.id,
      itemType: item.itemType as 'material' | 'work',
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
      sortOrder: item.sortOrder,
      priceItemId: item.priceItemId ?? undefined,
    })),
    createdAt: estimate.createdAt?.toISOString(),
    updatedAt: estimate.updatedAt?.toISOString(),
  }
}

async function checkEstimateAccess(projectId: string, estimateId: string, userId: string) {
  await assertProjectAccess(projectId, userId, 'editor')
  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: { items: true },
  })
  if (!estimate || estimate.projectId !== projectId) {
    throw new Error('Смета не найдена')
  }
  return estimate
}

// PUT /api/projects/[id]/estimates/[estimateId] — обновить смету
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, estimateId } = await params
  try {
    await checkEstimateAccess(id, estimateId, user.id)
    const body: EstimateData = await request.json()

    await prisma.estimate.update({
      where: { id: estimateId },
      data: {
        name: body.name,
        priceLevel: body.priceLevel,
        discountPercent: body.discountPercent,
        vatPercent: body.vatPercent,
        totalMaterial: body.totalMaterial,
        totalWork: body.totalWork,
        total: body.total,
        status: body.status,
      },
    })

    await prisma.estimateItem.deleteMany({ where: { estimateId } })
    for (const item of body.items ?? []) {
      await prisma.estimateItem.create({
        data: {
          estimateId,
          itemType: item.itemType,
          priceItemId: item.priceItemId || null,
          name: item.name,
          unit: item.unit,
          quantity: item.quantity ?? 0,
          price: item.price ?? 0,
          total: item.total ?? 0,
          sortOrder: item.sortOrder ?? 0,
        },
      })
    }

    const full = await prisma.estimate.findUnique({ where: { id: estimateId }, include: { items: true } })
    return NextResponse.json(estimateToDto(full))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// DELETE /api/projects/[id]/estimates/[estimateId] — удалить смету
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, estimateId } = await params
  try {
    await checkEstimateAccess(id, estimateId, user.id)
    await prisma.estimate.delete({ where: { id: estimateId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
