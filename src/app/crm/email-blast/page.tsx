'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Recipient {
  id: string
  type: 'client' | 'lead'
  name: string
  email: string | null
}

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
}

export default function EmailBlastPage() {
  const router = useRouter()
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/crm/clients').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/crm/leads').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/crm/email-templates').then((r) => (r.ok ? r.json() : [])),
    ]).then(([clients, leads, tpls]) => {
      const list: Recipient[] = [
        ...(clients ?? []).map((c: { id: string; name: string; email: string | null }) => ({ ...c, type: 'client' as const })),
        ...(leads ?? []).map((l: { id: string; name: string; email: string | null }) => ({ ...l, type: 'lead' as const })),
      ].filter((r) => r.email)
      setRecipients(list)
      setTemplates(tpls ?? [])
    })
  }, [router])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === recipients.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(recipients.map((r) => r.id)))
    }
  }

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id)
    if (t) {
      setSubject(t.subject)
      setBody(t.body)
      setTemplateId(id)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selected.size === 0 || !subject.trim() || !body.trim()) return
    setSending(true)

    const payload = Array.from(selected).map((id) => {
      const r = recipients.find((x) => x.id === id)!
      return {
        to: r.email!,
        clientId: r.type === 'client' ? r.id : null,
        leadId: r.type === 'lead' ? r.id : null,
      }
    })

    const res = await fetch('/api/crm/emails/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients: payload, subject, html: body }),
    })

    if (res.ok) {
      const data = await res.json()
      alert(data.note || `Отправлено ${data.sentCount}, ошибок ${data.failedCount}`)
      setSelected(new Set())
    } else {
      alert('Ошибка массовой рассылки')
    }
    setSending(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Массовая email-рассылка</h1>
          <Link
            href="/crm"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Назад
          </Link>
        </div>

        <form
          onSubmit={handleSend}
          className="mb-8 space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          {templates.length > 0 && (
            <select
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">— Выберите шаблон —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Тема"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Текст письма (HTML)"
            rows={6}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <button
            type="submit"
            disabled={selected.size === 0 || sending}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {sending ? 'Отправка...' : `Отправить (${selected.size})`}
          </button>
        </form>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Получатели</h2>
            <button
              onClick={toggleAll}
              className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400"
            >
              {selected.size === recipients.length ? 'Снять все' : 'Выбрать все'}
            </button>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {recipients.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">Нет получателей с email</p>
            ) : (
              recipients.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-100 p-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{r.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {r.email} · {r.type === 'client' ? 'Клиент' : 'Лид'}
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
