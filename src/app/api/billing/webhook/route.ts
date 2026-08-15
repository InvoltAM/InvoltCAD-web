import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookToken, getPayment } from '@/lib/billing/yookassa'
import { activateSubscription, addCredits, fulfillMarketplacePurchase } from '@/lib/billing/fulfillment'
import { prisma } from '@/lib/prisma'

// POST /api/billing/webhook — обработка webhook от YooKassa
export async function POST(request: NextRequest) {
  const token = request.headers.get('x-yookassa-token')
  if (!verifyWebhookToken(token)) {
    return NextResponse.json({ error: 'Неверный токен' }, { status: 403 })
  }

  const body = await request.json()
  const paymentId = body.object?.id

  if (!paymentId) {
    return NextResponse.json({ error: 'Нет paymentId' }, { status: 400 })
  }

  // Получаем актуальный статус платежа от YooKassa
  const payment = await getPayment(paymentId)

  if (payment.status !== 'succeeded') {
    return NextResponse.json({ status: 'ignored' })
  }

  // Находим платёж в нашей БД
  const dbPayment = await prisma.payment.findFirst({
    where: { providerPaymentId: paymentId },
  })

  if (!dbPayment) {
    return NextResponse.json({ error: 'Платёж не найден' }, { status: 404 })
  }

  if (dbPayment.status === 'succeeded') {
    return NextResponse.json({ status: 'already_processed' })
  }

  // Обновляем статус платежа
  await prisma.payment.update({
    where: { id: dbPayment.id },
    data: { status: 'succeeded' },
  })

  const metadata = dbPayment.metadata as Record<string, string>
  const userId = dbPayment.userId

  // Выполняем fulfillment в зависимости от цели платежа
  if (dbPayment.purpose === 'subscription') {
    const planSlug = metadata.planSlug
    const interval = metadata.interval as 'month' | 'year'
    await activateSubscription(userId, planSlug, interval, 'yookassa', paymentId)
  } else if (dbPayment.purpose === 'credits') {
    const creditsAmount = parseInt(metadata.creditsAmount, 10)
    await addCredits(
      userId,
      creditsAmount,
      'purchase',
      `Покупка ${creditsAmount} кредитов`,
      dbPayment.id
    )
  } else if (dbPayment.purpose === 'marketplace') {
    const itemId = metadata.itemId
    const itemType = metadata.itemType as 'device' | 'template' | undefined

    if (!itemId || !itemType) {
      return NextResponse.json({ error: 'Неверные метаданные маркетплейс-платежа' }, { status: 400 })
    }

    try {
      const result = await fulfillMarketplacePurchase(
        dbPayment.id,
        userId,
        { itemId, itemType }
      )

      if (!result.success) {
        // YooKassa ожидает 200 даже при логических ошибках; логируем, но не ретраим
        console.warn('Marketplace fulfillment failed:', result.error)
        return NextResponse.json({ status: 'ignored', error: result.error })
      }
    } catch (error) {
      console.error('Marketplace fulfillment error:', error)
      return NextResponse.json({ status: 'error' }, { status: 500 })
    }
  } else if (dbPayment.purpose === 'estimate') {
    const estimateId = metadata.estimateId
    const projectId = metadata.projectId
    if (estimateId && projectId) {
      await prisma.estimate.update({
        where: { id: estimateId },
        data: { status: 'accepted' },
      })
    }
  }

  return NextResponse.json({ status: 'processed' })
}
