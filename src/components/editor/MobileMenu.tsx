'use client'

import { useState } from 'react'
import { useCadStore } from '@/stores/cadStore'

export default function MobileMenu() {
  const [open, setOpen] = useState(false)
  const theme = useCadStore((s) => s.theme)
  const setTheme = useCadStore((s) => s.setTheme)
  const uiScale = useCadStore((s) => s.uiScale)
  const setUiScale = useCadStore((s) => s.setUiScale)
  const compactPanels = useCadStore((s) => s.compactPanels)
  const setCompactPanels = useCadStore((s) => s.setCompactPanels)

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
  }

  const handleCycleUiScale = () => {
    const scales = [1, 1.25, 1.5]
    const idx = scales.indexOf(uiScale)
    const next = scales[(idx + 1) % scales.length]
    setUiScale(next)
    document.documentElement.style.setProperty('--ui-scale', String(next))
  }

  const handleToggleCompact = () => {
    const next = !compactPanels
    setCompactPanels(next)
    document.documentElement.classList.toggle('compact', next)
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setOpen(true)}
        className="absolute left-3 top-3 z-40 rounded-lg border border-gray-200 bg-white p-2 shadow-md dark:border-gray-700 dark:bg-gray-800 md:hidden"
      >
        ☰
      </button>

      {/* Mobile menu overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/35"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute left-1/2 top-1/2 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-4 dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">Меню</span>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleToggleTheme}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-left text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {theme === 'dark' ? '☀ Светлая тема' : '☾ Тёмная тема'}
              </button>
              <button
                onClick={handleCycleUiScale}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-left text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Масштаб UI: {uiScale}×
              </button>
              <button
                onClick={handleToggleCompact}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-left text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {compactPanels ? 'Расширенные панели' : 'Компактные панели'}
              </button>
              <button
                className="w-full rounded-lg border border-orange-500 bg-orange-50 px-4 py-2 text-left text-orange-700 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-300"
              >
                Открыть менеджер проектов
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
