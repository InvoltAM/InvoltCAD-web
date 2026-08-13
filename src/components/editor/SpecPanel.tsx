'use client'

import { useEffect, useState } from 'react'
import { useEditor } from './EditorContext'
import { Plan } from '@core/model/Plan'
import { Storage } from '@core/io/Storage'
import { CABLE_TYPES, Cable } from '@core/model/Cable'
import { DEFAULT_DEVICE_NAMES, DeviceType } from '@core/model/Device'
import { AddSheetTableCommand } from '@core/editor/CommandManager'
import { Vector2 } from '@core/geometry/Vector2'

interface DeviceGroup {
  type: DeviceType
  label: string
  count: number
}

interface CableGroup {
  key: string
  label: string
  count: number
  totalLengthM: number
}

export default function SpecPanel() {
  const { engineRef } = useEditor()
  const [plan, setPlan] = useState<Plan | null>(null)

  useEffect(() => {
    setPlan(engineRef.current?.plan ?? null)
  }, [engineRef])

  // Обновляем спецификацию при смене активного листа / изменении плана
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return

    const refresh = () => {
      setPlan(engine.plan)
    }

    refresh()

    const interval = setInterval(refresh, 300)
    return () => clearInterval(interval)
  }, [engineRef])

  if (!plan) {
    return (
      <div className="p-2 text-sm text-[var(--text-muted)]">
        Нет данных
      </div>
    )
  }

  const devices = plan.devices
  const cables = plan.cables

  // Группировка оборудования по типу
  const deviceGroups = new Map<DeviceType, DeviceGroup>()
  for (const d of devices) {
    const existing = deviceGroups.get(d.type)
    if (existing) {
      existing.count++
    } else {
      deviceGroups.set(d.type, {
        type: d.type,
        label: DEFAULT_DEVICE_NAMES[d.type] ?? d.type,
        count: 1,
      })
    }
  }

  // Группировка кабелей по марке / типу + сечению
  const cableGroups = new Map<string, CableGroup>()
  for (const c of cables) {
    const brand = (c.brand ?? '').trim() || CABLE_TYPES[c.type] || ''
    const key = `${brand} ${c.crossSection} мм²`
    const totalMm = c.totalLength ?? c.length
    const existing = cableGroups.get(key)
    if (existing) {
      existing.count++
      existing.totalLengthM += totalMm / 1000
    } else {
      cableGroups.set(key, {
        key,
        label: key,
        count: 1,
        totalLengthM: totalMm / 1000,
      })
    }
  }

  const hasData = deviceGroups.size > 0 || cableGroups.size > 0

  const handleAddToSheet = () => {
    const engine = engineRef.current
    if (!engine || !plan) return
    const width = 240
    const height = 120
    const pos = new Vector2(engine.camera.x - width / 2, engine.camera.y - height / 2)
    engine.commandManager.execute(new AddSheetTableCommand(plan, 'spec', pos, width, height))
    engine.notifyChanged()
    engine.requestRender()
  }

  return (
    <div className="space-y-3 text-sm">
      {!hasData && (
        <div className="text-[var(--text-muted)]">
          На текущем листе нет оборудования и кабелей.
        </div>
      )}

      {deviceGroups.size > 0 && (
        <div>
          <div className="mb-1 font-medium text-[var(--text)]">Оборудование</div>
          <div className="divide-y divide-[var(--border)] rounded border border-[var(--border)]">
            {Array.from(deviceGroups.values()).map((g) => (
              <div
                key={g.type}
                className="flex items-center justify-between px-2 py-1"
              >
                <span className="text-[var(--text)]">{g.label}</span>
                <span className="text-[var(--text-muted)]">{g.count} шт</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cableGroups.size > 0 && (
        <div>
          <div className="mb-1 font-medium text-[var(--text)]">Кабели</div>
          <div className="divide-y divide-[var(--border)] rounded border border-[var(--border)]">
            {Array.from(cableGroups.values()).map((g) => (
              <div
                key={g.key}
                className="flex items-center justify-between px-2 py-1"
              >
                <span className="text-[var(--text)]">{g.label}</span>
                <span className="text-[var(--text-muted)] whitespace-nowrap">
                  {g.totalLengthM.toFixed(1)} м
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleAddToSheet}
        className="w-full rounded border border-[var(--accent)] bg-[var(--accent)]/10 px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/20"
      >
        Добавить на лист
      </button>

      <button
        onClick={() => new Storage().exportSpecToCSV(plan)}
        className="w-full rounded border border-[var(--accent)] bg-[var(--accent)]/10 px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/20"
      >
        Экспорт CSV листа
      </button>
    </div>
  )
}
