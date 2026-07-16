import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/projects/access'
import { createPayment } from '@/lib/billing/yookassa'
import { prisma } from '@/lib/prisma'

// POST /api/billing/checkout — создание платежа
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const body = await request.json()
  const { planSlug, interval, creditsAmount } = body

  let amountRub: number
  let description: string
  let purpose: string

  if (planSlug) {
    // Оплата подписки
    const plan = await prisma.plan.findUnique({
      where: { slug: planSlug },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Тариф не найден' }, { status: 404 })
    }

    amountRub = interval === 'year' ? plan.priceYearly : plan.priceMonthly
    description = `Подписка ${plan.name} (${interval === 'year' ? 'год' : 'месяц'})`
    purpose = 'subscription'
  } else if (creditsAmount) {
    // Покупка кредитов
    amountRub = creditsAmount * 10 // 1 кредит = 10 руб (настроить)
    description = `Покупка ${creditsAmount} кредитов`
    purpose = 'credits'
  } else {
    return NextResponse.json({ error: 'Не указан план или кредиты' }, { status: 400 })
  }

  try {
    const payment = await createPayment(
      amountRub,
      description,
      `${process.env.NEXT_PUBLIC_APP_URL}/billing/success`,
      {
        userId: user.id,
        planSlug: planSlug ?? '',
        interval: interval ?? '',
        creditsAmount: String(creditsAmount ?? 0),
      }
    )

    // Сохраняем платёж в БД
    await prisma.payment.create({
      data: {
        userId: user.id,
        provider: 'yookassa',
        providerPaymentId: payment.id,
        amount: Math.round(amountRub * 100), // в копейках
        currency: 'RUB',
        status: 'pending',
        purpose,
        metadata: {
          planSlug: planSlug ?? '',
          interval: interval ?? '',
          creditsAmount: creditsAmount ?? 0,
        },
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
