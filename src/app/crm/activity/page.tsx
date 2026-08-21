'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

  if (loading) return <div className="p-8">Загрузка...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            История активности
          </h1>
          <Link
            href="/crm"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Назад в CRM
          </Link>
        </div>

        {logs.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-600 dark:text-gray-400">Активность пока отсутствует</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {log.actionLabel}
                    </p>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {formatDetails(log.details)}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                      {new Date(log.createdAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  {log.entityType && log.entityId && (
                    <EntityLink type={log.entityType} id={log.entityId} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
      className="shrink-0 rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      Открыть
    </Link>
  )
}
