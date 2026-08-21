'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

  if (loading) return <div className="p-8">Загрузка...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Задачи
          </h1>
          <div className="flex gap-3">
            <Link
              href="/crm"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Назад в CRM
            </Link>
            <Link
              href="/crm/tasks/new"
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700"
            >
              + Добавить задачу
            </Link>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-gray-600 dark:text-gray-400">Задач пока нет</p>
            <Link
              href="/crm/tasks/new"
              className="mt-4 inline-block rounded-lg bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700"
            >
              Добавить первую задачу
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300"></th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Задача
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Статус
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Приоритет
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Срок
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">
                    Связь
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    onClick={() => router.push(`/crm/tasks/${task.id}`)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={task.status === 'done'}
                        onChange={() => handleStatusChange(task.id, task.status)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 cursor-pointer rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {task.title}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {task.dueDate
                        ? new Date(task.dueDate).toLocaleDateString('ru-RU')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {task.relatedType ? formatRelatedType(task.relatedType) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(task.id, task.title)
                        }}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function formatRelatedType(type: string) {
  const labels: Record<string, string> = {
    client: 'Клиент',
    lead: 'Лид',
    deal: 'Сделка',
    event: 'Событие',
  }
  return labels[type] ?? type
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    todo: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    done: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  }
  const labels: Record<string, string> = {
    todo: 'К выполнению',
    in_progress: 'В работе',
    done: 'Выполнена',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${colors[status] ?? colors.todo}`}
    >
      {labels[status] ?? status}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }
  const labels: Record<string, string> = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${colors[priority] ?? colors.medium}`}
    >
      {labels[priority] ?? priority}
    </span>
  )
}
