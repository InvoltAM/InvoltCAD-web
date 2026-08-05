import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertProjectAccess } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { InvoiceData } from '@core/estimates/EstimateEngine'

interface RouteParams {
  params: Promise<{ id: string; invoiceId: string }>
}

function invoiceToDto(invoice: any): InvoiceData {
  return {
    id: invoice.id,
    projectId: invoice.projectId,
    estimateId: invoice.estimateId ?? undefined,
    number: invoice.number,
    amount: invoice.amount,
    currency: invoice.currency,
    vatPercent: invoice.vatPercent,
    vatAmount: invoice.vatAmount,
    status: invoice.status,
    dueDate: invoice.dueDate?.toISOString(),
    paidAt: invoice.paidAt?.toISOString(),
    createdAt: invoice.createdAt?.toISOString(),
    updatedAt: invoice.updatedAt?.toISOString(),
  }
}

async function checkInvoiceAccess(projectId: string, invoiceId: string, userId: string) {
  await assertProjectAccess(projectId, userId, 'editor')
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice || invoice.projectId !== projectId) {
    throw new Error('Счёт не найден')
  }
  return invoice
}

// PUT /api/projects/[id]/invoices/[invoiceId] — обновить счёт
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, invoiceId } = await params
  try {
    await checkInvoiceAccess(id, invoiceId, user.id)
    const body: InvoiceData = await request.json()

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        number: body.number,
        amount: body.amount,
        currency: body.currency,
        vatPercent: body.vatPercent,
        vatAmount: body.vatAmount,
        status: body.status,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        paidAt: body.paidAt ? new Date(body.paidAt) : null,
      },
    })

    return NextResponse.json(invoiceToDto(invoice))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// DELETE /api/projects/[id]/invoices/[invoiceId] — удалить счёт
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id, invoiceId } = await params
  try {
    await checkInvoiceAccess(id, invoiceId, user.id)
    await prisma.invoice.delete({ where: { id: invoiceId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
