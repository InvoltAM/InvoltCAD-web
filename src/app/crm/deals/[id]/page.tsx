'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface CrmClient {
  id: string
  name: string
}

interface CrmDeal {
  id: string
  title: string
  clientId: string | null
  value: number
  currency: string
  stage: string
  probability: number
  expectedCloseDate: string | null
}

export default function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [deal, setDeal] = useState<CrmDeal | null>(null)
  const [clients, setClients] = useState<CrmClient[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [id, setId] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ id }) => {
      setId(id)
      Promise.all([
        fetch(`/api/crm/deals/${id}`).then((res) => {
          if (res.status === 401) {
            router.push(`/login?callbackUrl=/crm/deals/${id}`)
            return null
          }
          if (res.status === 404) throw new Error('Сделка не найдена')
          if (!res.ok) throw new Error('Ошибка загрузки сделки')
          return res.json()
        }),
        fetch('/api/crm/clients').then((res) => {
          if (!res.ok) return []
          return res.json()
        }),
      ])
        .then(([dealData, clientsData]) => {
          if (dealData) setDeal(dealData)
          if (clientsData) setClients(clientsData)
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
      title: formData.get('title') as string,
      clientId: formData.get('clientId') as string,
      value: Math.round(Number(formData.get('value')) * 100),
      currency: formData.get('currency') as string,
      stage: formData.get('stage') as string,
      probability: Number(formData.get('probability')),
      expectedCloseDate: formData.get('expectedCloseDate') as string,
    }

    const res = await fetch(`/api/crm/deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      router.push('/crm/deals')
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Ошибка сохранения сделки')
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8">Загрузка...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>
  if (!deal) return <div className="p-8">Сделка не найдена</div>

  const valueRub = (deal.value / 100).toFixed(2)
  const expectedDate = deal.expectedCloseDate
    ? new Date(deal.expectedCloseDate).toISOString().split('T')[0]
    : ''

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Редактирование сделки
          </h1>
          <Link
            href="/crm/deals"
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
              Название <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              required
              defaultValue={deal.title}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Клиент
            </label>
            <select
              name="clientId"
              defaultValue={deal.clientId ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">— Без клиента —</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Сумма
              </label>
              <input
                name="value"
                type="number"
                step="0.01"
                min="0"
                defaultValue={valueRub}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Валюта
              </label>
              <select
                name="currency"
                defaultValue={deal.currency}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="RUB">RUB — ₽</option>
                <option value="USD">USD — $</option>
                <option value="EUR">EUR — €</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Этап
              </label>
              <select
                name="stage"
                defaultValue={deal.stage}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="new">Новая</option>
                <option value="negotiation">Переговоры</option>
                <option value="proposal">Предложение</option>
                <option value="won">Выиграна</option>
                <option value="lost">Проиграна</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Вероятность, %
              </label>
              <input
                name="probability"
                type="number"
                min="0"
                max="100"
                defaultValue={deal.probability}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Ожидаемая дата закрытия
            </label>
            <input
              name="expectedCloseDate"
              type="date"
              defaultValue={expectedDate}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link
              href="/crm/deals"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Отмена
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>

        <RelatedProjectsPanel crmDealId={deal.id} />
      </div>
    </div>
  )
}

function RelatedProjectsPanel({ crmDealId }: { crmDealId: string }) {
  const [projects, setProjects] = useState<{ id: string; name: string; updatedAt: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const filtered = (data ?? []).filter((p: { crmDealId?: string | null }) => p.crmDealId === crmDealId)
        setProjects(filtered)
      })
      .finally(() => setLoading(false))
  }, [crmDealId])

  return (
    <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Связанные проекты</h2>
      {loading ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">Загрузка...</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">Нет связанных проектов</p>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
              <span className="font-medium text-gray-900 dark:text-white">{p.name}</span>
              <Link
                href={`/editor?project=${p.id}`}
                className="rounded-lg bg-purple-600 px-3 py-1 text-xs text-white hover:bg-purple-700"
              >
                Открыть
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
