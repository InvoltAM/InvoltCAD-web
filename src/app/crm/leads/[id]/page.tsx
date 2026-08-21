'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface CrmLead {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  status: string
  source: string | null
  notes: string | null
  telegramChatId: string | null
}

export default function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [lead, setLead] = useState<CrmLead | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [id, setId] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ id }) => {
      setId(id)
      fetch(`/api/crm/leads/${id}`)
        .then((res) => {
          if (res.status === 401) {
            router.push(`/login?callbackUrl=/crm/leads/${id}`)
            return null
          }
          if (res.status === 404) throw new Error('Лид не найден')
          if (!res.ok) throw new Error('Ошибка загрузки лида')
          return res.json()
        })
        .then((data) => {
          if (data) setLead(data)
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    })
  }, [params, router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!id) return
    setSaving(true)
    setError(null)

    const form = e.currentTarget
    const formData = new FormData(form)
    const body = {
      name: formData.get('name') as string,
      company: formData.get('company') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      status: formData.get('status') as string,
      source: formData.get('source') as string,
      notes: formData.get('notes') as string,
      telegramChatId: formData.get('telegramChatId') as string,
    }

    const res = await fetch(`/api/crm/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      router.push('/crm/leads')
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Ошибка сохранения лида')
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8">Загрузка...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>
  if (!lead) return <div className="p-8">Лид не найден</div>

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Редактирование лида
          </h1>
          <Link
            href="/crm/leads"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Отмена
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Имя <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              required
              defaultValue={lead.name}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Компания
              </label>
              <input
                name="company"
                defaultValue={lead.company ?? ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Статус
              </label>
              <select
                name="status"
                defaultValue={lead.status}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="new">Новый</option>
                <option value="contacted">В работе</option>
                <option value="qualified">Квалифицирован</option>
                <option value="lost">Потерян</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Телефон
              </label>
              <input
                name="phone"
                defaultValue={lead.phone ?? ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                name="email"
                type="email"
                defaultValue={lead.email ?? ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Источник
            </label>
            <input
              name="source"
              defaultValue={lead.source ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Telegram chat ID
            </label>
            <input
              name="telegramChatId"
              defaultValue={lead.telegramChatId ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Примечания
            </label>
            <textarea
              name="notes"
              rows={4}
              defaultValue={lead.notes ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link
              href="/crm/leads"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Отмена
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
