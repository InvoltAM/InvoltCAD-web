'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Plus } from 'lucide-react'
import CrmPageHeader from '@/components/crm/CrmPageHeader'
import CrmCard from '@/components/crm/CrmCard'
import CrmButton from '@/components/crm/CrmButton'
import CrmEmptyState from '@/components/crm/CrmEmptyState'

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

  const inputClass =
    'w-full px-3 py-2 bg-crm-bg-primary border border-crm-border rounded-md text-sm text-crm-text-primary placeholder:text-crm-text-muted focus:outline-none focus:border-crm-accent focus:ring-[3px] focus:ring-crm-accent/15 transition-all'

  return (
    <div className="space-y-6">
      <CrmPageHeader title="Массовая email-рассылка" subtitle="Отправка писем клиентам" />

      <CrmCard className="p-6" hover={false}>
        <form onSubmit={handleSend} className="space-y-4">
          {templates.length > 0 && (
            <select
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className={inputClass}
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
            className={inputClass}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Текст письма (HTML)"
            rows={6}
            required
            className={`${inputClass} resize-none`}
          />
          <CrmButton type="submit" disabled={selected.size === 0 || sending}>
            {sending ? 'Отправка...' : `Отправить (${selected.size})`}
          </CrmButton>
        </form>
      </CrmCard>

      <CrmCard className="p-5" hover={false}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-crm-manrope text-base font-semibold text-crm-text-primary">Получатели</h2>
          <button
            onClick={toggleAll}
            className="text-sm text-crm-accent hover:text-crm-accent-light transition-colors"
          >
            {selected.size === recipients.length ? 'Снять все' : 'Выбрать все'}
          </button>
        </div>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {recipients.length === 0 ? (
            <CrmEmptyState
              title="Нет получателей с email"
              description="Добавьте email клиентам или лидам"
              icon={<Mail size={48} className="text-crm-text-muted" />}
            />
          ) : (
            recipients.map((r) => (
              <label
                key={r.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-crm-border p-3 hover:bg-crm-bg-tertiary/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  className="h-4 w-4 cursor-pointer rounded border-crm-border bg-crm-bg-primary text-crm-accent focus:ring-crm-accent"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-crm-text-primary">{r.name}</p>
                  <p className="text-xs text-crm-text-muted">
                    {r.email} · {r.type === 'client' ? 'Клиент' : 'Лид'}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>
      </CrmCard>
    </div>
  )
}
