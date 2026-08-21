'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface CrmClient {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  telegramChatId: string | null
  address: string | null
  status: string
  source: string | null
  notes: string | null
}

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [client, setClient] = useState<CrmClient | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [id, setId] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ id }) => {
      setId(id)
      fetch(`/api/crm/clients/${id}`)
        .then((res) => {
          if (res.status === 401) {
            router.push(`/login?callbackUrl=/crm/clients/${id}`)
            return null
          }
          if (res.status === 404) throw new Error('Клиент не найден')
          if (!res.ok) throw new Error('Ошибка загрузки клиента')
          return res.json()
        })
        .then((data) => {
          if (data) setClient(data)
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
      telegramChatId: formData.get('telegramChatId') as string,
      address: formData.get('address') as string,
      status: formData.get('status') as string,
      source: formData.get('source') as string,
      notes: formData.get('notes') as string,
    }

    const res = await fetch(`/api/crm/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      router.push('/crm/clients')
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Ошибка сохранения клиента')
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8">Загрузка...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>
  if (!client) return <div className="p-8">Клиент не найден</div>

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Редактирование клиента
          </h1>
          <Link
            href="/crm/clients"
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
              defaultValue={client.name}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Компания
              </label>
              <input
                name="company"
                defaultValue={client.company ?? ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Статус
              </label>
              <select
                name="status"
                defaultValue={client.status}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="active">Активен</option>
                <option value="inactive">Неактивен</option>
                <option value="prospect">Потенциальный</option>
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
                defaultValue={client.phone ?? ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                name="email"
                type="email"
                defaultValue={client.email ?? ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Telegram chat ID
            </label>
            <input
              name="telegramChatId"
              defaultValue={client.telegramChatId ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              placeholder="123456789"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Адрес
            </label>
            <input
              name="address"
              defaultValue={client.address ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Источник
            </label>
            <input
              name="source"
              defaultValue={client.source ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Примечания
            </label>
            <textarea
              name="notes"
              rows={4}
              defaultValue={client.notes ?? ''}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link
              href="/crm/clients"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Отмена
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>

        <TelegramPanel clientId={client.id} chatId={client.telegramChatId} />
        <RelatedProjectsPanel crmClientId={client.id} />
      </div>
    </div>
  )
}

function RelatedProjectsPanel({ crmClientId }: { crmClientId: string }) {
  const [projects, setProjects] = useState<{ id: string; name: string; updatedAt: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const filtered = (data ?? []).filter((p: { crmClientId?: string | null }) => p.crmClientId === crmClientId)
        setProjects(filtered)
      })
      .finally(() => setLoading(false))
  }, [crmClientId])

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
                className="rounded-lg bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
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

function TelegramPanel({ clientId, chatId }: { clientId: string; chatId: string | null }) {
  const [messages, setMessages] = useState<{ id: string; message: string; status: string; sentAt: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [newMessage, setNewMessage] = useState('')

  useEffect(() => {
    fetch(`/api/crm/telegram?clientId=${clientId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setMessages(data))
      .finally(() => setLoading(false))
  }, [clientId])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatId || !newMessage.trim()) return
    setSending(true)

    const res = await fetch('/api/crm/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message: newMessage }),
    })

    if (res.ok) {
      const saved = await res.json()
      setMessages((prev) => [saved.log, ...prev])
      setNewMessage('')
    } else {
      alert('Не удалось отправить сообщение')
    }
    setSending(false)
  }

  return (
    <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Telegram
      </h2>

      {!chatId && (
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Укажите Telegram chat ID клиента выше, чтобы отправлять сообщения.
        </p>
      )}

      <form onSubmit={handleSend} className="mb-6 flex gap-3">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={!chatId || sending}
          placeholder="Введите сообщение..."
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <button
          type="submit"
          disabled={!chatId || !newMessage.trim() || sending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? 'Отправка...' : 'Отправить'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">Загрузка сообщений...</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">Сообщений пока нет</p>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50"
            >
              <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                {msg.message}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {new Date(msg.sentAt).toLocaleString('ru-RU')} · {msg.status === 'sent' ? 'Отправлено' : 'Ошибка'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
