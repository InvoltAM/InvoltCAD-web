import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

// GET /api/marketplace/seller/stats — статистика продавца
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  // Получаем все товары продавца
  const devices = await prisma.deviceCatalogItem.findMany({
    where: { sellerId: user.id },
    include: {
      purchases: {
        select: { pricePaid: true, sellerEarnings: true, createdAt: true },
      },
      reviews: {
        select: { rating: true },
      },
    },
  })

  const templates = await prisma.projectTemplate.findMany({
    where: { sellerId: user.id },
    include: {
      purchases: {
        select: { pricePaid: true, sellerEarnings: true, createdAt: true },
      },
      reviews: {
        select: { rating: true },
      },
    },
  })

  const allItems = [
    ...devices.map((d) => ({ ...d, itemType: 'device' as const })),
    ...templates.map((t) => ({ ...t, itemType: 'template' as const })),
  ]

  const totalSales = allItems.reduce((sum, item) => sum + item.salesCount, 0)
  const totalEarnings = allItems.reduce(
    (sum, item) => sum + item.purchases.reduce((s, p) => s + p.sellerEarnings, 0),
    0
  )
  const totalReviews = allItems.reduce((sum, item) => sum + item.reviews.length, 0)
  const avgRating =
    totalReviews > 0
      ? allItems.reduce(
          (sum, item) => sum + item.reviews.reduce((s, r) => s + r.rating, 0),
          0
        ) / totalReviews
      : null

  const recentSales = allItems
    .flatMap((item) =>
      item.purchases.map((p) => ({
        itemName: 'nameRu' in item ? item.nameRu : item.name,
        itemType: item.itemType,
        price: p.pricePaid,
        earnings: p.sellerEarnings,
        date: p.createdAt,
      }))
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20)

  return NextResponse.json({
    totalItems: allItems.length,
    totalSales,
    totalEarnings,
    totalReviews,
    avgRating,
    recentSales,
    items: allItems.map((item) => ({
      id: item.id,
      name: 'nameRu' in item ? item.nameRu : item.name,
      type: item.itemType,
      salesCount: item.salesCount,
      rating:
        item.reviews.length > 0
          ? item.reviews.reduce((sum, r) => sum + r.rating, 0) / item.reviews.length
          : null,
      published: item.published,
    })),
  })
}
