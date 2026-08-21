'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface CrmClient {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  status: string
  createdAt: string
}

export default function ClientsPage() {
  const [clients, setClients] = useState<CrmClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/crm/clients')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login?callbackUrl=/crm/clients')
          return null
        }
        if (!res.ok) throw new Error('Ошибка загрузки клиентов')
        return res.json()
      })
      .then((data) => {
        if (data) setClients(data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [router])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить клиента «${name}»?`)) return
    const res = await fetch(`/api/crm/clients/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setClients((prev) => prev.filter((c) => c.id !== id))
    } else {
      alert('Не удалось удалить клиента')
    }
  }

  if (loading) return <div className="p-8">Загрузка...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Клиенты
          </h1>
          <div className="flex gap-3">
            <Link
              href="/crm"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Назад в CRM
            </Link>
            <Link
              href="/crm/clients/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              + Добавить клиента
            </Link>
          </div>
        </div>

        {clients.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-600 dark:text-gray-400">Клиентов пока нет</p>
            <Link
              href="/crm/clients/new"
              className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              Добавить первого клиента
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
                    Email
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Статус
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => router.push(`/crm/clients/${client.id}`)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {client.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {client.company || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {client.phone || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {client.email || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={client.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(client.id, client.name)
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    prospect: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  }
  const labels: Record<string, string> = {
    active: 'Активен',
    inactive: 'Неактивен',
    prospect: 'Потенциальный',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${colors[status] ?? colors.inactive}`}
    >
      {labels[status] ?? status}
    </span>
  )
}
