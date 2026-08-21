import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

async function assertDealAccess(id: string, userId: string) {
  const deal = await prisma.crmDeal.findUnique({ where: { id } })
  if (!deal || deal.userId !== userId) return null
  return deal
}

interface RouteParams {
  params: Promise<{ id: string; documentId: string }>
}

async function checkDocumentAccess(dealId: string, documentId: string, userId: string) {
  const deal = await assertDealAccess(dealId, userId)
  if (!deal) throw new Error('Сделка не найдена')
  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc || doc.crmDealId !== dealId) throw new Error('Документ не найден')
  return doc
}

// PUT /api/crm/deals/[id]/documents/[documentId] — обновить документ
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, documentId } = await params
  try {
    await checkDocumentAccess(id, documentId, user.id)
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name.trim()
    if (body.type !== undefined) data.type = body.type
    if (body.status !== undefined) data.status = body.status

    const updated = await prisma.document.update({
      where: { id: documentId },
      data,
    })

    await prisma.crmActivityLog.create({
      data: {
        userId: user.id,
        action: 'update_document_from_deal',
        entityType: 'deal',
        entityId: id,
        details: { documentId, name: updated.name, status: updated.status },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// DELETE /api/crm/deals/[id]/documents/[documentId] — удалить документ
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, documentId } = await params
  try {
    await checkDocumentAccess(id, documentId, user.id)
    await prisma.document.delete({ where: { id: documentId } })

    await prisma.crmActivityLog.create({
      data: {
        userId: user.id,
        action: 'delete_document_from_deal',
        entityType: 'deal',
        entityId: id,
        details: { documentId },
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
