import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { prisma } from '@/lib/prisma'
import { createPayment } from '@/lib/billing/yookassa'

async function assertDealAccess(id: string, userId: string) {
  const deal = await prisma.crmDeal.findUnique({ where: { id } })
  if (!deal) return null
  if (deal.userId !== userId) return null
  return deal
}

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/crm/deals/[id]/payments — список платежей по сделке
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const deal = await assertDealAccess(id, user.id)
  if (!deal) {
    return NextResponse.json({ error: 'Сделка не найдена' }, { status: 404 })
  }

  const payments = await prisma.payment.findMany({
    where: { crmDealId: id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(payments)
}

// POST /api/crm/deals/[id]/payments — создать платёж по сделке через YooKassa
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { id } = await params
  const deal = await assertDealAccess(id, user.id)
  if (!deal) {
    return NextResponse.json({ error: 'Сделка не найдена' }, { status: 404 })
  }

  const body = await request.json()
  const amountRub = Number(body.amountRub)
  const description = body.description?.trim() || `Оплата по сделке «${deal.title}»`

  if (!Number.isFinite(amountRub) || amountRub <= 0) {
    return NextResponse.json({ error: 'Сумма платежа должна быть больше нуля' }, { status: 400 })
  }

  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/crm/deals/${id}?payment=success`

  try {
    const payment = await createPayment(
      amountRub,
      description,
      returnUrl,
      {
        purpose: 'deal',
        dealId: id,
        userId: user.id,
      }
    )

    const dbPayment = await prisma.payment.create({
      data: {
        userId: user.id,
        crmDealId: id,
        provider: 'yookassa',
        providerPaymentId: payment.id,
        amount: Math.round(amountRub * 100),
        currency: deal.currency,
        status: 'pending',
        purpose: 'deal',
        metadata: { dealId: id, userId: user.id },
      },
    })

    await prisma.crmActivityLog.create({
      data: {
        userId: user.id,
        action: 'deal_payment_create',
        entityType: 'deal',
        entityId: id,
        details: { amountRub, paymentId: dbPayment.id, yookassaId: payment.id },
      },
    })

    return NextResponse.json({
      paymentId: payment.id,
      confirmationUrl: payment.confirmation?.confirmation_url,
      dbPayment,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка создания платежа'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
