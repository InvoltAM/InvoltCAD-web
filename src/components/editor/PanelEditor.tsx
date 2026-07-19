'use client'

import { useEffect, useMemo, useState } from 'react'
import { useEditor } from './EditorContext'
import { Plan } from '@core/model/Plan'
import { generatePanelDevices, layoutPanel } from '@core/panels/panelModel'

export default function PanelEditor() {
  const { engineRef } = useEditor()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPlan(engineRef.current?.plan ?? null)
    }, 0)
    return () => clearTimeout(timer)
  }, [engineRef])

  const panel = useMemo(() => {
    if (!plan) return null
    // Генерируем устройства щита из количества групп кабелей
    const groupCount = new Set(plan.cables.map((c) => c.type)).size
    const devices = generatePanelDevices(Math.max(groupCount, 3))
    return layoutPanel(devices)
  }, [plan])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute right-[640px] top-3 z-20 rounded-lg border border-gray-200 bg-white p-2 shadow-md dark:border-gray-700 dark:bg-gray-800 md:block"
        title="Визуализация щита"
      >
        🔌
      </button>
    )
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35" onClick={() => setOpen(false)}>
      <div
        className="h-[80vh] w-[90vw] max-w-4xl rounded-lg bg-white p-4 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">Визуализация щита</span>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        <div className="h-[calc(100%-48px)] overflow-auto rounded border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-900">
          {panel ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Использовано модулей: {panel.usedModules} / {panel.totalModules}
              </div>

              {panel.rows.map((rail) => (
                <div key={rail.id} className="space-y-2">
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Рейка {rail.index + 1}
                  </div>
                  <div className="flex gap-1">
                    {rail.devices.map((device) => (
                      <div
                        key={device.id}
                        className={`flex flex-col items-center justify-center rounded border p-2 text-center ${
                          device.type === 'breaker'
                            ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                            : device.type === 'rcd'
                              ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                              : 'border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-700'
                        }`}
                        style={{ width: `${device.width * 40}px` }}
                        title={`${device.name} (${device.rating}А)`}
                      >
                        <div className="text-xs font-medium text-gray-900 dark:text-white">
                          {device.type === 'breaker' ? 'QF' : device.type === 'rcd' ? 'QF+RCD' : device.type === 'busbar' ? 'Шина' : 'T'}
                        </div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-400">
                          {device.rating > 0 ? `${device.rating}A` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
              Нет данных для визуализации щита
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
