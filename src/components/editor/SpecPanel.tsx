'use client'

import { useCadStore } from '@/stores/cadStore'

export default function SpecPanel() {
  const { engineRef } = useEditorSafe()
  const plan = engineRef.current?.plan

  if (!plan) {
    return (
      <div className="absolute right-[390px] top-3 z-20 hidden w-48 rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800 md:block">
        <div className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
          Спецификация
        </div>
        <div className="p-3 text-sm text-gray-500 dark:text-gray-400">
          Нет данных
        </div>
      </div>
    )
  }

  const walls = plan.walls
  const devices = plan.devices
  const cables = plan.cables
  const rooms = plan.getRooms()

  return (
    <div className="absolute right-[390px] top-3 z-20 hidden w-48 rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800 md:block">
      <div className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
        Спецификация
      </div>
      <div className="p-3 text-sm">
        {walls.length > 0 && (
          <div className="mb-2">
            <div className="font-medium text-gray-900 dark:text-white">Стены</div>
            <div className="text-gray-600 dark:text-gray-400">{walls.length} шт</div>
          </div>
        )}
        {devices.length > 0 && (
          <div className="mb-2">
            <div className="font-medium text-gray-900 dark:text-white">Оборудование</div>
            <div className="text-gray-600 dark:text-gray-400">{devices.length} шт</div>
          </div>
        )}
        {cables.length > 0 && (
          <div className="mb-2">
            <div className="font-medium text-gray-900 dark:text-white">Кабели</div>
            <div className="text-gray-600 dark:text-gray-400">
              {(cables.reduce((sum, c) => sum + c.length, 0) / 1000).toFixed(2)} м
            </div>
          </div>
        )}
        {rooms.length > 0 && (
          <div className="mb-2">
            <div className="font-medium text-gray-900 dark:text-white">Комнаты</div>
            <div className="text-gray-600 dark:text-gray-400">
              {(rooms.reduce((sum, r) => sum + r.area, 0) / 1_000_000).toFixed(2)} м²
            </div>
          </div>
        )}
        <button className="mt-2 w-full rounded border border-orange-500 bg-orange-50 px-2 py-1 text-xs text-orange-700 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-300">
          Экспорт CSV
        </button>
      </div>
    </div>
  )
}

// Вспомогательный хук для безопасного доступа к editor
import { useEditor } from './EditorContext'

function useEditorSafe() {
  try {
    return useEditor()
  } catch {
    return { engineRef: { current: null }, themeManagerRef: { current: null } }
  }
}
