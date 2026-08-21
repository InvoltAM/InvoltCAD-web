'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

  if (loading) return <div className="p-8">Загрузка...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Лиды
          </h1>
          <div className="flex gap-3">
            <Link
              href="/crm"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Назад в CRM
            </Link>
            <Link
              href="/crm/leads/new"
              className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
            >
              + Добавить лида
            </Link>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-600 dark:text-gray-400">Лидов пока нет</p>
            <Link
              href="/crm/leads/new"
              className="mt-4 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
            >
              Добавить первого лида
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Имя
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Компания
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Телефон
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Статус
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Источник
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {lead.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {lead.company || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {lead.phone || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {lead.source || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(lead.id, lead.name)}
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    contacted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    qualified: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    lost: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  }
  const labels: Record<string, string> = {
    new: 'Новый',
    contacted: 'В работе',
    qualified: 'Квалифицирован',
    lost: 'Потерян',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${colors[status] ?? colors.new}`}
    >
      {labels[status] ?? status}
    </span>
  )
}
