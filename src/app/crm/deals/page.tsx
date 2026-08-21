'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, ArrowRight } from 'lucide-react'
import CrmPageHeader from '@/components/crm/CrmPageHeader'
import CrmTable from '@/components/crm/CrmTable'
import CrmEmptyState from '@/components/crm/CrmEmptyState'
import CrmButton from '@/components/crm/CrmButton'
import CrmCard from '@/components/crm/CrmCard'
import CrmStatusBadge from '@/components/crm/CrmStatusBadge'

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

const stageLabels: Record<string, string> = {
  new: 'Новая',
  negotiation: 'Переговоры',
  proposal: 'Предложение',
  won: 'Выиграна',
  lost: 'Проиграна',
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

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0) / 100
  const wonValue = deals.filter((d) => d.stage === 'won').reduce((sum, d) => sum + d.value, 0) / 100

  return (
    <div className="space-y-6">
      <CrmPageHeader title="Сделки" count={deals.length} subtitle="Управление сделками и проектами">
        <Link href="/crm/deals/new">
          <CrmButton icon={<Plus size={18} />}>Добавить сделку</CrmButton>
        </Link>
      </CrmPageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CrmCard className="p-5" accent="border-l-crm-accent">
          <p className="text-[12px] text-crm-text-secondary font-medium tracking-wide">Всего сделок</p>
          <p className="font-crm-space text-[28px] font-bold text-crm-text-primary mt-1">{deals.length}</p>
        </CrmCard>
        <CrmCard className="p-5" accent="border-l-crm-status-in-progress">
          <p className="text-[12px] text-crm-text-secondary font-medium tracking-wide">Общая сумма</p>
          <p className="font-crm-space text-[28px] font-bold text-crm-text-primary mt-1">
            {totalValue.toLocaleString('ru-RU')} ₽
          </p>
        </CrmCard>
        <CrmCard className="p-5" accent="border-l-crm-status-paid">
          <p className="text-[12px] text-crm-text-secondary font-medium tracking-wide">Выиграно</p>
          <p className="font-crm-space text-[28px] font-bold text-crm-text-primary mt-1">
            {wonValue.toLocaleString('ru-RU')} ₽
          </p>
        </CrmCard>
      </div>

      {error && (
        <div className="text-crm-status-unpaid text-center py-8">{error}</div>
      )}

      <CrmTable
        loading={loading}
        data={deals}
        onRowClick={(deal) => router.push(`/crm/deals/${deal.id}`)}
        empty={
          <CrmEmptyState
            title="Сделок пока нет"
            description="Добавьте первую сделку, чтобы начать отслеживать продажи"
            action={
              <Link href="/crm/deals/new">
                <CrmButton icon={<Plus size={18} />}>Добавить сделку</CrmButton>
              </Link>
            }
          />
        }
        columns={[
          {
            key: 'title',
            title: 'Название',
            render: (deal) => (
              <div>
                <p className="text-[14px] font-medium text-crm-text-primary">{deal.title}</p>
                <p className="text-[12px] text-crm-text-secondary">{deal.client?.name || '—'}</p>
              </div>
            ),
          },
          {
            key: 'value',
            title: 'Сумма',
            render: (deal) => (
              <span className="text-crm-text-primary font-crm-space">
                {(deal.value / 100).toLocaleString('ru-RU')} {deal.currency}
              </span>
            ),
          },
          {
            key: 'stage',
            title: 'Этап',
            render: (deal) => <CrmStatusBadge status={deal.stage} label={stageLabels[deal.stage] ?? deal.stage} />,
          },
          {
            key: 'probability',
            title: 'Вероятность',
            render: (deal) => <span className="text-crm-text-secondary">{deal.probability}%</span>,
          },
          {
            key: 'expectedCloseDate',
            title: 'Закрытие',
            render: (deal) => (
              <span className="text-crm-text-secondary">
                {deal.expectedCloseDate
                  ? new Date(deal.expectedCloseDate).toLocaleDateString('ru-RU')
                  : '—'}
              </span>
            ),
          },
          {
            key: 'actions',
            title: '',
            width: '80px',
            render: (deal) => (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(deal.id, deal.title)
                }}
                className="text-crm-status-unpaid hover:text-red-400 text-sm"
              >
                Удалить
              </button>
            ),
          },
        ]}
      />
    </div>
  )
}
