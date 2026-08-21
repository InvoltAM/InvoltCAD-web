'use client'

import { useState } from 'react'

export default function CheckRemindersButton() {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/crm/tasks/reminders', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        alert(`Отправлено напоминаний: ${data.sent} из ${data.total}`)
      } else {
        alert(data.error || 'Ошибка проверки напоминаний')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-block rounded-lg border border-orange-300 bg-orange-50 px-6 py-3 text-sm text-orange-700 hover:bg-orange-100 disabled:opacity-50 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300 dark:hover:bg-orange-900/30"
    >
      {loading ? 'Проверка...' : 'Проверить напоминания'}
    </button>
  )
}
