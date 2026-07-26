'use client'

import { useEffect, useState } from 'react'
import { useEditor } from './EditorContext'
import { Plan } from '@core/model/Plan'
import { Storage } from '@core/io/Storage'

export default function SpecPanel() {
  const { engineRef } = useEditor()
  const [plan, setPlan] = useState<Plan | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPlan(engineRef.current?.plan ?? null)
    }, 0)
    return () => clearTimeout(timer)
  }, [engineRef])

  if (!plan) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Нет данных
      </div>
    )
  }

  const walls = plan.walls
  const devices = plan.devices
  const cables = plan.cables
  const rooms = plan.getRooms()

  return (
    <div className="space-y-2 text-sm">
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
        <button
          onClick={() => new Storage().exportSpecToCSV(plan)}
          className="mt-2 w-full rounded border border-orange-500 bg-orange-50 px-2 py-1 text-xs text-orange-700 hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-300"
        >
          Экспорт CSV
        </button>
      </div>
  )
}
