'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface CrmTask {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  relatedType: string | null
  relatedId: string | null
}

interface RelatedOption {
  id: string
  name: string
  type: 'client' | 'lead' | 'deal'
}

export default function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [task, setTask] = useState<CrmTask | null>(null)
  const [relatedOptions, setRelatedOptions] = useState<RelatedOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [id, setId] = useState<string | null>(null)
  const [relatedType, setRelatedType] = useState<string>('')

  useEffect(() => {
    params.then(({ id }) => {
      setId(id)
      Promise.all([
        fetch(`/api/crm/tasks/${id}`).then((res) => {
          if (res.status === 401) {
            router.push(`/login?callbackUrl=/crm/tasks/${id}`)
            return null
          }
          if (res.status === 404) throw new Error('Задача не найдена')
          if (!res.ok) throw new Error('Ошибка загрузки задачи')
          return res.json()
        }),
        fetch('/api/crm/clients').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/crm/leads').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/crm/deals').then((r) => (r.ok ? r.json() : [])),
      ])
        .then(([taskData, clients, leads, deals]) => {
          if (taskData) {
            setTask(taskData)
            setRelatedType(taskData.relatedType ?? '')
          }
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
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false))
    })
  }, [params, router])

  const filteredOptions = relatedOptions.filter((o) => o.type === relatedType)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!id) return
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

    const res = await fetch(`/api/crm/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      router.push('/crm/tasks')
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Ошибка сохранения задачи')
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8">Загрузка...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>
  if (!task) return <div className="p-8">Задача не найдена</div>

  const dueDate = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Редактирование задачи
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
              defaultValue={task.title}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Статус
              </label>
              <select
                name="status"
                defaultValue={task.status}
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
                defaultValue={task.priority}
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
              defaultValue={dueDate}
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
                defaultValue={task.relatedId ?? ''}
                disabled={!relatedType}
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
              defaultValue={task.description ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
