'use client'

import { useEffect, useMemo, useState } from 'react'
import { useEditor } from './EditorContext'
import { Plan } from '@core/model/Plan'
import { blocksToConsumers, LoadGroup, PanelLoad } from '@core/calculations/loadCalculation'

export default function CableJournalPanel() {
  const { engineRef } = useEditor()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [activeTab, setActiveTab] = useState<'cables' | 'loads'>('cables')

  useEffect(() => {
    const timer = setTimeout(() => {
      setPlan(engineRef.current?.plan ?? null)
    }, 0)
    return () => clearTimeout(timer)
  }, [engineRef])

  const { groups, panelLoad } = useMemo(() => {
    if (!plan) {
      return { groups: [], panelLoad: null }
    }

    // Конвертируем устройства плана в потребители
    const blocks = plan.devices.map((d) => ({
      id: d.id,
      definitionId: d.type,
      properties: {},
    }))
    const cons = blocksToConsumers(blocks, 'residential')

    // Группируем по типам
    const socketConsumers = cons.filter((c) => c.type === 'socket')
    const lightConsumers = cons.filter((c) => c.type === 'light')
    const powerConsumers = cons.filter((c) => !['socket', 'light'].includes(c.type))

    const groups: LoadGroup[] = []

    if (socketConsumers.length > 0) {
      const totalInstalled = socketConsumers.reduce((sum, c) => sum + c.installedPowerKw * c.quantity, 0)
      const demandFactor = 0.4
      const simultaneityFactor = socketConsumers.length <= 5 ? 1.0 : socketConsumers.length <= 10 ? 0.8 : socketConsumers.length <= 20 ? 0.7 : 0.6
      const designPower = totalInstalled * demandFactor * simultaneityFactor
      const designCurrent = (designPower * 1000) / 220
      groups.push({
        id: 'sockets',
        name: 'Розеточные группы',
        type: 'socket',
        consumers: socketConsumers,
        demandFactor,
        simultaneityFactor,
        totalInstalledPower: totalInstalled,
        designPower,
        designCurrent,
        peakCurrent: designCurrent * 1.5,
        voltageV: 220,
        phaseCount: 1,
      })
    }

    if (lightConsumers.length > 0) {
      const totalInstalled = lightConsumers.reduce((sum, c) => sum + c.installedPowerKw * c.quantity, 0)
      const demandFactor = 0.7
      const simultaneityFactor = lightConsumers.length <= 10 ? 1.0 : lightConsumers.length <= 20 ? 0.9 : 0.8
      const designPower = totalInstalled * demandFactor * simultaneityFactor
      const designCurrent = (designPower * 1000) / 220
      groups.push({
        id: 'lighting',
        name: 'Освещение',
        type: 'light',
        consumers: lightConsumers,
        demandFactor,
        simultaneityFactor,
        totalInstalledPower: totalInstalled,
        designPower,
        designCurrent,
        peakCurrent: designCurrent * 1.5,
        voltageV: 220,
        phaseCount: 1,
      })
    }

    if (powerConsumers.length > 0) {
      const totalInstalled = powerConsumers.reduce((sum, c) => sum + c.installedPowerKw * c.quantity, 0)
      const demandFactor = 0.6
      const simultaneityFactor = powerConsumers.length <= 3 ? 1.0 : powerConsumers.length <= 6 ? 0.85 : 0.75
      const designPower = totalInstalled * demandFactor * simultaneityFactor
      const designCurrent = (designPower * 1000) / 220
      groups.push({
        id: 'power',
        name: 'Силовое оборудование',
        type: 'power',
        consumers: powerConsumers,
        demandFactor,
        simultaneityFactor,
        totalInstalledPower: totalInstalled,
        designPower,
        designCurrent,
        peakCurrent: designCurrent * 1.5,
        voltageV: 220,
        phaseCount: 1,
      })
    }

    // Общая нагрузка щита
    const totalInstalled = groups.reduce((sum, g) => sum + g.totalInstalledPower, 0)
    const totalDesign = groups.reduce((sum, g) => sum + g.designPower, 0)
    const totalCurrent = (totalDesign * 1000) / 220
    const panelLoad: PanelLoad = {
      panelId: 'main',
      groups,
      totalInstalledPower: totalInstalled,
      totalDesignPower: totalDesign,
      totalDesignCurrent: totalCurrent,
      inputCurrent: totalCurrent,
      demandFactor: 0.6,
    }

    return { groups, panelLoad }
  }, [plan])

  if (!plan) {
    return (
      <div className="absolute right-[390px] top-3 z-20 hidden w-64 rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800 md:block">
        <div className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
          Кабельный журнал
        </div>
        <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Нет данных</div>
      </div>
    )
  }

  return (
    <div className="absolute right-[390px] top-3 z-20 hidden w-64 rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800 md:block">
      <div className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
        Кабельный журнал
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('cables')}
          className={`flex-1 px-3 py-2 text-sm ${
            activeTab === 'cables'
              ? 'border-b-2 border-orange-500 text-orange-600 dark:text-orange-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Кабели
        </button>
        <button
          onClick={() => setActiveTab('loads')}
          className={`flex-1 px-3 py-2 text-sm ${
            activeTab === 'loads'
              ? 'border-b-2 border-orange-500 text-orange-600 dark:text-orange-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Нагрузки
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto p-3">
        {activeTab === 'cables' && (
          <div className="space-y-2">
            {plan.cables.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Нет кабелей</div>
            ) : (
              plan.cables.map((cable) => (
                <div key={cable.id} className="rounded border border-gray-200 p-2 text-sm dark:border-gray-600">
                  <div className="font-medium text-gray-900 dark:text-white">{cable.type}</div>
                  <div className="text-gray-600 dark:text-gray-400">
                    {cable.crossSection} мм², {(cable.length / 1000).toFixed(2)} м
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {cable.fromDeviceId} → {cable.toDeviceId}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'loads' && (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.id} className="rounded border border-gray-200 p-2 dark:border-gray-600">
                <div className="mb-1 font-medium text-gray-900 dark:text-white">{group.name}</div>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <div>Установленная: {group.totalInstalledPower.toFixed(2)} кВт</div>
                  <div>Кс: {group.demandFactor}, Ко: {group.simultaneityFactor}</div>
                  <div>Расчётная: {group.designPower.toFixed(2)} кВт</div>
                  <div>Ток: {group.designCurrent.toFixed(1)} А</div>
                </div>
              </div>
            ))}

            {panelLoad && (
              <div className="rounded border-2 border-orange-500 bg-orange-50 p-2 dark:bg-orange-900/20">
                <div className="mb-1 font-bold text-gray-900 dark:text-white">Ввод в щит</div>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <div>Установленная: {panelLoad.totalInstalledPower.toFixed(2)} кВт</div>
                  <div>Расчётная: {panelLoad.totalDesignPower.toFixed(2)} кВт</div>
                  <div>Ток ввода: {panelLoad.inputCurrent.toFixed(1)} А</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
