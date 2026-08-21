'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  updatedAt: string
}

export default function EmailTemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [form, setForm] = useState({ name: '', subject: '', body: '' })

  useEffect(() => {
    fetch('/api/crm/email-templates')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login?callbackUrl=/crm/email-templates')
          return []
        }
        return res.ok ? res.json() : []
      })
      .then((data) => setTemplates(data))
      .finally(() => setLoading(false))
  }, [router])

  const resetForm = () => {
    setForm({ name: '', subject: '', body: '' })
    setEditing(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const url = editing ? `/api/crm/email-templates/${editing.id}` : '/api/crm/email-templates'
    const method = editing ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      const saved = await res.json()
      if (editing) {
        setTemplates((prev) => prev.map((t) => (t.id === saved.id ? saved : t)))
      } else {
        setTemplates((prev) => [saved, ...prev])
      }
      resetForm()
    } else {
      alert('Ошибка сохранения шаблона')
    }
  }

  const handleEdit = (t: EmailTemplate) => {
    setEditing(t)
    setForm({ name: t.name, subject: t.subject, body: t.body })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить шаблон?')) return
    const res = await fetch(`/api/crm/email-templates/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      if (editing?.id === id) resetForm()
    } else {
      alert('Ошибка удаления')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Шаблоны email</h1>
          <Link
            href="/crm"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Назад
          </Link>
        </div>

        <form
          onSubmit={handleSave}
          className="mb-8 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editing ? 'Редактирование шаблона' : 'Новый шаблон'}
          </h2>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Название шаблона"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Тема письма"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Текст письма (HTML)"
            rows={6}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <div className="flex justify-end gap-3">
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Отмена
              </button>
            )}
            <button
              type="submit"
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
            >
              {editing ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>

        {loading ? (
          <p className="text-gray-600 dark:text-gray-400">Загрузка...</p>
        ) : templates.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">Шаблонов пока нет</p>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{t.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t.subject}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(t)}
                    className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
