'use client'

import { useEffect, useState } from 'react'

interface Payment {
  id: string
  amount: number
  currency: string
  status: string
  purpose: string
  createdAt: string
}

interface CreditTransaction {
  id: string
  amount: number
  type: string
  description: string
  createdAt: string
}

export default function BillingPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [credits, setCredits] = useState<CreditTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/billing/history')
      .then((res) => res.json())
      .then((data) => {
        setPayments(data.payments ?? [])
        setCredits(data.credits ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold text-gray-900 dark:text-white">
          Биллинг
        </h1>

        <div className="mb-8 rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            История платежей
          </h2>
          {payments.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">Нет платежей</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 text-gray-600 dark:text-gray-400">Дата</th>
                    <th className="pb-2 text-gray-600 dark:text-gray-400">Сумма</th>
                    <th className="pb-2 text-gray-600 dark:text-gray-400">Статус</th>
                    <th className="pb-2 text-gray-600 dark:text-gray-400">Назначение</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-2 text-gray-900 dark:text-white">
                        {new Date(p.createdAt).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="py-2 text-gray-900 dark:text-white">
                        {p.amount} {p.currency}
                      </td>
                      <td className="py-2">
                        <span
                          className={`rounded px-2 py-1 text-xs ${
                            p.status === 'succeeded'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2 text-gray-600 dark:text-gray-400">{p.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            История кредитов
          </h2>
          {credits.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">Нет транзакций</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 text-gray-600 dark:text-gray-400">Дата</th>
                    <th className="pb-2 text-gray-600 dark:text-gray-400">Сумма</th>
                    <th className="pb-2 text-gray-600 dark:text-gray-400">Тип</th>
                    <th className="pb-2 text-gray-600 dark:text-gray-400">Описание</th>
                  </tr>
                </thead>
                <tbody>
                  {credits.map((t) => (
                    <tr key={t.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-2 text-gray-900 dark:text-white">
                        {new Date(t.createdAt).toLocaleDateString('ru-RU')}
                      </td>
                      <td className={`py-2 font-medium ${t.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {t.amount > 0 ? '+' : ''}{t.amount}
                      </td>
                      <td className="py-2 text-gray-600 dark:text-gray-400">{t.type}</td>
                      <td className="py-2 text-gray-600 dark:text-gray-400">{t.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
