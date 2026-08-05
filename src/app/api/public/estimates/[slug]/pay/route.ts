import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPayment } from '@/lib/billing/yookassa'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// POST /api/public/estimates/[slug]/pay — создать платёж для публичного КП
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { slug } = await params

  const estimate = await prisma.estimate.findUnique({
    where: { publicSlug: slug },
    select: { id: true, total: true, name: true, projectId: true, publicExpiresAt: true },
  })

  if (!estimate) {
    return NextResponse.json({ error: 'Предложение не найдено' }, { status: 404 })
  }

  if (estimate.publicExpiresAt && new Date(estimate.publicExpiresAt) < new Date()) {
    return NextResponse.json({ error: 'Ссылка истекла' }, { status: 410 })
  }

  const amountRub = estimate.total / 100
  if (amountRub <= 0) {
    return NextResponse.json({ error: 'Сумма к оплате должна быть больше нуля' }, { status: 400 })
  }

  try {
    const payment = await createPayment(
      amountRub,
      `Оплата по КП «${estimate.name}»`,
      `${process.env.NEXT_PUBLIC_APP_URL}/public/estimates/${slug}/success`,
      {
        purpose: 'estimate',
        estimateId: estimate.id,
        projectId: estimate.projectId,
      }
    )

    await prisma.payment.create({
      data: {
        userId: 'guest', // публичные платежи не привязаны к пользователю сразу
        provider: 'yookassa',
        providerPaymentId: payment.id,
        amount: estimate.total,
        currency: 'RUB',
        status: 'pending',
        purpose: 'estimate',
        metadata: { estimateId: estimate.id, projectId: estimate.projectId },
      },
    })

    return NextResponse.json({
      paymentId: payment.id,
      confirmationUrl: payment.confirmation?.confirmation_url,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка создания платежа'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
