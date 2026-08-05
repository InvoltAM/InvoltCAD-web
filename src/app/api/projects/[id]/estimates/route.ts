import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertProjectAccess } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { EstimateData, EstimateItemData } from '@core/estimates/EstimateEngine'

interface RouteParams {
  params: Promise<{ id: string }>
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
    publicSlug: estimate.publicSlug ?? undefined,
    publicExpiresAt: estimate.publicExpiresAt?.toISOString(),
  }
}

// GET /api/projects/[id]/estimates — список смет проекта
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
  try {
    await assertProjectAccess(id, user.id, 'viewer')
    const estimates = await prisma.estimate.findMany({
      where: { projectId: id },
      include: { items: true },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(estimates.map(estimateToDto))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// POST /api/projects/[id]/estimates — создать смету
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
  try {
    await assertProjectAccess(id, user.id, 'editor')
    const body: EstimateData = await request.json()
    const items = body.items ?? []

    const created = await prisma.estimate.create({
      data: {
        projectId: id,
        name: body.name || 'Смета',
        priceLevel: body.priceLevel ?? 'standard',
        discountPercent: body.discountPercent ?? 0,
        vatPercent: body.vatPercent ?? 0,
        totalMaterial: body.totalMaterial ?? 0,
        totalWork: body.totalWork ?? 0,
        total: body.total ?? 0,
        status: body.status ?? 'draft',
        properties: {},
      },
    })

    for (const item of items) {
      await prisma.estimateItem.create({
        data: {
          estimateId: created.id,
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

    const full = await prisma.estimate.findUnique({ where: { id: created.id }, include: { items: true } })
    return NextResponse.json(estimateToDto(full), { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
