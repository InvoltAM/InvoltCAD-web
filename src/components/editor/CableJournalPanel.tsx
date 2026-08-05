'use client'

import { useEffect, useMemo, useState } from 'react'
import { useEditor } from './EditorContext'
import { Plan } from '@core/model/Plan'
import { CableRunData, buildCableRuns, buildCableSpecification, CableSpecificationItem } from '@core/electrical/CableRunEngine'
import { blocksToConsumers, LoadGroup, PanelLoad } from '@core/calculations/loadCalculation'

type TabKey = 'cables' | 'loads' | 'spec'

export default function CableJournalPanel() {
  const { engineRef } = useEditor()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('cables')

  useEffect(() => {
    const timer = setTimeout(() => {
      setPlan(engineRef.current?.plan ?? null)
    }, 0)
    return () => clearTimeout(timer)
  }, [engineRef])

  const refresh = () => {
    setPlan(engineRef.current?.plan ?? null)
  }

  const recalc = () => {
    const p = engineRef.current?.plan
    if (!p) return
    p.recalcCableRoutes()
    p.electrical.cableRuns = buildCableRuns(p.cables, p.electrical.circuits ?? [])
    engineRef.current?.notifyChanged()
    engineRef.current?.requestRender()
    refresh()
  }

  const runs = useMemo(() => {
    if (!plan) return []
    plan.recalcCableRoutes()
    plan.electrical.cableRuns = buildCableRuns(plan.cables, plan.electrical.circuits ?? [])
    return plan.electrical.cableRuns
  }, [plan])

  const spec = useMemo(() => buildCableSpecification(runs), [runs])

  const { groups, panelLoad } = useMemo(() => {
    if (!plan) {
      return { groups: [], panelLoad: null }
    }

    const blocks = plan.devices.map((d) => ({
      id: d.id,
      definitionId: d.type,
      properties: {},
    }))
    const cons = blocksToConsumers(blocks, 'residential')

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
      <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
        Нет данных
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-200 px-2 py-1 dark:border-gray-700">
        <div className="flex flex-1">
          <TabButton active={activeTab === 'cables'} onClick={() => setActiveTab('cables')} label="Кабели" />
          <TabButton active={activeTab === 'loads'} onClick={() => setActiveTab('loads')} label="Нагрузки" />
          <TabButton active={activeTab === 'spec'} onClick={() => setActiveTab('spec')} label="Спецификация" />
        </div>
        <button
          onClick={recalc}
          className="ml-2 rounded bg-orange-500 px-2 py-1 text-xs text-white hover:bg-orange-600"
          title="Пересчитать длины и привязать к линиям"
        >
          Обновить
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto p-3">
        {activeTab === 'cables' && (
          <CableRunsTab runs={runs} plan={plan} />
        )}

        {activeTab === 'loads' && (
          <LoadsTab groups={groups} panelLoad={panelLoad} />
        )}

        {activeTab === 'spec' && (
          <SpecTab spec={spec} />
        )}
      </div>
    </>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-sm ${
        active
          ? 'border-b-2 border-orange-500 text-orange-600 dark:text-orange-400'
          : 'text-gray-600 dark:text-gray-400'
      }`}
    >
      {label}
    </button>
  )
}

function CableRunsTab({ runs, plan }: { runs: CableRunData[]; plan: Plan }) {
  if (runs.length === 0) {
    return (
      <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
        <div>Нет кабелей на плане.</div>
        <div className="text-xs">Проведите кабели между устройствами инструментом «Кабель».</div>
      </div>
    )
  }

  const circuitMap = new Map((plan.electrical.circuits ?? []).map((c: any) => [c.id, c]))

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const circuit = run.circuitId ? circuitMap.get(run.circuitId) : null
        return (
          <div key={run.id} className="rounded border border-gray-200 p-2 text-sm dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div className="font-medium text-gray-900 dark:text-white">
                {cableTypeName(run.cableType)} {run.crossSectionMm2} мм²
              </div>
              {circuit && (
                <div className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                  {circuit.name}
                </div>
              )}
            </div>
            <div className="mt-1 grid grid-cols-3 gap-1 text-xs text-gray-600 dark:text-gray-400">
              <div>Маршрут: <span className="font-medium text-gray-800 dark:text-gray-200">{run.routeM.toFixed(2)} м</span></div>
              <div>Запас: <span className="font-medium text-gray-800 dark:text-gray-200">{run.spareM.toFixed(2)} м</span></div>
              <div>Итого: <span className="font-medium text-gray-800 dark:text-gray-200">{run.totalM.toFixed(2)} м</span></div>
            </div>
            <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
              {run.fromDeviceId.slice(0, 8)} → {run.toDeviceId.slice(0, 8)}
            </div>
            {run.segments.length > 0 && (
              <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                Сегментов: {run.segments.length} · {run.description ?? ''}
              </div>
            )}
          </div>
        )
      })}

      <div className="rounded border-2 border-orange-500 bg-orange-50 p-2 text-sm dark:bg-orange-900/20">
        <div className="flex items-center justify-between font-semibold text-gray-900 dark:text-white">
          <span>Итого кабеля</span>
          <span>{runs.reduce((s, r) => s + r.totalM, 0).toFixed(2)} м</span>
        </div>
        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          Геометрическая: {runs.reduce((s, r) => s + r.routeM, 0).toFixed(2)} м · Запас: {runs.reduce((s, r) => s + r.spareM, 0).toFixed(2)} м
        </div>
      </div>
    </div>
  )
}

function LoadsTab({ groups, panelLoad }: { groups: LoadGroup[]; panelLoad: PanelLoad | null }) {
  return (
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
  )
}

function SpecTab({ spec }: { spec: CableSpecificationItem[] }) {
  if (spec.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Нет данных для спецификации. Обновите кабельный журнал.
      </div>
    )
  }

  const byCategory: Record<string, CableSpecificationItem[]> = {
    cable: [],
    conduit: [],
    fitting: [],
    mounting: [],
    other: [],
  }
  for (const item of spec) {
    byCategory[item.category] = [...(byCategory[item.category] ?? []), item]
  }

  const categoryNames: Record<string, string> = {
    cable: 'Кабели',
    conduit: 'Гофротруба / кабель-канал',
    fitting: 'Крепёж и фитинги',
    mounting: 'Монтажные материалы',
    other: 'Прочее',
  }

  return (
    <div className="space-y-3">
      {Object.entries(byCategory).map(([category, items]) =>
        items.length === 0 ? null : (
          <div key={category}>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {categoryNames[category] ?? category}
            </div>
            <div className="space-y-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded border border-gray-200 p-2 text-sm dark:border-gray-600"
                >
                  <div className="text-gray-900 dark:text-white">{item.name}</div>
                  <div className="text-gray-600 dark:text-gray-400">
                    {item.quantity} {item.unit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}

function cableTypeName(type: string): string {
  if (type === 'power') return 'Силовой'
  if (type === 'lighting') return 'Освещение'
  if (type === 'low-current') return 'Слаботочка'
  return type
}
