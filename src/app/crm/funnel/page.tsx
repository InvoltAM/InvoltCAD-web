'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import CrmPageHeader from '@/components/crm/CrmPageHeader'
import CrmCard from '@/components/crm/CrmCard'

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

const STAGE_ACCENT: Record<string, string> = {
  new: 'border-l-crm-status-pending',
  negotiation: 'border-l-crm-status-in-progress',
  proposal: 'border-l-crm-status-partial',
  won: 'border-l-crm-status-paid',
  lost: 'border-l-crm-text-muted',
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
    <div className="space-y-6">
      <CrmPageHeader title="Воронка продаж" subtitle="Визуализация этапов сделок">
        <div className="flex items-center gap-4 text-sm text-crm-text-secondary">
          <span>
            Общая сумма: <b className="text-crm-text-primary">{(metrics.totalValue / 100).toFixed(2)} ₽</b>
          </span>
          <span>
            Выиграно: <b className="text-crm-text-primary">{(metrics.wonValue / 100).toFixed(2)} ₽</b>
          </span>
          <span>
            Конверсия: <b className="text-crm-text-primary">{metrics.conversionRate.toFixed(1)}%</b>
          </span>
        </div>
      </CrmPageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-crm-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {columns.map((col) => (
            <CrmCard
              key={col.stage}
              className={`p-3 flex flex-col min-h-[400px] ${STAGE_ACCENT[col.stage]}`}
              accent={STAGE_ACCENT[col.stage]}
              hover={false}
              onDragOver={(e: React.DragEvent) => e.preventDefault()}
              onDrop={(e: React.DragEvent) => {
                e.preventDefault()
                const dealId = e.dataTransfer.getData('dealId')
                if (dealId && dealId !== draggingId) {
                  void moveDeal(dealId, col.stage)
                }
                setDraggingId(null)
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold text-crm-text-primary">{STAGE_LABELS[col.stage]}</span>
                <span className="rounded-full bg-crm-bg-tertiary px-2 py-0.5 text-xs text-crm-text-secondary border border-crm-border">
                  {col.count}
                </span>
              </div>
              <div className="mb-2 text-xs text-crm-text-muted">
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
                    className="cursor-pointer rounded-lg border border-crm-border bg-crm-bg-primary p-3 hover:border-crm-border-hover transition-colors"
                  >
                    <p className="text-sm font-medium text-crm-text-primary">{deal.title}</p>
                    <p className="text-xs text-crm-text-muted mt-1">
                      {deal.client?.name ?? 'Без клиента'} · {(deal.value / 100).toFixed(2)} {deal.currency}
                    </p>
                    {col.stage !== 'won' && col.stage !== 'lost' && (
                      <p className="mt-1 text-xs text-crm-text-muted">{deal.probability}%</p>
                    )}
                  </div>
                ))}
              </div>
            </CrmCard>
          ))}
        </div>
      )}
    </div>
  )
}
