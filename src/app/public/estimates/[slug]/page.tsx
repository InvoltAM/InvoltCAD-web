import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { EstimateData, EstimateItemData } from '@core/estimates/EstimateEngine'
import PublicEstimateView from './PublicEstimateView'

interface PageProps {
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

export default async function PublicEstimatePage({ params }: PageProps) {
  const { slug } = await params

  const estimate = await prisma.estimate.findUnique({
    where: { publicSlug: slug },
    include: { project: { select: { name: true } }, items: true },
  })

  if (!estimate) {
    notFound()
  }

  if (estimate.publicExpiresAt && new Date(estimate.publicExpiresAt) < new Date()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Ссылка истекла</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Срок действия коммерческого предложения закончился.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 dark:bg-gray-900">
      <PublicEstimateView
        estimate={estimateToDto(estimate)}
        projectName={estimate.project.name}
        slug={slug}
      />
    </main>
  )
}
