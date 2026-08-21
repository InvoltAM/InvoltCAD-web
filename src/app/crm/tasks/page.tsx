'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import CrmPageHeader from '@/components/crm/CrmPageHeader'
import CrmTable from '@/components/crm/CrmTable'
import CrmEmptyState from '@/components/crm/CrmEmptyState'
import CrmButton from '@/components/crm/CrmButton'
import CrmStatusBadge from '@/components/crm/CrmStatusBadge'

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

const statusLabels: Record<string, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  done: 'Выполнена',
}

const priorityLabels: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
}

const relatedLabels: Record<string, string> = {
  client: 'Клиент',
  lead: 'Лид',
  deal: 'Сделка',
  event: 'Событие',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<CrmTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/crm/tasks')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login?callbackUrl=/crm/tasks')
          return null
        }
        if (!res.ok) throw new Error('Ошибка загрузки задач')
        return res.json()
      })
      .then((data) => {
        if (data) setTasks(data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [router])

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Удалить задачу «${title}»?`)) return
    const res = await fetch(`/api/crm/tasks/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== id))
    } else {
      alert('Не удалось удалить задачу')
    }
  }

  const handleStatusChange = async (id: string, status: string) => {
    const nextStatus = status === 'done' ? 'todo' : 'done'
    const res = await fetch(`/api/crm/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)))
    }
  }

  return (
    <div className="space-y-6">
      <CrmPageHeader title="Задачи" count={tasks.length} subtitle="Управление задачами">
        <Link href="/crm/tasks/new">
          <CrmButton icon={<Plus size={18} />}>Добавить задачу</CrmButton>
        </Link>
      </CrmPageHeader>

      {error && <div className="text-crm-status-unpaid text-center py-8">{error}</div>}

      <CrmTable
        loading={loading}
        data={tasks}
        onRowClick={(task) => router.push(`/crm/tasks/${task.id}`)}
        empty={
          <CrmEmptyState
            title="Задач пока нет"
            description="Добавьте первую задачу, чтобы не забыть важные дела"
            action={
              <Link href="/crm/tasks/new">
                <CrmButton icon={<Plus size={18} />}>Добавить задачу</CrmButton>
              </Link>
            }
          />
        }
        columns={[
          {
            key: 'checkbox',
            title: '',
            width: '50px',
            render: (task) => (
              <input
                type="checkbox"
                checked={task.status === 'done'}
                onChange={() => handleStatusChange(task.id, task.status)}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 cursor-pointer rounded border-crm-border bg-crm-bg-primary text-crm-accent focus:ring-crm-accent"
              />
            ),
          },
          {
            key: 'title',
            title: 'Задача',
            render: (task) => (
              <div>
                <p className={`text-[14px] font-medium ${task.status === 'done' ? 'text-crm-text-muted line-through' : 'text-crm-text-primary'}`}>
                  {task.title}
                </p>
                {task.description && <p className="text-[12px] text-crm-text-secondary line-clamp-1">{task.description}</p>}
              </div>
            ),
          },
          {
            key: 'status',
            title: 'Статус',
            render: (task) => <CrmStatusBadge status={task.status} label={statusLabels[task.status] ?? task.status} />,
          },
          {
            key: 'priority',
            title: 'Приоритет',
            render: (task) => <span className="text-crm-text-secondary">{priorityLabels[task.priority] ?? task.priority}</span>,
          },
          {
            key: 'dueDate',
            title: 'Срок',
            render: (task) => (
              <span className="text-crm-text-secondary">
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ru-RU') : '—'}
              </span>
            ),
          },
          {
            key: 'related',
            title: 'Связь',
            render: (task) => <span className="text-crm-text-secondary">{task.relatedType ? relatedLabels[task.relatedType] ?? task.relatedType : '—'}</span>,
          },
          {
            key: 'actions',
            title: '',
            width: '80px',
            render: (task) => (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(task.id, task.title)
                }}
                className="text-crm-status-unpaid hover:text-red-400 text-sm"
              >
                Удалить
              </button>
            ),
          },
        ]}
      />
    </div>
  )
}
