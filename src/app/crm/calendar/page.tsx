'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

  if (loading) return <div className="p-8">Загрузка...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Календарь
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/crm"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Назад в CRM
            </Link>
            <div className="flex items-center rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="px-3 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                ←
              </button>
              <span className="min-w-[140px] px-3 py-2 text-center text-sm font-medium capitalize text-gray-900 dark:text-white">
                {monthName}
              </span>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="px-3 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                →
              </button>
            </div>
            <button
              onClick={() => openNewModal()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
            >
              + Событие
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-700">
            {weekDays.map((d) => (
              <div key={d} className="px-2 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-gray-100 dark:border-gray-700/50" />
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
                  className="min-h-[100px] cursor-pointer border-b border-r border-gray-100 p-2 hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-700/30"
                >
                  <div
                    className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      isToday
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-700 dark:text-gray-300'
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
                        className={`truncate rounded px-1.5 py-0.5 text-xs ${eventTypeColor(event.type)}`}
                      >
                        {formatTime(event.start)} {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        +{dayEvents.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
              {editingEvent ? 'Редактирование события' : 'Новое событие'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {formError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Название <span className="text-red-500">*</span>
                </label>
                <input
                  name="title"
                  required
                  defaultValue={editingEvent?.title ?? ''}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Дата
                  </label>
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Тип
                  </label>
                  <select
                    name="type"
                    defaultValue={editingEvent?.type ?? 'meeting'}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="meeting">Встреча</option>
                    <option value="call">Звонок</option>
                    <option value="reminder">Напоминание</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Начало
                  </label>
                  <input
                    name="time"
                    type="time"
                    defaultValue={editingEvent ? formatTimeInput(editingEvent.start) : '09:00'}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Окончание
                  </label>
                  <input
                    name="endTime"
                    type="time"
                    defaultValue={editingEvent?.end ? formatTimeInput(editingEvent.end) : ''}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  name="allDay"
                  type="checkbox"
                  defaultChecked={editingEvent?.allDay ?? false}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">Весь день</label>
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                    defaultValue={editingEvent?.relatedId ?? ''}
                    disabled={!relatedType}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                  <button
                    type="button"
                    onClick={() => handleDelete(editingEvent.id)}
                    className="mr-auto rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
                  >
                    Удалить
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function eventTypeColor(type: string) {
  switch (type) {
    case 'call':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'reminder':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'meeting':
    default:
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
  }
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
