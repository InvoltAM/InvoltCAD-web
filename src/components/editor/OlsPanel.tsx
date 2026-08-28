/* eslint-disable react-hooks/immutability -- редактор работает через мутации плана по дизайну */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useEditor } from './EditorContext'
import { useCadStore } from '@/stores/cadStore'
import { Plan } from '@core/model/Plan'
import { buildDistributionBoard, DistributionBoardData } from '@core/electrical/BoardEngine'
import { generateBoardSvg, generateOlsFromCircuits } from '@core/electrical/BoardSvgScheme'
import { CircuitData } from '@core/electrical/RoomConsumerEngine'
import type { PanelTableRow } from '@core/electrical/PanelTableRow'

type OlsPanelTableRow = PanelTableRow & { isManual?: boolean }
import { icon } from './icons'

export default function OlsPanel() {
  const { engineRef } = useEditor()
  const [plan, setPlan] = useState<Plan | null>(null)
  const open = useCadStore((s) => s.olsOpen)
  const setOpen = useCadStore((s) => s.setOlsOpen)
  const theme = useCadStore((s) => s.theme)
  const [, forceUpdate] = useState(0)
  const [leftTab, setLeftTab] = useState<'scheme' | 'table' | 'spec'>('scheme')
  const [selectedElement, setSelectedElement] = useState<string | null>(null)

  const OLS_ELEMENTS = [
    { id: 'breaker', label: 'Автоматы', icon: 'automation' as const },
    { id: 'contactor', label: 'Контакторы', icon: 'contactor' as const },
    { id: 'rcd', label: 'УЗО', icon: 'automation' as const },
    { id: 'dif', label: 'Дифы', icon: 'automation' as const },
    { id: 'relay', label: 'Реле', icon: 'relay' as const },
    { id: 'smartHome', label: 'УД', icon: 'smartHome' as const },
  ]

  useEffect(() => {
    const timer = setTimeout(() => {
      setPlan(engineRef.current?.plan ?? null)
    }, 0)
    return () => clearTimeout(timer)
  }, [engineRef])

  const circuits = (plan?.electrical.circuits as CircuitData[]) || []
  const board = (plan?.electrical.distributionBoards?.[0] as DistributionBoardData | undefined) || null

  const svg = useMemo(() => {
    if (board) return generateBoardSvg(board, { dark: theme === 'dark' })
    if (circuits.length > 0) return generateOlsFromCircuits(circuits, { dark: theme === 'dark' })
    return null
  }, [board, circuits, theme, forceUpdate])

  const refresh = () => {
    forceUpdate((n) => n + 1)
    engineRef.current?.notifyChanged()
    engineRef.current?.requestRender()
  }

  const handleBuildBoard = () => {
    if (!plan) return
    if (circuits.length === 0) {
      alert('Сначала сгруппируйте потребителей в линии (Комнаты и потребители → Автогруппировать линии)')
      return
    }
    const newBoard = buildDistributionBoard(circuits, { phases: 'single', withMainRcd: true })
    plan.electrical.distributionBoards = [newBoard]
    refresh()
  }

  const handleExportSvg = () => {
    if (!svg) return
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'involtcad-ols.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleAddManualRow = () => {
    if (!plan) return
    const newRow: OlsPanelTableRow = {
      id: crypto.randomUUID(),
      panelName: 'Распределительный щит',
      groupNo: tableItems.length + 1,
      groupName: 'Новая группа',
      brand: '',
      section: 0,
      lengthM: 0,
      routingType: 'Авто',
      diameterMm: 0,
      isManual: true,
    }
    plan.electrical.manualPanelRows = [...manualRows, newRow]
    refresh()
  }

  const handleUpdateManualRow = (id: string, patch: Partial<OlsPanelTableRow>) => {
    if (!plan) return
    plan.electrical.manualPanelRows = manualRows.map((row) => {
      if (row.id !== id) return row
      const updated = { ...row, ...patch }
      if (patch.section !== undefined && patch.section > 0) {
        updated.diameterMm = estimateCableDiameter(patch.section)
      }
      return updated
    })
    refresh()
  }

  const handleDeleteManualRow = (id: string) => {
    if (!plan) return
    plan.electrical.manualPanelRows = manualRows.filter((row) => row.id !== id)
    refresh()
  }

  const manualRows = plan?.electrical?.manualPanelRows ?? []

  const tableItems = useMemo<OlsPanelTableRow[]>(() => {
    if (!plan) return []
    const cableMap = new Map(plan.cables.map((c) => [c.id, c]))
    const rows: OlsPanelTableRow[] = []

    if (board) {
      board.circuits.forEach((circuit, idx) => {
        const runs = plan.electrical.cableRuns?.filter((r) => r.circuitId === circuit.id) ?? []
        const totalLength = runs.reduce((sum, r) => sum + r.totalM, 0)
        const firstRun = runs[0]
        const cable = firstRun ? cableMap.get(firstRun.cableId) : undefined
        const section = firstRun?.crossSectionMm2 ?? cable?.crossSection ?? 0
        const brand = cable?.brand?.trim() || '—'
        const routingType = cable?.routingMode ? routingModeLabel(cable.routingMode) : cableTypeLabel(cable?.type ?? firstRun?.cableType ?? '')
        const diameterMm = section > 0 ? estimateCableDiameter(section) : 0
        rows.push({
          id: circuit.id,
          panelName: board.name,
          groupNo: idx + 1,
          groupName: circuit.name,
          brand,
          section,
          lengthM: totalLength,
          routingType,
          diameterMm,
        })
      })
    }

    // Добавляем строки, заполненные вручную (без привязки к нарисованному плану)
    const baseGroupNo = rows.length
    manualRows.forEach((row, idx) => {
      rows.push({
        ...row,
        groupNo: baseGroupNo + idx + 1,
        isManual: true,
      })
    })

    return rows
  }, [board, plan, manualRows])

  const specItems = useMemo(() => {
    if (!board) return []
    const map = new Map<string, { name: string; type: string; rating: number; width: number; count: number }>()
    for (const c of board.components) {
      const key = `${c.type}|${c.name}|${c.ratingA ?? 0}|${c.widthModules}`
      const existing = map.get(key)
      if (existing) {
        existing.count++
      } else {
        map.set(key, { name: c.name, type: c.type, rating: c.ratingA ?? 0, width: c.widthModules, count: 1 })
      }
    }
    return Array.from(map.values()).map((item, i) => ({ id: `${item.type}-${item.name}-${i}`, ...item }))
  }, [board])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/35" onClick={() => setOpen(false)}>
      <div
        className="flex h-[80vh] w-[90vw] max-w-5xl flex-col rounded-lg bg-white p-4 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">Однолинейная схема / Щит</span>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            onClick={handleBuildBoard}
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm text-white hover:bg-orange-600"
          >
            ⚡ Автособрать щит
          </button>
          <button
            onClick={handleExportSvg}
            disabled={!svg}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Экспорт SVG
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden rounded border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-900">
          {/* Левая панель ОЛС */}
          <div className="flex w-56 flex-col gap-2 overflow-y-auto border-r border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-800">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Однолинейная схема</div>
            <button
              onClick={() => setLeftTab('scheme')}
              className={`flex items-center gap-2 rounded border p-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                leftTab === 'scheme'
                  ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                  : 'border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800'
              }`}
              title="Схема"
            >
              <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('ols') }} />
              <span>Схема</span>
            </button>
            <button
              onClick={() => setLeftTab('table')}
              className={`flex items-center gap-2 rounded border p-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                leftTab === 'table'
                  ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                  : 'border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800'
              }`}
              title="Таблица щита"
            >
              <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('table') }} />
              <span>Таблица щита</span>
            </button>
            <button
              onClick={() => setLeftTab('spec')}
              className={`flex items-center gap-2 rounded border p-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                leftTab === 'spec'
                  ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                  : 'border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800'
              }`}
              title="Спецификация щита"
            >
              <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('spec') }} />
              <span>Спецификация щита</span>
            </button>

            <div className="my-1 h-px w-full bg-gray-200 dark:bg-gray-600" />
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Элементы</div>
            {OLS_ELEMENTS.map((el) => (
              <button
                key={el.id}
                onClick={() => setSelectedElement((prev) => (prev === el.id ? null : el.id))}
                className={`flex items-center gap-2 rounded border p-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  selectedElement === el.id
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                    : 'border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800'
                }`}
                title={el.label}
              >
                <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon(el.icon) }} />
                <span>{el.label}</span>
              </button>
            ))}
          </div>

          {/* Основная область */}
          <div className="flex-1 overflow-auto p-4">
            {leftTab === 'scheme' && (
              svg ? (
                <div className="min-h-full min-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
                  <p>Нет данных для схемы.</p>
                  <p className="text-sm">Сначала сгруппируйте потребителей в линии, затем нажмите «Автособрать щит».</p>
                </div>
              )
            )}

            {leftTab === 'table' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Таблица щита</div>
                  <button
                    onClick={handleAddManualRow}
                    className="rounded border border-[var(--accent)] bg-[var(--accent)]/10 px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/20"
                    title="Добавить строку вручную"
                  >
                    + Добавить строку
                  </button>
                </div>
                {tableItems.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Нет данных. Соберите щит через «Автособрать щит» или добавьте строку вручную.
                  </div>
                ) : (
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-600">
                        <th className="py-1 pr-4">№</th>
                        <th className="py-1 pr-4">Щит</th>
                        <th className="py-1 pr-4">Группа</th>
                        <th className="py-1 pr-4">Наименование группы</th>
                        <th className="py-1 pr-4">Марка</th>
                        <th className="py-1 pr-4">Сечение</th>
                        <th className="py-1 pr-4">Длина</th>
                        <th className="py-1 pr-4">Тип прокладки</th>
                        <th className="py-1 pr-4">Диаметр</th>
                        <th className="py-1 pr-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableItems.map((d, i) => {
                        const isManual = d.isManual || manualRows.some((r) => r.id === d.id)
                        return (
                          <tr key={d.id} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-1 pr-4">{i + 1}</td>
                            <td className="py-1 pr-4">
                              {isManual ? (
                                <input
                                  type="text"
                                  value={d.panelName}
                                  onChange={(e) => handleUpdateManualRow(d.id, { panelName: e.target.value })}
                                  className="w-32 rounded border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800"
                                />
                              ) : (
                                d.panelName
                              )}
                            </td>
                            <td className="py-1 pr-4">{d.groupNo}</td>
                            <td className="py-1 pr-4">
                              {isManual ? (
                                <input
                                  type="text"
                                  value={d.groupName}
                                  onChange={(e) => handleUpdateManualRow(d.id, { groupName: e.target.value })}
                                  className="w-32 rounded border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800"
                                />
                              ) : (
                                d.groupName
                              )}
                            </td>
                            <td className="py-1 pr-4">
                              {isManual ? (
                                <input
                                  type="text"
                                  value={d.brand}
                                  onChange={(e) => handleUpdateManualRow(d.id, { brand: e.target.value })}
                                  className="w-24 rounded border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800"
                                />
                              ) : (
                                d.brand
                              )}
                            </td>
                            <td className="py-1 pr-4">
                              {isManual ? (
                                <input
                                  type="number"
                                  value={d.section || ''}
                                  onChange={(e) => handleUpdateManualRow(d.id, { section: Number(e.target.value) })}
                                  className="w-20 rounded border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800"
                                />
                              ) : (
                                d.section > 0 ? `${d.section} мм²` : '—'
                              )}
                            </td>
                            <td className="py-1 pr-4">
                              {isManual ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={d.lengthM || ''}
                                  onChange={(e) => handleUpdateManualRow(d.id, { lengthM: Number(e.target.value) })}
                                  className="w-20 rounded border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800"
                                />
                              ) : (
                                d.lengthM > 0 ? `${d.lengthM.toFixed(2)} м` : '—'
                              )}
                            </td>
                            <td className="py-1 pr-4">
                              {isManual ? (
                                <select
                                  value={d.routingType}
                                  onChange={(e) => handleUpdateManualRow(d.id, { routingType: e.target.value })}
                                  className="w-28 rounded border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800"
                                >
                                  <option value="Авто">Авто</option>
                                  <option value="Вдоль стены">Вдоль стены</option>
                                  <option value="Ручной">Ручной</option>
                                  <option value="Через дверной проем">Через дверной проем</option>
                                </select>
                              ) : (
                                d.routingType
                              )}
                            </td>
                            <td className="py-1 pr-4">{d.diameterMm > 0 ? `${d.diameterMm.toFixed(2)} мм` : '—'}</td>
                            <td className="py-1 pr-4">
                              {isManual && (
                                <button
                                  onClick={() => handleDeleteManualRow(d.id)}
                                  className="text-red-500 hover:text-red-600"
                                  title="Удалить строку"
                                >
                                  ×
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {leftTab === 'spec' && (
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Спецификация щита</div>
                {specItems.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Нет данных. Соберите щит через «Автособрать щит».
                  </div>
                ) : (
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-600">
                        <th className="py-1 pr-4">№</th>
                        <th className="py-1 pr-4">Наименование</th>
                        <th className="py-1 pr-4">Тип</th>
                        <th className="py-1 pr-4">Iном, А</th>
                        <th className="py-1 pr-4">Модули</th>
                        <th className="py-1 pr-4">Кол-во</th>
                      </tr>
                    </thead>
                    <tbody>
                      {specItems.map((d, i) => (
                        <tr key={d.id} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="py-1 pr-4">{i + 1}</td>
                          <td className="py-1 pr-4">{d.name}</td>
                          <td className="py-1 pr-4">{d.type}</td>
                          <td className="py-1 pr-4">{d.rating > 0 ? d.rating : '—'}</td>
                          <td className="py-1 pr-4">{d.width}</td>
                          <td className="py-1 pr-4">{d.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function routingModeLabel(mode: string): string {
  switch (mode) {
    case 'auto': return 'Авто'
    case 'wall': return 'Вдоль стены'
    case 'manual': return 'Ручной'
    case 'through-doorway': return 'Через дверной проем'
    default: return mode
  }
}

function cableTypeLabel(type: string): string {
  switch (type) {
    case 'power': return 'Силовой'
    case 'lighting': return 'Освещение'
    case 'low-current': return 'Слаботочка'
    default: return type || '—'
  }
}

function estimateCableDiameter(sectionMm2: number): number {
  // Приблизительный наружный диаметр кабеля с изоляцией, мм
  const coreDiameter = 2 * Math.sqrt(sectionMm2 / Math.PI)
  return coreDiameter * 1.4
}
