'use client'

import { useCallback, useEffect, useState } from 'react'

interface Member {
  id: string
  role: string
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface ShareDialogProps {
  projectId: string
  projectName: string
  onClose: () => void
}

export default function ShareDialog({ projectId, projectName, onClose }: ShareDialogProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [owner, setOwner] = useState<Member['user'] | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer')
  const [loading, setLoading] = useState(false)

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members)
        setOwner(data.owner)
      }
    } catch (error) {
      console.error('Ошибка загрузки участников:', error)
    }
  }, [projectId])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadMembers()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadMembers])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      })

      if (res.ok) {
        setEmail('')
        await loadMembers()
      } else {
        const data = await res.json()
        alert(data.error ?? 'Ошибка приглашения')
      }
    } catch {
      alert('Ошибка сети')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (userId: string) => {
    if (!confirm('Удалить участника?')) return

    try {
      const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await loadMembers()
      } else {
        const data = await res.json()
        alert(data.error ?? 'Ошибка удаления')
      }
    } catch {
      alert('Ошибка сети')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/35" onClick={onClose}>
      <div
        className="absolute left-1/2 top-1/2 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-4 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            Поделиться проектом
          </span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Проект: <strong>{projectName}</strong>
        </p>

        <form onSubmit={handleInvite} className="mb-4">
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Email пользователя"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="viewer">Просмотр</option>
              <option value="editor">Редактирование</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '...' : 'Пригласить'}
            </button>
          </div>
        </form>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {owner && (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-600">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {owner.name ?? owner.email}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Владелец</div>
              </div>
            </div>
          )}
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-600"
            >
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {member.user.name ?? member.user.email}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {member.role === 'editor' ? 'Редактирование' : 'Просмотр'}
                </div>
              </div>
              <button
                onClick={() => handleRemove(member.user.id)}
                className="rounded border border-gray-200 p-1 text-sm text-red-600 hover:bg-red-50 dark:border-gray-600 dark:hover:bg-red-900/20"
                title="Удалить"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
