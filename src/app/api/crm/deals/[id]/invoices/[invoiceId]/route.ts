import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'

async function assertDealAccess(id: string, userId: string) {
  const deal = await prisma.crmDeal.findUnique({ where: { id } })
  if (!deal || deal.userId !== userId) return null
  return deal
}

interface RouteParams {
  params: Promise<{ id: string; invoiceId: string }>
}

async function checkInvoiceAccess(dealId: string, invoiceId: string, userId: string) {
  const deal = await assertDealAccess(dealId, userId)
  if (!deal) throw new Error('Сделка не найдена')
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice || invoice.crmDealId !== dealId) throw new Error('Счёт не найден')
  return invoice
}

// PUT /api/crm/deals/[id]/invoices/[invoiceId] — обновить счёт
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, invoiceId } = await params
  try {
    await checkInvoiceAccess(id, invoiceId, user.id)
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (body.number !== undefined) data.number = body.number.trim()
    if (body.amount !== undefined) {
      const amount = Number(body.amount)
      data.amount = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0
    }
    if (body.status !== undefined) data.status = body.status

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data,
    })

    await prisma.crmActivityLog.create({
      data: {
        userId: user.id,
        action: 'update_invoice_from_deal',
        entityType: 'deal',
        entityId: id,
        details: { invoiceId, number: updated.number, status: updated.status },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// DELETE /api/crm/deals/[id]/invoices/[invoiceId] — удалить счёт
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, invoiceId } = await params
  try {
    await checkInvoiceAccess(id, invoiceId, user.id)
    await prisma.invoice.delete({ where: { id: invoiceId } })

    await prisma.crmActivityLog.create({
      data: {
        userId: user.id,
        action: 'delete_invoice_from_deal',
        entityType: 'deal',
        entityId: id,
        details: { invoiceId },
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
