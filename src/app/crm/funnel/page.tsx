'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface FunnelDeal {
  id: string
  title: string
  value: number
  currency: string
  probability: number
  client: { name: string } | null
}

interface FunnelColumn {
  stage: string
  deals: FunnelDeal[]
  count: number
  value: number
}

const STAGE_LABELS: Record<string, string> = {
  new: 'Новая',
  negotiation: 'Переговоры',
  proposal: 'Предложение',
  won: 'Выиграна',
  lost: 'Проиграна',
}

const STAGE_COLORS: Record<string, string> = {
  new: 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800',
  negotiation: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
  proposal: 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20',
  won: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
  lost: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
}

export default function FunnelPage() {
  const router = useRouter()
  const [columns, setColumns] = useState<FunnelColumn[]>([])
  const [metrics, setMetrics] = useState({ totalValue: 0, wonValue: 0, conversionRate: 0 })
  const [loading, setLoading] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/crm/deals/funnel')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login?callbackUrl=/crm/funnel')
          return null
        }
        return res.ok ? res.json() : null
      })
      .then((data) => {
        if (data) {
          setColumns(data.columns)
          setMetrics({ totalValue: data.totalValue, wonValue: data.wonValue, conversionRate: data.conversionRate })
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  const moveDeal = async (dealId: string, newStage: string) => {
    const prev = columns
    setColumns((cols) =>
      cols.map((col) => {
        if (col.stage === newStage) return col
        return { ...col, deals: col.deals.filter((d) => d.id !== dealId) }
      })
    )

    const deal = prev.flatMap((c) => c.deals).find((d) => d.id === dealId)
    if (!deal) return

    setColumns((cols) => {
      const target = cols.find((c) => c.stage === newStage)
      if (!target) return cols
      if (target.deals.some((d) => d.id === dealId)) return cols
      return cols.map((col) =>
        col.stage === newStage
          ? { ...col, deals: [{ ...deal, probability: newStage === 'won' ? 100 : newStage === 'lost' ? 0 : deal.probability }, ...col.deals] }
          : col
      )
    })

    const res = await fetch(`/api/crm/deals/${dealId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })

    if (!res.ok) {
      alert('Не удалось переместить сделку')
      setColumns(prev)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Воронка продаж</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Общая сумма: <b>{(metrics.totalValue / 100).toFixed(2)} ₽</b> · Выиграно:{' '}
              <b>{(metrics.wonValue / 100).toFixed(2)} ₽</b> · Конверсия:{' '}
              <b>{metrics.conversionRate.toFixed(1)}%</b>
            </p>
          </div>
          <Link
            href="/crm"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Назад в CRM
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-600 dark:text-gray-400">Загрузка...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {columns.map((col) => (
              <div
                key={col.stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const dealId = e.dataTransfer.getData('dealId')
                  if (dealId && dealId !== draggingId) {
                    void moveDeal(dealId, col.stage)
                  }
                  setDraggingId(null)
                }}
                className={`flex flex-col rounded-lg border ${STAGE_COLORS[col.stage]} p-3`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white">{STAGE_LABELS[col.stage]}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-300">
                    {col.count}
                  </span>
                </div>
                <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  {(col.value / 100).toFixed(2)} ₽
                </div>
                <div className="flex-1 space-y-2">
                  {col.deals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('dealId', deal.id)
                        setDraggingId(deal.id)
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => router.push(`/crm/deals/${deal.id}`)}
                      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md dark:border-gray-600 dark:bg-gray-700"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{deal.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {deal.client?.name ?? 'Без клиента'} · {(deal.value / 100).toFixed(2)} {deal.currency}
                      </p>
                      {col.stage !== 'won' && col.stage !== 'lost' && (
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{deal.probability}%</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
