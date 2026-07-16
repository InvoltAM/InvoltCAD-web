'use client'

import { useState } from 'react'

export default function ProjectsPanel() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Projects button */}
      <button
        onClick={() => setOpen(true)}
        className="absolute left-20 top-3 z-40 rounded-lg border border-gray-200 bg-white p-2 shadow-md dark:border-gray-700 dark:bg-gray-800 md:left-3"
        title="Проекты"
      >
        📁
      </button>

      {/* Projects panel overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/35"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute left-1/2 top-1/2 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-4 dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">Проекты</span>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ×
              </button>
            </div>

            <div className="mb-4 flex gap-2">
              <button className="flex-1 rounded-lg border border-orange-500 bg-orange-50 px-3 py-2 text-sm text-orange-700 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-300">
                ＋ Новый проект
              </button>
              <button className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                📂 Импорт JSON
              </button>
            </div>

            <input
              type="text"
              placeholder="Поиск проектов..."
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />

            <div className="max-h-64 space-y-2 overflow-y-auto">
              <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                Нет проектов (облачная синхронизация в разработке)
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
