import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EstimateData, EstimateItemData } from '@core/estimates/EstimateEngine'

interface RouteParams {
  params: Promise<{ slug: string }>
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
  }
}

// GET /api/public/estimates/[slug] — публичное КП по ссылке
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { slug } = await params

  const estimate = await prisma.estimate.findUnique({
    where: { publicSlug: slug },
    include: { project: { select: { name: true } }, items: true },
  })

  if (!estimate) {
    return NextResponse.json({ error: 'Предложение не найдено или ссылка недействительна' }, { status: 404 })
  }

  if (estimate.publicExpiresAt && new Date(estimate.publicExpiresAt) < new Date()) {
    return NextResponse.json({ error: 'Ссылка истекла' }, { status: 410 })
  }

  return NextResponse.json({
    estimate: estimateToDto(estimate),
    projectName: estimate.project.name,
  })
}
