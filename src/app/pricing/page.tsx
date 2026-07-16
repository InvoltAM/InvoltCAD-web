'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const plans = [
  {
    slug: 'free',
    name: 'Бесплатный',
    priceMonthly: 0,
    priceYearly: 0,
    features: ['3 проекта', '10 экспортов/мес', 'Базовые функции'],
  },
  {
    slug: 'pro',
    name: 'Pro',
    priceMonthly: 990,
    priceYearly: 9900,
    features: ['50 проектов', '200 экспортов/мес', 'PDF экспорт', 'DXF импорт', 'Совместный доступ', 'Маркетплейс'],
  },
  {
    slug: 'business',
    name: 'Business',
    priceMonthly: 2990,
    priceYearly: 29900,
    features: ['Безлимитные проекты', 'Безлимитный экспорт', 'AI-ассистент', 'Приоритетная поддержка'],
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const [loading, setLoading] = useState<string | null>(null)

  const handleCheckout = async (planSlug: string) => {
    if (planSlug === 'free') {
      router.push('/editor')
      return
    }

    setLoading(planSlug)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug, interval }),
      })

      const data = await res.json()
      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl
      } else {
        alert(data.error ?? 'Ошибка создания платежа')
      }
    } catch (error) {
      alert('Ошибка сети')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-center text-3xl font-bold text-gray-900 dark:text-white">
          Тарифы InvoltCAD
        </h1>

        <div className="mb-8 flex justify-center gap-4">
          <button
            onClick={() => setInterval('month')}
            className={`rounded-lg px-4 py-2 ${interval === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
          >
            Месяц
          </button>
          <button
            onClick={() => setInterval('year')}
            className={`rounded-lg px-4 py-2 ${interval === 'year' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
          >
            Год (2 месяца в подарок)
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.slug}
              className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800"
            >
              <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
                {plan.name}
              </h2>
              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {interval === 'month' ? plan.priceMonthly : plan.priceYearly} ₽
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  /{interval === 'month' ? 'мес' : 'год'}
                </span>
              </div>
              <ul className="mb-6 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <span className="text-green-500">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout(plan.slug)}
                disabled={loading === plan.slug}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading === plan.slug ? 'Загрузка...' : plan.slug === 'free' ? 'Начать бесплатно' : 'Выбрать'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
