/* eslint-disable react-hooks/immutability -- редактор работает через мутации плана по дизайну */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from './EditorContext'
import { useCadStore } from '@/stores/cadStore'
import { Plan } from '@core/model/Plan'
import { generatePanelDevices, layoutPanel } from '@core/panels/panelModel'
import { DistributionBoardData, BoardComponent } from '@core/electrical/BoardEngine'
import { icon } from './icons'

const MODULE_WIDTH = 40
const MODULE_GAP = 4
const RAIL_MODULES = 12

interface PanelDevice {
  id: string
  type: string
  name: string
  width: number
  rating: number
  color: string
}

interface PanelRow {
  id: string
  index: number
  devices: PanelDevice[]
}

export default function PanelEditor() {
  const { engineRef } = useEditor()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [activeTab, setActiveTab] = useState<'editor' | 'basket'>('editor')
  const [componentOrder, setComponentOrder] = useState<string[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const open = useCadStore((s) => s.panelEditorOpen)
  const setOpen = useCadStore((s) => s.setPanelEditorOpen)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPlan(engineRef.current?.plan ?? null)
    }, 0)
    return () => clearTimeout(timer)
  }, [engineRef])

  const board = (plan?.electrical.distributionBoards?.[0] as DistributionBoardData | undefined) || null

  const fallbackPanel = useMemo(() => {
    if (board || !plan) return null
    const groupCount = new Set(plan.cables.map((c) => c.type)).size
    const devices = generatePanelDevices(Math.max(groupCount, 3))
    const rawPanel = layoutPanel(devices)
    return adaptPanel(rawPanel)
  }, [plan, board])

  // Синхронизируем порядок компонентов с доской при открытии/изменении доски.
  useEffect(() => {
    if (board) {
      setComponentOrder(board.components.map((c) => c.id))
    }
  }, [board?.components.map((c) => c.id).join(',')])

  const rows = useMemo<PanelRow[]>(() => {
    if (board) {
      return splitIntoRows(componentOrder, board.components, RAIL_MODULES)
    }
    return fallbackPanel?.rows ?? []
  }, [board, componentOrder, fallbackPanel])

  const totalUsed = useMemo(
    () => rows.reduce((sum, row) => sum + row.devices.reduce((s, d) => s + d.width, 0), 0),
    [rows],
  )
  const totalModules = board?.dinModules ?? fallbackPanel?.totalModules ?? 0

  const syncBoardOrder = (order: string[]) => {
    if (!board || !plan) return
    const map = new Map(board.components.map((c) => [c.id, c]))
    const next = order.map((id) => map.get(id)).filter((c): c is BoardComponent => !!c)
    board.components = next
    engineRef.current?.notifyChanged()
  }

  const handlePointerDown = (deviceId: string) => (e: React.PointerEvent) => {
    if (!board) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragId(deviceId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragId || !board) return
    e.preventDefault()
    const target = getDropTarget(e.clientX, e.clientY, rows, rowRefs.current, dragId)
    if (!target) return
    setComponentOrder((prev) => moveId(prev, dragId, target.rowIndex, target.index))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragId || !board) return
    e.preventDefault()
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    setComponentOrder((prev) => {
      syncBoardOrder(prev)
      return prev
    })
    setDragId(null)
  }

  if (!open) return null

  const components = board?.components ?? []

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/35" onClick={() => setOpen(false)}>
      <div
        className="flex h-[80vh] w-[90vw] max-w-5xl flex-col rounded-lg bg-white dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-600">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">Визуализация щита</span>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Левая панель с кнопками */}
          <div className="flex w-16 flex-col items-center gap-2 border-r border-gray-200 bg-gray-50 p-2 dark:border-gray-600 dark:bg-gray-700">
            <button
              onClick={() => setActiveTab('editor')}
              className={`project-sidebar-btn ${activeTab === 'editor' ? 'active' : ''}`}
              title="Редактор"
            >
              <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('panel') }} />
              <span className="project-sidebar-label">Щит</span>
            </button>
            <button
              onClick={() => setActiveTab('basket')}
              className={`project-sidebar-btn ${activeTab === 'basket' ? 'active' : ''}`}
              title="Корзина"
            >
              <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('basket') }} />
              <span className="project-sidebar-label">Корзина</span>
            </button>
          </div>

          {/* Основная область */}
          <div
            className="flex-1 overflow-auto rounded-bl-lg bg-gray-50 p-4 dark:bg-gray-900"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {activeTab === 'editor' ? (
              rows.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Использовано модулей: {totalUsed} / {totalModules}
                    {board && (
                      <span className="ml-2">
                        · {board.phases === 'three' ? '3-ф' : '1-ф'} · {board.voltage}В · {board.totalPowerW.toFixed(0)}Вт
                      </span>
                    )}
                  </div>

                  {rows.map((rail) => (
                    <div key={rail.id} className="space-y-2">
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Рейка {rail.index + 1}
                      </div>
                      <div
                        ref={(el) => { rowRefs.current[rail.id] = el }}
                        className="flex min-h-[60px] gap-1 rounded border border-dashed border-transparent p-1 hover:border-gray-200 dark:hover:border-gray-600"
                        data-row-id={rail.id}
                      >
                        {rail.devices.map((device) => (
                          <div
                            key={device.id}
                            data-device-id={device.id}
                            onPointerDown={handlePointerDown(device.id)}
                            className={`flex cursor-grab flex-col items-center justify-center rounded border p-2 text-center touch-none select-none ${device.color} ${dragId === device.id ? 'opacity-60' : ''}`}
                            style={{ width: `${device.width * MODULE_WIDTH + (device.width - 1) * MODULE_GAP}px` }}
                            title={`${device.name} (${device.rating}А)`}
                          >
                            <div className="text-xs font-medium text-gray-900 dark:text-white">
                              {device.type === 'breaker' ? 'QF' : device.type === 'input-breaker' ? 'QF' : device.type === 'rcd' ? 'QF+RCD' : device.type === 'busbar' ? 'Шина' : 'T'}
                            </div>
                            <div className="text-[10px] text-gray-600 dark:text-gray-400">
                              {device.rating > 0 ? `${device.rating}A` : ''}
                            </div>
                            <div className="mt-1 max-w-full truncate text-[9px] text-gray-500 dark:text-gray-400">
                              {device.name}
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
              )
            ) : (
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Элементы щита из однолинейной схемы
                </div>
                {components.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Нет элементов. Соберите щит из однолинейной схемы (ОЛС → Автособрать щит).
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {components.map((comp) => (
                        <div
                          key={comp.id}
                          className="rounded border border-gray-200 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800"
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
                    </div>
                    <div className="border-t border-gray-200 pt-2 text-xs text-gray-500 dark:border-gray-600 dark:text-gray-400">
                      Всего: {components.reduce((s, c) => s + c.widthModules, 0)} модулей
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function splitIntoRows(order: string[], components: BoardComponent[], modulesPerRow: number): PanelRow[] {
  const map = new Map(components.map((c) => [c.id, c]))
  const rows: PanelRow[] = []
  let current: PanelRow = { id: `row-${rows.length}`, index: rows.length, devices: [] }
  let used = 0

  for (const id of order) {
    const comp = map.get(id)
    if (!comp) continue
    if (used + comp.widthModules > modulesPerRow && current.devices.length > 0) {
      rows.push(current)
      current = { id: `row-${rows.length}`, index: rows.length, devices: [] }
      used = 0
    }
    current.devices.push({
      id: comp.id,
      type: comp.type,
      name: comp.name,
      width: comp.widthModules,
      rating: comp.ratingA ?? 0,
      color: deviceColor(comp.type),
    })
    used += comp.widthModules
  }
  if (current.devices.length > 0) rows.push(current)

  return rows
}

function getDropTarget(
  clientX: number,
  clientY: number,
  rows: PanelRow[],
  rowRefs: Record<string, HTMLDivElement | null>,
  dragId: string,
): { rowIndex: number; index: number } | null {
  let targetRowIndex = -1
  for (let i = 0; i < rows.length; i++) {
    const el = rowRefs[rows[i]!.id]
    if (!el) continue
    const rect = el.getBoundingClientRect()
    if (clientY >= rect.top && clientY <= rect.bottom) {
      targetRowIndex = i
      break
    }
  }
  if (targetRowIndex === -1) return null

  const row = rows[targetRowIndex]!
  const rowEl = rowRefs[row.id]
  if (!rowEl) return { rowIndex: targetRowIndex, index: row.devices.length }

  const rowRect = rowEl.getBoundingClientRect()
  const relX = clientX - rowRect.left
  let index = 0
  let x = 0
  for (const device of row.devices) {
    const w = device.width * MODULE_WIDTH + (device.width - 1) * MODULE_GAP
    if (relX < x + w / 2) break
    x += w + MODULE_GAP
    index++
  }

  // Пересчитываем индекс в общем порядке componentOrder
  const overallIndex = rows.slice(0, targetRowIndex).reduce((sum, r) => sum + r.devices.length, 0) + index
  return { rowIndex: overallIndex, index: overallIndex }
}

function moveId(order: string[], dragId: string, targetIndex: number, _unused: number): string[] {
  const currentIndex = order.indexOf(dragId)
  if (currentIndex === -1) return order
  if (targetIndex === currentIndex) return order
  const next = [...order]
  next.splice(currentIndex, 1)
  const insertAt = targetIndex > currentIndex ? targetIndex - 1 : targetIndex
  next.splice(insertAt, 0, dragId)
  return next
}

function buildPanelFromBoard(board: DistributionBoardData) {
  const sorted = [...board.components]
  sorted.sort((a, b) => {
    const orderA = a.type === 'input-breaker' ? 0 : a.type === 'rcd' && a.id === 'main-rcd' ? 1 : 2
    const orderB = b.type === 'input-breaker' ? 0 : b.type === 'rcd' && b.id === 'main-rcd' ? 1 : 2
    return orderA - orderB
  })
  return splitIntoRows(sorted.map((c) => c.id), board.components, RAIL_MODULES)
}

function deviceColor(type: string): string {
  if (type === 'input-breaker') return 'border-red-400 bg-red-100 dark:border-red-600 dark:bg-red-900/30'
  if (type === 'breaker') return 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20'
  if (type === 'rcd') return 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
  if (type === 'busbar') return 'border-gray-400 bg-gray-200 dark:border-gray-500 dark:bg-gray-600'
  return 'border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-700'
}

function adaptPanel(raw: { usedModules: number; totalModules: number; rows: Array<{ id: string; index: number; devices: Array<{ id: string; type: string; name: string; width: number; rating: number }> }> }) {
  return {
    usedModules: raw.usedModules,
    totalModules: raw.totalModules,
    rows: raw.rows.map((row) => ({
      id: row.id,
      index: row.index,
      devices: row.devices.map((device) => ({
        id: device.id,
        type: device.type,
        name: device.name,
        width: device.width,
        rating: device.rating,
        color: deviceColor(device.type),
      })),
    })),
  }
}
