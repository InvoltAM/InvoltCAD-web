'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useEditor } from './EditorContext'
import { Plan } from '@core/model/Plan'
import { CableRunData, buildCableRuns } from '@core/electrical/CableRunEngine'
import { RoomData, buildRoomData, ConsumerData } from '@core/electrical/RoomConsumerEngine'
import { DEFAULT_DEVICE_NAMES } from '@core/model/Device'
import { printCableJournal, CableJournalPrintRow } from '@/lib/cableJournalPrint'

type TabKey = 'standard' | 'gost'

interface JournalRow extends CableRunData {
  idx: number
  circuitName: string
  brand: string
  section: number
  rise: number
  fall: number
  roomName: string
  consumerName: string
  laid: boolean
}

export default function CableJournalPanel() {
  const { engineRef } = useEditor()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('standard')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setPlan(engineRef.current?.plan ?? null)
  }, [engineRef])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const refresh = () => setPlan(engine.plan)
    refresh()
    const interval = setInterval(refresh, 300)
    return () => clearInterval(interval)
  }, [engineRef])

  const recalc = () => {
    const p = engineRef.current?.plan
    if (!p) return
    p.recalcCableRoutes()
    p.electrical.cableRuns = buildCableRuns(p.cables, p.electrical.circuits ?? [])
    engineRef.current?.notifyChanged()
    engineRef.current?.requestRender()
    setPlan(p)
  }

  const toggleLaid = useCallback(
    (cableId: string) => {
      const engine = engineRef.current
      const p = engine?.plan
      if (!p) return
      const cable = p.cables.find((c) => c.id === cableId)
      if (!cable) return
      cable.laid = !cable.laid
      engine.notifyChanged()
      engine.requestRender()
      setTick((t) => t + 1)
    },
    [engineRef],
  )

  const runs = useMemo(() => {
    if (!plan) return []
    plan.recalcCableRoutes()
    plan.electrical.cableRuns = buildCableRuns(plan.cables, plan.electrical.circuits ?? [])
    return plan.electrical.cableRuns
  }, [plan])

  const circuitMap = useMemo(
    () => new Map((plan?.electrical.circuits ?? []).map((c: any) => [c.id, c])),
    [plan],
  )
  const cableMap = useMemo(() => new Map((plan?.cables ?? []).map((c) => [c.id, c])), [plan])
  const rooms = useMemo(
    () => (plan ? buildRoomData(plan, plan.electrical.consumers ?? []) : []),
    [plan],
  )

  const rows = useMemo<JournalRow[]>(() => {
    if (!plan) return []
    return runs.map((run, idx) => {
      const cable = cableMap.get(run.cableId)
      const circuit = run.circuitId ? circuitMap.get(run.circuitId) : null
      const consumer = circuit?.consumers?.find((c: ConsumerData) => c.deviceId === run.toDeviceId)
      const room = consumer?.roomId ? rooms.find((r) => r.id === consumer.roomId) : null
      const toDevice = plan.devices.find((d) => d.id === run.toDeviceId)
      const consumerName =
        consumer?.name || (toDevice ? toDevice.name || DEFAULT_DEVICE_NAMES[toDevice.type] : '—')
      const roomName = room ? `${rooms.indexOf(room) + 1} ${room.name}` : '—'
      return {
        ...run,
        idx: idx + 1,
        circuitName: circuit?.name ?? '—',
        brand: cable?.brand ?? cableTypeName(run.cableType),
        section: run.crossSectionMm2,
        rise: run.spareM,
        fall: 0,
        roomName,
        consumerName,
        laid: cable?.laid ?? false,
      }
    })
  }, [runs, cableMap, circuitMap, rooms, plan, tick])

  const handlePrint = useCallback(() => {
    if (!plan) return
    const printRows: CableJournalPrintRow[] = rows.map((row) => ({
      idx: row.idx,
      circuitName: row.circuitName,
      brand: row.brand,
      section: row.section,
      routeM: row.routeM,
      rise: row.rise,
      fall: row.fall,
      totalM: row.totalM,
      panel: '—',
      autoNo: row.circuitName,
      roomName: row.roomName,
      consumerName: row.consumerName,
      laid: row.laid,
    }))
    printCableJournal({
      title: 'Кабельный журнал',
      rows: printRows,
      titleBlock: plan.activeSheet?.titleBlock,
      plan,
    })
  }, [plan, rows])

  if (!plan) {
    return (
      <div className="p-4 text-sm text-[var(--text-muted)]">
        Нет данных
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col text-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--panel-bg)] px-3 py-2">
        <div className="flex items-center gap-2">
          <TabButton active={activeTab === 'standard'} onClick={() => setActiveTab('standard')} label="КЖ" />
          <TabButton active={activeTab === 'gost'} onClick={() => setActiveTab('gost')} label="КЖ по ГОСТ" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={recalc}
            className="rounded border border-[var(--accent)] bg-[var(--accent)]/10 px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/20"
            title="Пересчитать длины и привязать к линиям"
          >
            Обновить
          </button>
          <button
            onClick={() => handlePrint()}
            className="rounded border border-[var(--text-secondary)] bg-[var(--hover-bg)] px-2 py-1 text-xs text-[var(--text)] hover:bg-[var(--border)]"
            title="Печать кабельного журнала на листе А3 с рамкой и штампом"
          >
            Печать А3
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[var(--panel-bg)] p-2">
        {activeTab === 'standard' && (
          <div className="overflow-x-auto">
            <table className="cable-journal-table w-full border-collapse text-xs" style={{ minWidth: '420mm' }}>
              <thead>
                <tr>
                  <th rowSpan={2} className="col-narrow">Прол.</th>
                  <th rowSpan={2} className="col-narrow">№ п/п</th>
                  <th rowSpan={2} className="col-group">№гр.</th>
                  <th rowSpan={2} className="col-brand">Марка кабеля</th>
                  <th rowSpan={2} className="col-section">S, мм²</th>
                  <th colSpan={4}>Длина, м</th>
                  <th colSpan={2}>Начало</th>
                  <th colSpan={2}>Конец</th>
                </tr>
                <tr>
                  <th className="col-length">черт.</th>
                  <th className="col-length">↑ П</th>
                  <th className="col-length">↓ О</th>
                  <th className="col-total">Общая</th>
                  <th className="col-start">щит</th>
                  <th className="col-start">№Авт.</th>
                  <th>пом.</th>
                  <th>Потребитель</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center text-[var(--text-muted)]">
                      Нет кабелей. Проведите кабели между устройствами инструментом «Кабель» и нажмите «Обновить».
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="col-narrow">
                        <input
                          type="checkbox"
                          checked={row.laid}
                          onChange={() => toggleLaid(row.cableId)}
                          title="Проложен по факту"
                        />
                      </td>
                      <td className="col-narrow">{row.idx}</td>
                      <td className="col-group">{row.circuitName}</td>
                      <td className="col-brand">{row.brand}</td>
                      <td className="col-section">{row.section}</td>
                      <td className="col-length">{row.routeM.toFixed(2)}</td>
                      <td className="col-length">{row.rise.toFixed(2)}</td>
                      <td className="col-length">{row.fall.toFixed(2)}</td>
                      <td className="col-total">{row.totalM.toFixed(2)}</td>
                      <td className="col-start">—</td>
                      <td className="col-start">{row.circuitName}</td>
                      <td>{row.roomName}</td>
                      <td>{row.consumerName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'gost' && (
          <div className="p-4 text-[var(--text-muted)]">
            Здесь будет форма кабельного журнала по ГОСТ.
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-1 text-xs ${
        active
          ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
          : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text)]'
      }`}
    >
      {label}
    </button>
  )
}

function cableTypeName(type: string): string {
  if (type === 'power') return 'Силовой'
  if (type === 'lighting') return 'Освещение'
  if (type === 'low-current') return 'Слаботочка'
  return type
}
