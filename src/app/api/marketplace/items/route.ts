import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

// GET /api/marketplace/items — каталог маркетплейса
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') // 'device' | 'template'
  const category = searchParams.get('category')
  const search = searchParams.get('search')

  const where: any = {
    published: true,
    isHiddenByAdmin: false,
  }

  if (category) {
    where.category = category
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { nameRu: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (type === 'device') {
    const devices = await prisma.deviceCatalogItem.findMany({
      where,
      include: {
        seller: {
          select: { id: true, name: true, image: true },
        },
        reviews: {
          select: { rating: true },
        },
      },
      orderBy: { salesCount: 'desc' },
      take: 50,
    })

    return NextResponse.json(
      devices.map((d) => ({
        id: d.id,
        type: 'device',
        name: d.nameRu || d.name,
        description: d.deviceType,
        category: d.category,
        price: d.price,
        currency: d.currency,
        salesCount: d.salesCount,
        rating: d.reviews.length > 0
          ? d.reviews.reduce((sum, r) => sum + r.rating, 0) / d.reviews.length
          : null,
        seller: d.seller,
        svg: d.svg,
      }))
    )
  }

  if (type === 'template') {
    const templates = await prisma.projectTemplate.findMany({
      where,
      include: {
        seller: {
          select: { id: true, name: true, image: true },
        },
        reviews: {
          select: { rating: true },
        },
      },
      orderBy: { salesCount: 'desc' },
      take: 50,
    })

    return NextResponse.json(
      templates.map((t) => ({
        id: t.id,
        type: 'template',
        name: t.name,
        description: t.description,
        category: t.category,
        price: t.price,
        currency: t.currency,
        salesCount: t.salesCount,
        rating: t.reviews.length > 0
          ? t.reviews.reduce((sum, r) => sum + r.rating, 0) / t.reviews.length
          : null,
        seller: t.seller,
        thumbnail: t.thumbnail,
      }))
    )
  }

  // Если тип не указан, возвращаем и устройства, и шаблоны
  const [devices, templates] = await Promise.all([
    prisma.deviceCatalogItem.findMany({
      where,
      include: {
        seller: { select: { id: true, name: true, image: true } },
        reviews: { select: { rating: true } },
      },
      orderBy: { salesCount: 'desc' },
      take: 25,
    }),
    prisma.projectTemplate.findMany({
      where,
      include: {
        seller: { select: { id: true, name: true, image: true } },
        reviews: { select: { rating: true } },
      },
      orderBy: { salesCount: 'desc' },
      take: 25,
    }),
  ])

  const items = [
    ...devices.map((d) => ({
      id: d.id,
      type: 'device' as const,
      name: d.nameRu || d.name,
      description: d.deviceType,
      category: d.category,
      price: d.price,
      currency: d.currency,
      salesCount: d.salesCount,
      rating: d.reviews.length > 0
        ? d.reviews.reduce((sum, r) => sum + r.rating, 0) / d.reviews.length
        : null,
      seller: d.seller,
      svg: d.svg,
    })),
    ...templates.map((t) => ({
      id: t.id,
      type: 'template' as const,
      name: t.name,
      description: t.description,
      category: t.category,
      price: t.price,
      currency: t.currency,
      salesCount: t.salesCount,
      rating: t.reviews.length > 0
        ? t.reviews.reduce((sum, r) => sum + r.rating, 0) / t.reviews.length
        : null,
      seller: t.seller,
      thumbnail: t.thumbnail,
    })),
  ]

  // Сортируем по salesCount
  items.sort((a, b) => (b.salesCount ?? 0) - (a.salesCount ?? 0))

  return NextResponse.json(items.slice(0, 50))
}
