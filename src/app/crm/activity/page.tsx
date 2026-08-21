'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { History } from 'lucide-react'
import CrmPageHeader from '@/components/crm/CrmPageHeader'
import CrmCard from '@/components/crm/CrmCard'
import CrmEmptyState from '@/components/crm/CrmEmptyState'

interface ActivityLog {
  id: string
  action: string
  actionLabel: string
  entityType: string | null
  entityId: string | null
  details: Record<string, unknown>
  createdAt: string
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/crm/activity')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login?callbackUrl=/crm/activity')
          return null
        }
        if (!res.ok) throw new Error('Ошибка загрузки активности')
        return res.json()
      })
      .then((data) => {
        if (data) setLogs(data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-crm-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) return <div className="p-8 text-crm-status-unpaid">{error}</div>

  return (
    <div className="space-y-6">
      <CrmPageHeader title="История активности" subtitle="Лента изменений" />

      {logs.length === 0 ? (
        <CrmEmptyState
          title="Активность пока отсутствует"
          description="Здесь будут отображаться все изменения в CRM"
          icon={<History size={48} className="text-crm-text-muted" />}
        />
      ) : (
        <div className="space-y-3">
          {logs.map((log, i) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <CrmCard className="p-4" hover={false}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-crm-text-primary">{log.actionLabel}</p>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <p className="mt-1 text-sm text-crm-text-secondary">{formatDetails(log.details)}</p>
                    )}
                    <p className="mt-2 text-xs text-crm-text-muted">
                      {new Date(log.createdAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  {log.entityType && log.entityId && <EntityLink type={log.entityType} id={log.entityId} />}
                </div>
              </CrmCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDetails(details: Record<string, unknown>) {
  return Object.entries(details)
    .map(([key, value]) => {
      const labels: Record<string, string> = {
        name: 'Имя',
        title: 'Название',
        status: 'Статус',
        stage: 'Этап',
        value: 'Сумма',
      }
      const label = labels[key] ?? key
      const formattedValue =
        typeof value === 'number' && key === 'value'
          ? (value / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })
          : String(value)
      return `${label}: ${formattedValue}`
    })
    .join(' • ')
}

function EntityLink({ type, id }: { type: string; id: string }) {
  const routes: Record<string, string> = {
    client: '/crm/clients',
    lead: '/crm/leads',
    deal: '/crm/deals',
    task: '/crm/tasks',
    event: '/crm/calendar',
  }
  const route = routes[type]
  if (!route) return null

  return (
    <Link
      href={`${route}/${id}`}
      className="shrink-0 rounded-lg border border-crm-border px-3 py-1 text-xs text-crm-text-secondary hover:text-crm-text-primary hover:border-crm-border-hover transition-colors"
    >
      Открыть
    </Link>
  )
}
