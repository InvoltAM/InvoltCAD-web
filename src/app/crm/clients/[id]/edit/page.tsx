'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import CrmCard from '@/components/crm/CrmCard'
import CrmButton from '@/components/crm/CrmButton'

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

  useEffect(() => {
    params.then(({ id }) => {
      fetch(`/api/crm/clients/${id}`)
        .then((res) => {
          if (res.status === 401) {
            router.push(`/login?callbackUrl=/crm/clients/${id}/edit`)
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
    if (!client) return
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

    const res = await fetch(`/api/crm/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      router.push(`/crm/clients/${client.id}`)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Ошибка сохранения клиента')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-crm-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-crm-status-unpaid text-center py-16">
        {error}
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-crm-text-secondary text-center py-16">
        Клиент не найден
      </div>
    )
  }

  const inputClass =
    'w-full px-3 py-3 bg-crm-bg-primary border border-crm-border rounded-md text-sm text-crm-text-primary placeholder:text-crm-text-muted focus:outline-none focus:border-crm-accent focus:ring-[3px] focus:ring-crm-accent/15 transition-all'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-3"
      >
        <Link
          href={`/crm/clients/${client.id}`}
          className="w-9 h-9 flex items-center justify-center rounded-md text-crm-text-secondary hover:text-crm-text-primary hover:bg-crm-bg-tertiary/50 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-crm-manrope text-[28px] font-bold text-crm-text-primary tracking-tight leading-tight">
            Редактирование клиента
          </h1>
          <p className="text-[13px] text-crm-text-secondary">{client.name}</p>
        </div>
      </motion.div>

      <CrmCard className="p-6" hover={false}>
        {error && (
          <div className="mb-4 rounded-lg bg-crm-status-unpaid/10 p-3 text-sm text-crm-status-unpaid border border-crm-status-unpaid/30">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">
              Имя <span className="text-crm-status-unpaid">*</span>
            </label>
            <input name="name" required defaultValue={client.name} className={inputClass} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">Компания</label>
              <input name="company" defaultValue={client.company ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">Статус</label>
              <select name="status" defaultValue={client.status} className={inputClass}>
                <option value="active">Активен</option>
                <option value="inactive">Неактивен</option>
                <option value="prospect">Потенциальный</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">Телефон</label>
              <input name="phone" defaultValue={client.phone ?? ''} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">Email</label>
              <input name="email" type="email" defaultValue={client.email ?? ''} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">Telegram chat ID</label>
            <input name="telegramChatId" defaultValue={client.telegramChatId ?? ''} placeholder="123456789" className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">Адрес</label>
            <input name="address" defaultValue={client.address ?? ''} className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">Источник</label>
            <input name="source" defaultValue={client.source ?? ''} className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">Примечания</label>
            <textarea name="notes" rows={4} defaultValue={client.notes ?? ''} className={`${inputClass} resize-none`} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href={`/crm/clients/${client.id}`}>
              <CrmButton variant="ghost" type="button">Отмена</CrmButton>
            </Link>
            <CrmButton type="submit" disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </CrmButton>
          </div>
        </form>
      </CrmCard>

      <TelegramPanel clientId={client.id} chatId={client.telegramChatId} />
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
      body: JSON.stringify({ clientId, chatId, message: newMessage }),
    })

    if (res.ok) {
      const saved = await res.json()
      setMessages((prev) => [saved.log, ...prev])
      setNewMessage('')
      if (!saved.success && saved.note) {
        alert(saved.note)
      }
    } else {
      alert('Не удалось отправить сообщение')
    }
    setSending(false)
  }

  return (
    <CrmCard className="p-6" hover={false}>
      <h2 className="font-crm-manrope text-base font-semibold text-crm-text-primary mb-4">
        Telegram
      </h2>

      {!chatId && (
        <p className="mb-4 text-sm text-crm-text-muted">
          Укажите Telegram chat ID клиента выше, чтобы отправлять сообщения.
        </p>
      )}

      <form onSubmit={handleSend} className="mb-6 flex gap-3">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={!chatId || sending}
          placeholder="Введите сообщение..."
          className="min-w-0 flex-1 px-3 py-2 bg-crm-bg-primary border border-crm-border rounded-md text-sm text-crm-text-primary placeholder:text-crm-text-muted focus:outline-none focus:border-crm-accent transition-all"
        />
        <CrmButton type="submit" disabled={!chatId || !newMessage.trim() || sending}>
          {sending ? 'Отправка...' : 'Отправить'}
        </CrmButton>
      </form>

      {loading ? (
        <p className="text-sm text-crm-text-muted">Загрузка сообщений...</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-crm-text-muted">Сообщений пока нет</p>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className="rounded-lg bg-crm-bg-tertiary/50 p-3">
              <p className="whitespace-pre-wrap text-sm text-crm-text-primary">{msg.message}</p>
              <p className="mt-2 text-xs text-crm-text-muted">
                {new Date(msg.sentAt).toLocaleString('ru-RU')} · {msg.status === 'sent' ? 'Отправлено' : 'Ошибка'}
              </p>
            </div>
          ))}
        </div>
      )}
    </CrmCard>
  )
}
