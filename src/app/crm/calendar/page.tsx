'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import CrmPageHeader from '@/components/crm/CrmPageHeader'
import CrmCard from '@/components/crm/CrmCard'
import CrmButton from '@/components/crm/CrmButton'

interface CrmEvent {
  id: string
  title: string
  start: string
  end: string | null
  allDay: boolean
  type: string
  relatedType: string | null
  relatedId: string | null
}

interface RelatedOption {
  id: string
  name: string
  type: 'client' | 'lead' | 'deal'
}

const eventTypeColor = (type: string) => {
  switch (type) {
    case 'call':
      return 'bg-crm-status-paid/20 text-crm-status-paid border-crm-status-paid/30'
    case 'reminder':
      return 'bg-crm-status-partial/20 text-crm-status-partial border-crm-status-partial/30'
    case 'meeting':
    default:
      return 'bg-crm-accent/20 text-crm-accent border-crm-accent/30'
  }
}

export default function CalendarPage() {
  const router = useRouter()
  const [events, setEvents] = useState<CrmEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())

  const [modalOpen, setModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CrmEvent | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const [relatedOptions, setRelatedOptions] = useState<RelatedOption[]>([])
  const [relatedType, setRelatedType] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    const from = new Date(year, month, 1).toISOString().split('T')[0]
    const to = new Date(year, month + 1, 0).toISOString().split('T')[0]

    fetch(`/api/crm/events?from=${from}&to=${to}`)
      .then((res) => {
        if (res.status === 401) {
          router.push('/login?callbackUrl=/crm/calendar')
          return null
        }
        if (!res.ok) throw new Error('Ошибка загрузки событий')
        return res.json()
      })
      .then((data) => {
        if (data) setEvents(data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [year, month, router])

  useEffect(() => {
    Promise.all([
      fetch('/api/crm/clients').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/crm/leads').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/crm/deals').then((r) => (r.ok ? r.json() : [])),
    ]).then(([clients, leads, deals]) => {
      const options: RelatedOption[] = []
      clients.forEach((c: { id: string; name: string }) => options.push({ id: c.id, name: c.name, type: 'client' }))
      leads.forEach((l: { id: string; name: string }) => options.push({ id: l.id, name: l.name, type: 'lead' }))
      deals.forEach((d: { id: string; title: string }) => options.push({ id: d.id, name: d.title, type: 'deal' }))
      setRelatedOptions(options)
    })
  }, [router])

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month])
  const firstDayOfWeek = useMemo(() => {
    const day = new Date(year, month, 1).getDay()
    return day === 0 ? 6 : day - 1 // Пн=0, Вс=6
  }, [year, month])

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CrmEvent[]>()
    events.forEach((event) => {
      const date = new Date(event.start)
      const day = date.getDate()
      if (date.getFullYear() === year && date.getMonth() === month) {
        if (!map.has(day)) map.set(day, [])
        map.get(day)!.push(event)
      }
    })
    return map
  }, [events, year, month])

  const openNewModal = (date?: Date) => {
    setEditingEvent(null)
    setSelectedDate(date ?? new Date())
    setRelatedType('')
    setFormError(null)
    setModalOpen(true)
  }

  const openEditModal = (event: CrmEvent) => {
    setEditingEvent(event)
    setSelectedDate(new Date(event.start))
    setRelatedType(event.relatedType ?? '')
    setFormError(null)
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить событие?')) return
    const res = await fetch(`/api/crm/events/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setEvents((prev) => prev.filter((e) => e.id !== id))
      setModalOpen(false)
    } else {
      alert('Не удалось удалить событие')
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    const form = e.currentTarget
    const formData = new FormData(form)
    const date = formData.get('date') as string
    const time = (formData.get('time') as string) || '00:00'
    const endTime = formData.get('endTime') as string
    const start = new Date(`${date}T${time}`).toISOString()
    const end = endTime ? new Date(`${date}T${endTime}`).toISOString() : null

    const body = {
      title: formData.get('title') as string,
      start,
      end,
      allDay: formData.get('allDay') === 'on',
      type: formData.get('type') as string,
      relatedType: (formData.get('relatedType') as string) || null,
      relatedId: (formData.get('relatedId') as string) || null,
    }

    const url = editingEvent ? `/api/crm/events/${editingEvent.id}` : '/api/crm/events'
    const method = editingEvent ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const saved = await res.json()
      setEvents((prev) => {
        if (editingEvent) {
          return prev.map((e) => (e.id === saved.id ? saved : e))
        }
        return [...prev, saved]
      })
      setModalOpen(false)
    } else {
      const data = await res.json().catch(() => ({}))
      setFormError(data.error || 'Ошибка сохранения события')
    }
    setSaving(false)
  }

  const filteredOptions = relatedOptions.filter((o) => o.type === relatedType)

  const monthName = currentDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-crm-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) return <div className="p-8 text-crm-status-unpaid">{error}</div>

  const inputClass =
    'w-full px-3 py-2 bg-crm-bg-primary border border-crm-border rounded-md text-sm text-crm-text-primary placeholder:text-crm-text-muted focus:outline-none focus:border-crm-accent focus:ring-[3px] focus:ring-crm-accent/15 transition-all'

  return (
    <div className="space-y-6">
      <CrmPageHeader title="Календарь" subtitle="События и встречи">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-crm-border bg-crm-bg-secondary overflow-hidden">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="px-3 py-2 text-crm-text-secondary hover:text-crm-text-primary hover:bg-crm-bg-tertiary transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-[140px] px-3 py-2 text-center text-sm font-medium capitalize text-crm-text-primary">
              {monthName}
            </span>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="px-3 py-2 text-crm-text-secondary hover:text-crm-text-primary hover:bg-crm-bg-tertiary transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <CrmButton onClick={() => openNewModal()} icon={<Plus size={18} />}>Событие</CrmButton>
        </div>
      </CrmPageHeader>

      <CrmCard className="p-0 overflow-hidden" hover={false}>
        <div className="grid grid-cols-7 border-b border-crm-border bg-crm-bg-tertiary">
          {weekDays.map((d) => (
            <div key={d} className="px-2 py-3 text-center text-xs font-semibold text-crm-text-muted uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[110px] border-b border-r border-crm-border/50" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, dayIndex) => {
            const day = dayIndex + 1
            const dayEvents = eventsByDay.get(day) ?? []
            const isToday =
              new Date().getDate() === day &&
              new Date().getMonth() === month &&
              new Date().getFullYear() === year

            return (
              <div
                key={day}
                onClick={() => openNewModal(new Date(year, month, day))}
                className="min-h-[110px] cursor-pointer border-b border-r border-crm-border/50 p-2 hover:bg-crm-bg-tertiary/30 transition-colors"
              >
                <div
                  className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday ? 'bg-crm-accent text-white' : 'text-crm-text-secondary'
                  }`}
                >
                  {day}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditModal(event)
                      }}
                      className={`truncate rounded px-1.5 py-0.5 text-xs border ${eventTypeColor(event.type)}`}
                    >
                      {formatTime(event.start)} {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-crm-text-muted">+{dayEvents.length - 3}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CrmCard>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(7, 10, 18, 0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => setModalOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-xl bg-crm-bg-elevated border border-crm-border p-6 shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 font-crm-manrope text-xl font-semibold text-crm-text-primary">
              {editingEvent ? 'Редактирование события' : 'Новое событие'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-lg bg-crm-status-unpaid/10 p-3 text-sm text-crm-status-unpaid border border-crm-status-unpaid/30">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">
                  Название <span className="text-crm-status-unpaid">*</span>
                </label>
                <input name="title" required defaultValue={editingEvent?.title ?? ''} className={inputClass} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">Дата</label>
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={
                      selectedDate
                        ? new Date(selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000)
                            .toISOString()
                            .split('T')[0]
                        : ''
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">Тип</label>
                  <select name="type" defaultValue={editingEvent?.type ?? 'meeting'} className={inputClass}>
                    <option value="meeting">Встреча</option>
                    <option value="call">Звонок</option>
                    <option value="reminder">Напоминание</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">Начало</label>
                  <input
                    name="time"
                    type="time"
                    defaultValue={editingEvent ? formatTimeInput(editingEvent.start) : '09:00'}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">Окончание</label>
                  <input
                    name="endTime"
                    type="time"
                    defaultValue={editingEvent?.end ? formatTimeInput(editingEvent.end) : ''}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  name="allDay"
                  type="checkbox"
                  defaultChecked={editingEvent?.allDay ?? false}
                  className="h-4 w-4 rounded border-crm-border bg-crm-bg-primary text-crm-accent focus:ring-crm-accent"
                />
                <label className="text-sm text-crm-text-secondary">Весь день</label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">Тип связи</label>
                  <select
                    name="relatedType"
                    value={relatedType}
                    onChange={(e) => setRelatedType(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— Нет связи —</option>
                    <option value="client">Клиент</option>
                    <option value="lead">Лид</option>
                    <option value="deal">Сделка</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-crm-text-secondary mb-1.5">Связанный объект</label>
                  <select
                    name="relatedId"
                    defaultValue={editingEvent?.relatedId ?? ''}
                    disabled={!relatedType}
                    className={inputClass}
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

              <div className="flex justify-end gap-3 pt-2">
                {editingEvent && (
                  <CrmButton
                    type="button"
                    variant="danger"
                    onClick={() => handleDelete(editingEvent.id)}
                    className="mr-auto"
                  >
                    Удалить
                  </CrmButton>
                )}
                <CrmButton type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                  Отмена
                </CrmButton>
                <CrmButton type="submit" disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </CrmButton>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function formatTimeInput(iso: string) {
  const d = new Date(iso)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}
