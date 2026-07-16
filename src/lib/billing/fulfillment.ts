import { prisma } from '@/lib/prisma'
import { getPlanLimits } from './limits'

export async function activateSubscription(
  userId: string,
  planSlug: string,
  interval: 'month' | 'year',
  provider: string,
  providerSubscriptionId?: string
): Promise<void> {
  const plan = await prisma.plan.findUnique({
    where: { slug: planSlug },
  })

  if (!plan) {
    throw new Error(`Тариф ${planSlug} не найден`)
  }

  const now = new Date()
  const periodEnd = new Date(now)
  if (interval === 'month') {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  }

  // Деактивируем старые подписки
  await prisma.userSubscription.updateMany({
    where: {
      userId,
      status: 'active',
    },
    data: {
      status: 'cancelled',
      cancelAtPeriodEnd: true,
    },
  })

  // Создаём новую подписку
  await prisma.userSubscription.create({
    data: {
      userId,
      planId: plan.id,
      status: 'active',
      interval,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      provider,
      providerSubscriptionId,
    },
  })

  // Начисляем кредиты, включённые в тариф
  const limits = getPlanLimits(planSlug)
  if (limits.creditsIncludedMonthly > 0) {
    await prisma.creditTransaction.create({
      data: {
        userId,
        amount: limits.creditsIncludedMonthly,
        type: 'subscription_grant',
        description: `Ежемесячные кредиты по тарифу ${plan.name}`,
      },
    })

    await prisma.user.update({
      where: { id: userId },
      data: {
        credits: {
          increment: limits.creditsIncludedMonthly,
        },
      },
    })
  }
}

export async function addCredits(
  userId: string,
  amount: number,
  type: string,
  description: string,
  paymentId?: string
): Promise<void> {
  await prisma.creditTransaction.create({
    data: {
      userId,
      amount,
      type,
      description,
      paymentId,
    },
  })

  await prisma.user.update({
    where: { id: userId },
    data: {
      credits: {
        increment: amount,
      },
    },
  })
}

export async function spendCredits(
  userId: string,
  amount: number,
  description: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  })

  if (!user || user.credits < amount) {
    return false
  }

  await prisma.creditTransaction.create({
    data: {
      userId,
      amount: -amount,
      type: 'usage',
      description,
    },
  })

  await prisma.user.update({
    where: { id: userId },
    data: {
      credits: {
        decrement: amount,
      },
    },
  })

  return true
}
