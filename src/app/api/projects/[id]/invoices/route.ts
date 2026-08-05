import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertProjectAccess } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { InvoiceData } from '@core/estimates/EstimateEngine'

interface RouteParams {
  params: Promise<{ id: string }>
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

// GET /api/projects/[id]/invoices — список счетов проекта
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
  try {
    await assertProjectAccess(id, user.id, 'viewer')
    const invoices = await prisma.invoice.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(invoices.map(invoiceToDto))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}

// POST /api/projects/[id]/invoices — создать счёт
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

  const { id } = await params
  try {
    await assertProjectAccess(id, user.id, 'editor')
    const body: InvoiceData = await request.json()

    const invoice = await prisma.invoice.create({
      data: {
        projectId: id,
        estimateId: body.estimateId || null,
        number: body.number || 'СЧ-001',
        amount: body.amount ?? 0,
        currency: body.currency ?? 'RUB',
        vatPercent: body.vatPercent ?? 0,
        vatAmount: body.vatAmount ?? 0,
        status: body.status ?? 'draft',
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        paidAt: body.paidAt ? new Date(body.paidAt) : null,
        properties: {},
      },
    })

    return NextResponse.json(invoiceToDto(invoice), { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 403 })
  }
}
