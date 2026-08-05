import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

// PUT /api/catalog/items/[id] — обновить пользовательскую позицию материала
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const existing = await prisma.priceItem.findUnique({ where: { id } })
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'Позиция не найдена' }, { status: 404 })
  }

  const body = await request.json()
  const item = await prisma.priceItem.update({
    where: { id },
    data: {
      category: String(body.category || existing.category).trim(),
      name: String(body.name || existing.name).trim(),
      unit: String(body.unit || existing.unit).trim(),
      priceBudget: Math.round(Number(body.priceBudget ?? existing.priceBudget / 100) * 100),
      priceStandard: Math.round(Number(body.priceStandard ?? existing.priceStandard / 100) * 100),
      pricePremium: Math.round(Number(body.pricePremium ?? existing.pricePremium / 100) * 100),
      currency: String(body.currency || existing.currency).trim(),
      vendor: body.vendor !== undefined ? (body.vendor ? String(body.vendor).trim() : null) : existing.vendor,
      sku: body.sku !== undefined ? (body.sku ? String(body.sku).trim() : null) : existing.sku,
      article: body.article !== undefined ? (body.article ? String(body.article).trim() : null) : existing.article,
      description: body.description !== undefined ? (body.description ? String(body.description).trim() : null) : existing.description,
      sortOrder: Number(body.sortOrder ?? existing.sortOrder),
    },
  })

  return NextResponse.json(item)
}

// DELETE /api/catalog/items/[id] — удалить пользовательскую позицию материала
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const existing = await prisma.priceItem.findUnique({ where: { id } })
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'Позиция не найдена' }, { status: 404 })
  }

  await prisma.priceItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
