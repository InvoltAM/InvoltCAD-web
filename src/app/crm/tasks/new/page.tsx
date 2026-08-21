'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface RelatedOption {
  id: string
  name: string
  type: 'client' | 'lead' | 'deal'
}

export default function NewTaskPage() {
  const router = useRouter()
  const [relatedOptions, setRelatedOptions] = useState<RelatedOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [relatedType, setRelatedType] = useState<string>('')

  useEffect(() => {
    Promise.all([
      fetch('/api/crm/clients').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/crm/leads').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/crm/deals').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([clients, leads, deals]) => {
        const options: RelatedOption[] = []
        clients.forEach((c: { id: string; name: string }) =>
          options.push({ id: c.id, name: c.name, type: 'client' })
        )
        leads.forEach((l: { id: string; name: string }) =>
          options.push({ id: l.id, name: l.name, type: 'lead' })
        )
        deals.forEach((d: { id: string; title: string }) =>
          options.push({ id: d.id, name: d.title, type: 'deal' })
        )
        setRelatedOptions(options)
      })
      .catch(() => setRelatedOptions([]))
      .finally(() => setOptionsLoading(false))
  }, [router])

  const filteredOptions = relatedOptions.filter((o) => o.type === relatedType)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const form = e.currentTarget
    const formData = new FormData(form)
    const body = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      status: formData.get('status') as string,
      priority: formData.get('priority') as string,
      dueDate: formData.get('dueDate') as string,
      relatedType: (formData.get('relatedType') as string) || null,
      relatedId: (formData.get('relatedId') as string) || null,
    }

    const res = await fetch('/api/crm/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      router.push('/crm/tasks')
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Ошибка создания задачи')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Новая задача
          </h1>
          <Link
            href="/crm/tasks"
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Позвонить клиенту"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Статус
              </label>
              <select
                name="status"
                defaultValue="todo"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="todo">К выполнению</option>
                <option value="in_progress">В работе</option>
                <option value="done">Выполнена</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Приоритет
              </label>
              <select
                name="priority"
                defaultValue="medium"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Срок выполнения
            </label>
            <input
              name="dueDate"
              type="date"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Тип связи
              </label>
              <select
                name="relatedType"
                value={relatedType}
                onChange={(e) => setRelatedType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">— Нет связи —</option>
                <option value="client">Клиент</option>
                <option value="lead">Лид</option>
                <option value="deal">Сделка</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Связанный объект
              </label>
              <select
                name="relatedId"
                disabled={!relatedType || optionsLoading}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">— Выберите —</option>
                {filteredOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Описание
            </label>
            <textarea
              name="description"
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="Подробности задачи..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link
              href="/crm/tasks"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Отмена
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
