/* eslint-disable react-hooks/immutability -- редактор работает через мутации плана по дизайну */
'use client'

import { useEffect, useState } from 'react'
import { useEditor } from './EditorContext'
import { useCadStore } from '@/stores/cadStore'
import { Plan } from '@core/model/Plan'
import { DistributionBoardData } from '@core/electrical/BoardEngine'

export default function BasketPanel() {
  const { engineRef } = useEditor()
  const [plan, setPlan] = useState<Plan | null>(null)
  const open = useCadStore((s) => s.basketOpen)
  const setOpen = useCadStore((s) => s.setBasketOpen)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPlan(engineRef.current?.plan ?? null)
    }, 0)
    return () => clearTimeout(timer)
  }, [engineRef])

  const board = (plan?.electrical.distributionBoards?.[0] as DistributionBoardData | undefined) || null
  const components = board?.components ?? []

  if (!open) return null

  return (
    <div
      className="fixed inset-y-0 left-0 z-[300] w-72 bg-white shadow-2xl dark:bg-gray-800"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-600">
          <span className="text-base font-semibold text-gray-900 dark:text-white">Корзина</span>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {components.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Нет элементов. Соберите щит из однолинейной схемы (ОЛС → Автособрать щит).
            </div>
          ) : (
            <div className="space-y-2">
              {components.map((comp) => (
                <div
                  key={comp.id}
                  className="rounded border border-gray-200 bg-gray-50 p-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                >
                  <div className="font-medium text-gray-900 dark:text-white">{comp.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {comp.type === 'input-breaker'
                      ? 'Вводной автомат'
                      : comp.type === 'breaker'
                        ? 'Автомат'
                        : comp.type === 'rcd'
                          ? 'УЗО'
                          : comp.type === 'bus'
                            ? 'Шина'
                            : comp.type}{' '}
                    · {comp.widthModules} модуля
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-2 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400">
                Всего: {components.reduce((s, c) => s + c.widthModules, 0)} модулей
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
