'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface CrmDeal {
  id: string
  title: string
  value: number
  currency: string
  stage: string
  probability: number
  expectedCloseDate: string | null
  client: { id: string; name: string } | null
}

export default function DealsPage() {
  const [deals, setDeals] = useState<CrmDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/crm/deals')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login?callbackUrl=/crm/deals')
          return null
        }
        if (!res.ok) throw new Error('Ошибка загрузки сделок')
        return res.json()
      })
      .then((data) => {
        if (data) setDeals(data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [router])

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Удалить сделку «${title}»?`)) return
    const res = await fetch(`/api/crm/deals/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setDeals((prev) => prev.filter((d) => d.id !== id))
    } else {
      alert('Не удалось удалить сделку')
    }
  }

  if (loading) return <div className="p-8">Загрузка...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Сделки
          </h1>
          <div className="flex gap-3">
            <Link
              href="/crm"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Назад в CRM
            </Link>
            <Link
              href="/crm/deals/new"
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
            >
              + Добавить сделку
            </Link>
          </div>
        </div>

        {deals.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-600 dark:text-gray-400">Сделок пока нет</p>
            <Link
              href="/crm/deals/new"
              className="mt-4 inline-block rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
            >
              Добавить первую сделку
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Название
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Клиент
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Сумма
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Этап
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Вероятность
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Дата закрытия
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {deals.map((deal) => (
                  <tr
                    key={deal.id}
                    onClick={() => router.push(`/crm/deals/${deal.id}`)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {deal.title}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {deal.client?.name || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatValue(deal.value, deal.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge stage={deal.stage} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {deal.probability}%
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {deal.expectedCloseDate
                        ? new Date(deal.expectedCloseDate).toLocaleDateString('ru-RU')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(deal.id, deal.title)
                        }}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function formatValue(value: number, currency: string) {
  const amount = (value / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })
  return `${amount} ${currency}`
}

function StageBadge({ stage }: { stage: string }) {
  const colors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    negotiation: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    proposal: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    won: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    lost: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  }
  const labels: Record<string, string> = {
    new: 'Новая',
    negotiation: 'Переговоры',
    proposal: 'Предложение',
    won: 'Выиграна',
    lost: 'Проиграна',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${colors[stage] ?? colors.new}`}
    >
      {labels[stage] ?? stage}
    </span>
  )
}
