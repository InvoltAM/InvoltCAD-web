'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from './EditorContext'
import { useCadStore } from '@/stores/cadStore'
import { Cable } from '@core/model/Cable'
import { Plan } from '@core/model/Plan'
import { CABLE_TYPES } from '@core/model/Cable'

interface CableView {
  cable: Cable
}

export default function SheetCablesPanel() {
  const { engineRef } = useEditor()
  const selectedCableId = useCadStore((s) => s.selectedCableId)
  const setSelectedCable = useCadStore((s) => s.setSelectedCable)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [cables, setCables] = useState<CableView[]>([])
  const [tick, setTick] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPlan(engineRef.current?.plan ?? null)
  }, [engineRef])

  // Обновляем список кабелей при изменении плана, активного листа или выделения
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return

    const refresh = () => {
      const p = engine.plan
      setPlan(p)
      const views = p.cables.map((cable) => ({ cable }))
      setCables(views)
    }

    refresh()

    const interval = setInterval(refresh, 300)
    const unsub = engine.editorState.subscribe('selectedCableId', () => setTick((t) => t + 1))

    return () => {
      clearInterval(interval)
      unsub()
    }
  }, [engineRef])

  // Прокручиваем к выделенному кабелю
  useEffect(() => {
    if (!selectedCableId || !listRef.current) return
    const el = listRef.current.querySelector(`[data-cable-id="${selectedCableId}"`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedCableId, tick])

  const getMarking = (cable: Cable): string => {
    if (cable.marking) return cable.marking
    if (cable.circuitId && plan) {
      const circuit = plan.electrical.circuits.find((c: any) => c.id === cable.circuitId)
      return circuit?.name ?? ''
    }
    return ''
  }

  const handleToggleVisible = (cable: Cable) => {
    const engine = engineRef.current
    if (!engine) return
    cable.visible = cable.visible !== false ? false : true
    engine.notifyChanged()
    engine.requestRender()
  }

  const handleUpdateBrand = (cable: Cable, value: string) => {
    const engine = engineRef.current
    if (!engine) return
    cable.brand = value
    engine.notifyChanged()
    engine.requestRender()
  }

  const handleUpdateMarking = (cable: Cable, value: string) => {
    const engine = engineRef.current
    if (!engine) return
    cable.marking = value
    engine.notifyChanged()
    engine.requestRender()
  }

  const handleSelectCable = (cable: Cable) => {
    setSelectedCable(cable.id)
  }

  const formatLength = (cable: Cable) => {
    const meters = (cable.totalLength ?? cable.length) / 1000
    return `${meters.toFixed(2)} м`
  }

  if (cables.length === 0) {
    return (
      <div className="p-2 text-sm text-[var(--text-muted)]">
        На текущем листе нет кабелей.
      </div>
    )
  }

  return (
    <div ref={listRef} className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
      {cables.map(({ cable }) => {
        const selected = selectedCableId === cable.id
        const marking = getMarking(cable)
        return (
          <div
            key={cable.id}
            data-cable-id={cable.id}
            onClick={() => handleSelectCable(cable)}
            className={[
              'rounded border p-2 text-sm cursor-pointer transition-colors',
              selected
                ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-[var(--border)] hover:bg-[var(--hover-bg)]',
            ].join(' ')}
          >
            <div className="flex items-center gap-2 mb-1">
              <input
                type="checkbox"
                checked={cable.visible !== false}
                onChange={() => handleToggleVisible(cable)}
                onClick={(e) => e.stopPropagation()}
                className="rounded border-[var(--border)] bg-[var(--panel-bg)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span className="font-medium text-[var(--text)] truncate">
                {CABLE_TYPES[cable.type]} {cable.crossSection} мм²
              </span>
              <span className="ml-auto text-[var(--text-muted)] whitespace-nowrap">
                {formatLength(cable)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={cable.brand ?? ''}
                onChange={(e) => handleUpdateBrand(cable, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Марка"
                className="w-full px-1.5 py-1 text-xs rounded border border-[var(--border)] bg-[var(--panel-bg)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
              <input
                type="text"
                value={marking}
                onChange={(e) => handleUpdateMarking(cable, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Маркировка"
                className="w-full px-1.5 py-1 text-xs rounded border border-[var(--border)] bg-[var(--panel-bg)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
