'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import CrmPageHeader from '@/components/crm/CrmPageHeader'
import CrmTable from '@/components/crm/CrmTable'
import CrmEmptyState from '@/components/crm/CrmEmptyState'
import CrmButton from '@/components/crm/CrmButton'
import CrmStatusBadge from '@/components/crm/CrmStatusBadge'

interface CrmLead {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  status: string
  source: string | null
  createdAt: string
}

const statusLabels: Record<string, string> = {
  new: 'Новый',
  contacted: 'В работе',
  qualified: 'Квалифицирован',
  lost: 'Потерян',
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<CrmLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/crm/leads')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login?callbackUrl=/crm/leads')
          return null
        }
        if (!res.ok) throw new Error('Ошибка загрузки лидов')
        return res.json()
      })
      .then((data) => {
        if (data) setLeads(data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [router])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить лида «${name}»?`)) return
    const res = await fetch(`/api/crm/leads/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setLeads((prev) => prev.filter((l) => l.id !== id))
    } else {
      alert('Не удалось удалить лида')
    }
  }

  return (
    <div className="space-y-6">
      <CrmPageHeader title="Лиды" count={leads.length} subtitle="Управление лидами">
        <Link href="/crm/leads/new">
          <CrmButton icon={<Plus size={18} />}>Добавить лида</CrmButton>
        </Link>
      </CrmPageHeader>

      {error && <div className="text-crm-status-unpaid text-center py-8">{error}</div>}

      <CrmTable
        loading={loading}
        data={leads}
        onRowClick={(lead) => router.push(`/crm/leads/${lead.id}`)}
        empty={
          <CrmEmptyState
            title="Лидов пока нет"
            description="Добавьте первого лида, чтобы начать работу с потенциальными клиентами"
            action={
              <Link href="/crm/leads/new">
                <CrmButton icon={<Plus size={18} />}>Добавить лида</CrmButton>
              </Link>
            }
          />
        }
        columns={[
          {
            key: 'name',
            title: 'Имя',
            render: (lead) => (
              <div>
                <p className="text-[14px] font-medium text-crm-text-primary">{lead.name}</p>
                {lead.company && <p className="text-[12px] text-crm-text-secondary">{lead.company}</p>}
              </div>
            ),
          },
          {
            key: 'phone',
            title: 'Телефон',
            render: (lead) => <span className="text-crm-text-secondary">{lead.phone || '—'}</span>,
          },
          {
            key: 'email',
            title: 'Email',
            render: (lead) => <span className="text-crm-text-secondary">{lead.email || '—'}</span>,
          },
          {
            key: 'status',
            title: 'Статус',
            render: (lead) => <CrmStatusBadge status={lead.status} label={statusLabels[lead.status] ?? lead.status} />,
          },
          {
            key: 'source',
            title: 'Источник',
            render: (lead) => <span className="text-crm-text-secondary">{lead.source || '—'}</span>,
          },
          {
            key: 'actions',
            title: '',
            width: '80px',
            render: (lead) => (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(lead.id, lead.name)
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
