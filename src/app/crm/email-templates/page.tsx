'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Trash2, Pencil } from 'lucide-react'
import CrmPageHeader from '@/components/crm/CrmPageHeader'
import CrmCard from '@/components/crm/CrmCard'
import CrmButton from '@/components/crm/CrmButton'
import CrmEmptyState from '@/components/crm/CrmEmptyState'

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

  const inputClass =
    'w-full px-3 py-2 bg-crm-bg-primary border border-crm-border rounded-md text-sm text-crm-text-primary placeholder:text-crm-text-muted focus:outline-none focus:border-crm-accent focus:ring-[3px] focus:ring-crm-accent/15 transition-all'

  return (
    <div className="space-y-6">
      <CrmPageHeader title="Шаблоны email" subtitle="Управление шаблонами писем" />

      <CrmCard className="p-6" hover={false}>
        <form onSubmit={handleSave} className="space-y-4">
          <h2 className="font-crm-manrope text-base font-semibold text-crm-text-primary mb-2">
            {editing ? 'Редактирование шаблона' : 'Новый шаблон'}
          </h2>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Название шаблона"
            required
            className={inputClass}
          />
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Тема письма"
            required
            className={inputClass}
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Текст письма (HTML)"
            rows={6}
            required
            className={`${inputClass} resize-none`}
          />
          <div className="flex justify-end gap-3">
            {editing && (
              <CrmButton type="button" variant="ghost" onClick={resetForm}>
                Отмена
              </CrmButton>
            )}
            <CrmButton type="submit">{editing ? 'Сохранить' : 'Создать'}</CrmButton>
          </div>
        </form>
      </CrmCard>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-crm-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <CrmEmptyState
          title="Шаблонов пока нет"
          description="Создайте первый шаблон email"
          icon={<FileText size={48} className="text-crm-text-muted" />}
        />
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <CrmCard key={t.id} className="p-4" hover={false}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-crm-text-primary">{t.name}</p>
                  <p className="text-sm text-crm-text-secondary">{t.subject}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(t)}
                    className="inline-flex items-center gap-1 rounded-lg border border-crm-border px-3 py-1.5 text-sm text-crm-text-secondary hover:text-crm-text-primary hover:border-crm-border-hover transition-colors"
                  >
                    <Pencil size={14} /> Редактировать
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-crm-status-unpaid/30 px-3 py-1.5 text-sm text-crm-status-unpaid hover:bg-crm-status-unpaid/10 transition-colors"
                  >
                    <Trash2 size={14} /> Удалить
                  </button>
                </div>
              </div>
            </CrmCard>
          ))}
        </div>
      )}
    </div>
  )
}
