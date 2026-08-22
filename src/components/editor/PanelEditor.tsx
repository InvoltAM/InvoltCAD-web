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
  section?: number
  devices: PanelDevice[]
}

interface DeviceOption {
  type: string
  name: string
  baseWidth: number
  ratingA?: number
  characteristic?: 'B' | 'C' | 'D'
  rcdType?: 'AC' | 'A' | 'S'
  rcdMA?: number
}

const DEVICE_CATALOG: DeviceOption[] = [
  { type: 'breaker', name: 'Автомат 16А', baseWidth: 1, ratingA: 16, characteristic: 'C' },
  { type: 'breaker', name: 'Автомат 25А', baseWidth: 1, ratingA: 25, characteristic: 'C' },
  { type: 'breaker', name: 'Автомат 32А', baseWidth: 1, ratingA: 32, characteristic: 'C' },
  { type: 'breaker', name: 'Автомат 40А', baseWidth: 1, ratingA: 40, characteristic: 'C' },
  { type: 'rcd', name: 'УЗО 25А 30мА', baseWidth: 2, ratingA: 25, rcdType: 'A', rcdMA: 30 },
  { type: 'rcd', name: 'УЗО 40А 30мА', baseWidth: 2, ratingA: 40, rcdType: 'A', rcdMA: 30 },
  { type: 'rcd', name: 'УЗО 63А 30мА', baseWidth: 2, ratingA: 63, rcdType: 'A', rcdMA: 30 },
  { type: 'contactor', name: 'Контактор 25А', baseWidth: 2, ratingA: 25 },
  { type: 'bus', name: 'Шина N', baseWidth: 2 },
  { type: 'bus', name: 'Шина PE', baseWidth: 2 },
  { type: 'blank', name: 'Заглушка', baseWidth: 1 },
]

function DeviceIcon({ type }: { type: string }) {
  const t = type === 'busbar' ? 'bus' : type
  const sw = 1.5
  switch (t) {
    case 'input-breaker':
    case 'breaker':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={sw}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="M7 15 L17 9" />
        </svg>
      )
    case 'rcd':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={sw}>
          <rect x="4" y="6" width="7" height="12" rx="1" />
          <rect x="13" y="6" width="7" height="12" rx="1" />
          <path d="M6 15 L9 9" />
          <path d="M15 15 L18 9" />
        </svg>
      )
    case 'contactor':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={sw}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 8 Q12 12 8 16" />
          <path d="M16 8 Q12 12 16 16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      )
    case 'bus':
      return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={sw}>
          <line x1="4" y1="10" x2="20" y2="10" />
          <line x1="4" y1="14" x2="20" y2="14" />
        </svg>
      )
    case 'blank':
    default:
      return null
  }
}

function getWidthForBoard(option: DeviceOption, phases: 'single' | 'three'): number {
  if (phases === 'single') return option.baseWidth
  if (option.type === 'breaker') return 3
  if (option.type === 'rcd') return 4
  if (option.type === 'contactor') return 3
  return option.baseWidth
}

export default function PanelEditor() {
  const { engineRef } = useEditor()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [activeTab, setActiveTab] = useState<'editor' | 'basket'>('editor')
  const [sections, setSections] = useState(1)
  const [sectionOrders, setSectionOrders] = useState<string[][]>([])
  const [fallbackEdits, setFallbackEdits] = useState<{
    hidden: Set<string>
    custom: PanelDevice[]
    sections: number
    sectionOrders: string[][]
  } | null>(null)
  const [extraRowIds, setExtraRowIds] = useState<string[]>([])
  const nextExtraIdRef = useRef(0)
  const [dragId, setDragId] = useState<string | null>(null)
  const [menuRowId, setMenuRowId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [dialogSize, setDialogSize] = useState<{ width: number; height: number } | null>(null)
  const [dialogPos, setDialogPos] = useState<{ left: number; top: number } | null>(null)
  const [resizing, setResizing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const resizeStartRef = useRef({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    left: 0,
    top: 0,
    corner: 'se' as 'se' | 'nw',
  })
  const dragStartRef = useRef({ x: 0, y: 0, left: 0, top: 0 })
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const open = useCadStore((s) => s.panelEditorOpen)
  const setOpen = useCadStore((s) => s.setPanelEditorOpen)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const width = Math.min(window.innerWidth * 0.9, 1024)
    const height = window.innerHeight * 0.8
    setDialogSize({ width, height })
    setDialogPos({
      left: (window.innerWidth - width) / 2,
      top: (window.innerHeight - height) / 2,
    })
  }, [])

  useEffect(() => {
    if (!resizing) return
    const handleMove = (e: PointerEvent) => {
      const { x, y, width, height, left, top, corner } = resizeStartRef.current
      const maxWidth = window.innerWidth * 0.95
      const maxHeight = window.innerHeight * 0.95
      if (corner === 'se') {
        const newWidth = Math.max(640, Math.min(maxWidth, width + (e.clientX - x)))
        const newHeight = Math.max(400, Math.min(maxHeight, height + (e.clientY - y)))
        setDialogSize({ width: newWidth, height: newHeight })
      } else {
        const newWidth = Math.max(640, Math.min(maxWidth, width - (e.clientX - x)))
        const newHeight = Math.max(400, Math.min(maxHeight, height - (e.clientY - y)))
        setDialogSize({ width: newWidth, height: newHeight })
        setDialogPos({
          left: left + (width - newWidth),
          top: top + (height - newHeight),
        })
      }
    }
    const handleUp = () => setResizing(false)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [resizing])

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e: PointerEvent) => {
      const { x, y, left, top } = dragStartRef.current
      setDialogPos({
        left: left + (e.clientX - x),
        top: top + (e.clientY - y),
      })
    }
    const handleUp = () => setDragging(false)
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [dragging])

  const handleResizeStart = (corner: 'se' | 'nw') => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dialogSize || !dialogPos) return
    setResizing(true)
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: dialogSize.width,
      height: dialogSize.height,
      left: dialogPos.left,
      top: dialogPos.top,
      corner,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    if (!dialogPos) return
    setDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY, left: dialogPos.left, top: dialogPos.top }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom((z) => Math.min(3, Math.max(0.5, Number((z + delta).toFixed(2)))))
  }

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

  // Синхронизируем порядок компонентов с доской или fallback-генерацией.
  useEffect(() => {
    if (board) {
      setSectionOrders([board.components.map((c) => c.id)])
      setFallbackEdits(null)
      return
    }
    if (!fallbackPanel) return
    const baseIds = fallbackPanel.rows.flatMap((r) => r.devices.map((d) => d.id))
    setFallbackEdits((prev) => {
      const sectionOrders = prev?.sectionOrders ?? [baseIds]
      const hidden = prev?.hidden ?? new Set<string>()
      const custom = prev?.custom ?? []
      const visibleOrder =
        sectionOrders[0]?.filter(
          (id) => (baseIds.includes(id) || custom.some((d) => d.id === id)) && !hidden.has(id),
        ) ?? []
      const newIds = baseIds.filter((id) => !sectionOrders[0]?.includes(id))
      return {
        sectionOrders: [[...visibleOrder, ...newIds]],
        hidden,
        custom,
        sections: 1,
      }
    })
    setSectionOrders([])
  }, [board, fallbackPanel])

  // Сбрасываем добавленные пустые рейки и отсеки при смене источника данных.
  useEffect(() => {
    setExtraRowIds([])
    nextExtraIdRef.current = 0
    setSections(1)
  }, [board ? 'board' : 'fallback'])

  // Корректируем sectionOrders при изменении числа отсеков.
  useEffect(() => {
    if (board) {
      setSectionOrders((prev) => adjustSectionOrders(prev, sections))
    } else if (fallbackEdits) {
      setFallbackEdits((prev) => {
        if (!prev) return null
        if (prev.sections === sections) return prev
        return {
          ...prev,
          sectionOrders: adjustSectionOrders(prev.sectionOrders, sections),
          sections,
        }
      })
    }
  }, [sections, board, fallbackEdits])

  const fallbackDeviceMap = useMemo(() => {
    const map = new Map<string, PanelDevice>()
    fallbackPanel?.rows.forEach((row) => row.devices.forEach((d) => map.set(d.id, d)))
    fallbackEdits?.custom.forEach((d) => map.set(d.id, d))
    return map
  }, [fallbackPanel, fallbackEdits?.custom])

  const rowGroups = useMemo<PanelRow[][]>(() => {
    if (board) {
      return sectionOrders.map((order, s) =>
        splitIntoRows(order, board.components, RAIL_MODULES).map((row, rowIndex) => ({
          ...row,
          id: `section-${s}-row-${rowIndex}`,
          section: s,
          index: rowIndex,
        })),
      )
    }
    if (!fallbackPanel || !fallbackEdits) return []
    const visibleOrders = fallbackEdits.sectionOrders.map((order) =>
      order.filter((id) => !fallbackEdits.hidden.has(id)),
    )
    const components = visibleOrders
      .flat()
      .map((id) => {
        const d = fallbackDeviceMap.get(id)
        if (!d) return null
        const comp: BoardComponent = {
          id: d.id,
          type: d.type as BoardComponent['type'],
          name: d.name,
          widthModules: d.width,
          ratingA: d.rating,
          phase: 'L1',
          circuitIds: [],
        }
        return comp
      })
      .filter((c): c is BoardComponent => !!c)
    return visibleOrders.map((order, s) =>
      splitIntoRows(order, components, RAIL_MODULES).map((row, rowIndex) => ({
        ...row,
        id: `section-${s}-row-${rowIndex}`,
        section: s,
        index: rowIndex,
      })),
    )
  }, [board, sectionOrders, fallbackPanel, fallbackEdits, fallbackDeviceMap])

  const displayRowGroups = useMemo<PanelRow[][]>(() => {
    const maxRows = Math.max(...rowGroups.map((g) => g.length), 0)
    const groups: PanelRow[][] = []
    for (let i = 0; i < maxRows; i++) {
      const group: PanelRow[] = []
      for (let s = 0; s < sections; s++) {
        const row = rowGroups[s]?.[i]
        if (row) {
          group.push(row)
        } else {
          group.push({ id: `section-${s}-row-${i}`, index: i, section: s, devices: [] })
        }
      }
      groups.push(group)
    }
    extraRowIds.forEach((extraId, i) => {
      const rowIndex = maxRows + i
      const group: PanelRow[] = []
      for (let s = 0; s < sections; s++) {
        group.push({ id: `extra-${extraId}-section-${s}`, index: rowIndex, section: s, devices: [] })
      }
      groups.push(group)
    })
    return groups
  }, [rowGroups, sections, extraRowIds])

  const displayRows = useMemo<PanelRow[]>(() => displayRowGroups.flat(), [displayRowGroups])

  const totalUsed = useMemo(
    () => displayRows.reduce((sum, row) => sum + row.devices.reduce((s, d) => s + d.width, 0), 0),
    [displayRows],
  )
  const totalModules = sections * RAIL_MODULES * Math.max(displayRowGroups.length, 1)

  // Синхронизируем порядок компонентов доски с sectionOrders.
  useEffect(() => {
    if (!board) return
    const flatOrder = sectionOrders.flat()
    const map = new Map(board.components.map((c) => [c.id, c]))
    const next = flatOrder.map((id) => map.get(id)).filter((c): c is BoardComponent => !!c)
    board.components = next
    engineRef.current?.notifyChanged()
  }, [sectionOrders, board, engineRef])

  const dragElRef = useRef<HTMLElement | null>(null)

  const handleDeleteDevice = (deviceId: string) => {
    if (board) {
      const comp = board.components.find((c) => c.id === deviceId)
      if (!comp) return
      if (!confirm(`Удалить «${comp.name}»?`)) return
      setSectionOrders((prev) => prev.map((sec) => sec.filter((id) => id !== deviceId)))
      board.components = board.components.filter((c) => c.id !== deviceId)
      engineRef.current?.notifyChanged()
      return
    }
    const d = fallbackDeviceMap.get(deviceId)
    if (!d) return
    if (!confirm(`Удалить «${d.name}»?`)) return
    setFallbackEdits((prev) => {
      if (!prev) return null
      const nextHidden = new Set(prev.hidden)
      nextHidden.add(deviceId)
      return {
        ...prev,
        hidden: nextHidden,
        custom: prev.custom.filter((c) => c.id !== deviceId),
      }
    })
  }

  const handleDeleteRow = (rowGroupIndex: number, rowGroup: PanelRow[]) => {
    const isExtra = rowGroup[0]?.id.startsWith('extra-') ?? false
    if (isExtra) {
      const match = rowGroup[0]!.id.match(/^extra-(.+?)-section-\d+$/)
      const extraId = match?.[1]
      if (extraId) {
        setExtraRowIds((prev) => prev.filter((id) => id !== extraId))
      }
      return
    }

    const idsToRemove = new Set(rowGroup.flatMap((rail) => rail.devices.map((d) => d.id)))
    if (idsToRemove.size === 0) return
    if (!confirm('Удалить все аппараты на этой рейке?')) return

    if (board) {
      setSectionOrders((prev) => prev.map((sec) => sec.filter((id) => !idsToRemove.has(id))))
      board.components = board.components.filter((c) => !idsToRemove.has(c.id))
      engineRef.current?.notifyChanged()
      return
    }

    setFallbackEdits((prev) => {
      if (!prev) return null
      const nextHidden = new Set(prev.hidden)
      idsToRemove.forEach((id) => nextHidden.add(id))
      return {
        ...prev,
        sectionOrders: prev.sectionOrders.map((sec) => sec.filter((id) => !idsToRemove.has(id))),
        hidden: nextHidden,
        custom: prev.custom.filter((c) => !idsToRemove.has(c.id)),
      }
    })
  }

  const handleDeleteSection = (sectionIndex: number) => {
    if (sections <= 1) return
    let idsToRemove: string[] = []
    if (board) {
      idsToRemove = sectionOrders[sectionIndex] ?? []
    } else if (fallbackEdits) {
      idsToRemove = fallbackEdits.sectionOrders[sectionIndex] ?? []
    }
    if (idsToRemove.length > 0 && !confirm('Удалить все аппараты в отсеке?')) return
    const idsSet = new Set(idsToRemove)

    if (board) {
      const nextOrders = sectionOrders.filter((_, i) => i !== sectionIndex)
      setSectionOrders(nextOrders)
      board.components = board.components.filter((c) => !idsSet.has(c.id))
      setSections((n) => n - 1)
      engineRef.current?.notifyChanged()
      return
    }

    setFallbackEdits((prev) => {
      if (!prev) return null
      const nextHidden = new Set(prev.hidden)
      idsToRemove.forEach((id) => nextHidden.add(id))
      return {
        ...prev,
        sectionOrders: prev.sectionOrders.filter((_, i) => i !== sectionIndex),
        sections: prev.sections - 1,
        hidden: nextHidden,
        custom: prev.custom.filter((c) => !idsSet.has(c.id)),
      }
    })
    setSections((n) => n - 1)
  }

  const canDrag = board || fallbackEdits !== null

  const handleAddDevice = (rowId: string, option: DeviceOption) => {
    const section = parseSectionFromRowId(rowId)
    const rowIndex = parseRowIndexFromRowId(rowId, rowGroups)
    const sectionRows = rowGroups[section] ?? []
    let insertIndex = 0
    for (const row of sectionRows) {
      if (row.index < rowIndex) {
        insertIndex += row.devices.length
      } else {
        break
      }
    }

    const id = `device-${crypto.randomUUID()}`
    if (board) {
      const width = getWidthForBoard(option, board.phases)
      const comp: BoardComponent = {
        id,
        type: option.type as BoardComponent['type'],
        name: option.name,
        widthModules: width,
        ratingA: option.ratingA,
        characteristic: option.characteristic,
        rcdType: option.rcdType,
        rcdMA: option.rcdMA,
        phase: 'L1',
        circuitIds: [],
      }
      const globalPos = sectionOrders.slice(0, section).reduce((sum, sec) => sum + sec.length, 0) + insertIndex
      const next = [...board.components]
      next.splice(globalPos, 0, comp)
      board.components = next
      setSectionOrders((prev) => {
        const nextOrders = prev.map((sec) => [...sec])
        nextOrders[section]!.splice(insertIndex, 0, id)
        return nextOrders
      })
      engineRef.current?.notifyChanged()
    } else if (fallbackEdits) {
      const width = option.baseWidth
      const customDevice: PanelDevice = {
        id,
        type: option.type,
        name: option.name,
        width,
        rating: option.ratingA ?? 0,
        color: deviceColor(option.type),
      }
      setFallbackEdits((prev) => {
        if (!prev) return null
        const nextOrders = prev.sectionOrders.map((sec) => [...sec])
        nextOrders[section]!.splice(insertIndex, 0, id)
        return { ...prev, sectionOrders: nextOrders, custom: [...prev.custom, customDevice] }
      })
    }
    setMenuRowId(null)
  }

  const handlePointerDown = (deviceId: string) => (e: React.PointerEvent) => {
    if (!canDrag) return
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    dragElRef.current = el
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    setDragId(deviceId)
  }

  useEffect(() => {
    if (!dragId || !canDrag) return
    const handleMove = (e: PointerEvent) => {
      const target = getDropTargetSection(e.clientX, e.clientY, displayRowGroups, rowRefs.current, dragId)
      if (!target) return
      if (board) {
        setSectionOrders((prev) => moveIdInSection(prev, dragId, target.sectionIndex, target.index))
      } else {
        setFallbackEdits((prev) => {
          if (!prev) return null
          return {
            ...prev,
            sectionOrders: moveIdInSection(prev.sectionOrders, dragId, target.sectionIndex, target.index),
          }
        })
      }
    }
    const handleUp = (e: PointerEvent) => {
      if (dragElRef.current) {
        try {
          dragElRef.current.releasePointerCapture(e.pointerId)
        } catch {
          // ignore
        }
      }
      dragElRef.current = null
      setDragId(null)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [dragId, canDrag, board, displayRowGroups])

  if (!open) return null

  const components = board?.components ?? []

  return (
    <div className="fixed inset-0 z-[400] bg-black/35">
      <div
        className="absolute flex flex-col overflow-hidden rounded-lg bg-white dark:bg-gray-800"
        style={{
          left: dialogPos?.left,
          top: dialogPos?.top,
          width: dialogSize?.width,
          height: dialogSize?.height,
          minWidth: 640,
          minHeight: 400,
          maxWidth: '95vw',
          maxHeight: '95vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          onPointerDown={handleDragStart}
          className="flex cursor-move items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-600"
        >
          <span className="text-lg font-semibold text-gray-900 dark:text-white">Визуализация щита</span>
          <button
            onClick={() => setOpen(false)}
            onPointerDown={(e) => e.stopPropagation()}
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
              title="Набор"
            >
              <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('basket') }} />
              <span className="project-sidebar-label">Набор</span>
            </button>
          </div>

          {/* Основная область */}
          <div
            className="flex-1 overflow-auto rounded-bl-lg bg-gray-50 p-4 dark:bg-gray-900"
            onWheel={handleWheel}
            style={{ position: 'relative' }}
          >
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
              {activeTab === 'editor' ? (
                displayRowGroups.length > 0 ? (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Использовано модулей: {totalUsed} / {totalModules}
                      {board && (
                        <span className="ml-2">
                          · {board.phases === 'three' ? '3-ф' : '1-ф'} · {board.voltage}В · {board.totalPowerW.toFixed(0)}Вт
                        </span>
                      )}
                    </div>

                    {sections > 1 && (
                      <div className="flex gap-4">
                        {Array.from({ length: sections }, (_, s) => (
                          <div
                            key={s}
                            className="flex min-w-0 flex-1 items-center justify-center gap-1 text-center text-xs font-semibold text-gray-700 dark:text-gray-300"
                          >
                            <span>Отсек {s + 1}</span>
                            <button
                              onClick={() => handleDeleteSection(s)}
                              disabled={sections <= 1}
                              className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] leading-none text-red-500 hover:bg-red-50 hover:text-red-600 disabled:text-gray-300 dark:hover:bg-red-900/20 dark:disabled:text-gray-600"
                              title="Удалить отсек"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {displayRowGroups.map((rowGroup, rgIdx) => (
                      <div key={rgIdx} className="space-y-2">
                        <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          <span>Рейка {rgIdx + 1}</span>
                          <button
                            onClick={() => handleDeleteRow(rgIdx, rowGroup)}
                            className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] leading-none text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                            title="Удалить рейку"
                          >
                            ×
                          </button>
                        </div>
                        <div className="flex gap-4">
                          {rowGroup.map((rail) => (
                            <div key={rail.id} className="min-w-0 flex-1">
                              <div
                                ref={(el) => {
                                  rowRefs.current[rail.id] = el
                                }}
                                className="flex min-h-[60px] gap-1 rounded border border-dashed border-transparent p-1 hover:border-gray-200 dark:hover:border-gray-600"
                                data-row-id={rail.id}
                              >
                                {rail.devices.map((device) => (
                                  <div
                                    key={device.id}
                                    data-device-id={device.id}
                                    onPointerDown={handlePointerDown(device.id)}
                                    className={`group relative flex cursor-grab flex-col items-center justify-center rounded border p-2 text-center touch-none select-none ${device.color} ${dragId === device.id ? 'opacity-60' : ''}`}
                                    style={{ width: `${device.width * MODULE_WIDTH + (device.width - 1) * MODULE_GAP}px` }}
                                    title={`${device.name} (${device.rating}А)`}
                                  >
                                    <button
                                      onPointerDown={(e) => e.stopPropagation()}
                                      onClick={() => handleDeleteDevice(device.id)}
                                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] leading-none text-white opacity-0 hover:bg-red-600 group-hover:opacity-100"
                                      title="Удалить"
                                    >
                                      ×
                                    </button>
                                    <div className="flex h-6 items-center justify-center text-gray-900 dark:text-white">
                                      <DeviceIcon type={device.type} />
                                    </div>
                                    <div className="text-[10px] text-gray-600 dark:text-gray-400">
                                      {device.rating > 0 ? `${device.rating}A` : ''}
                                    </div>
                                    <div className="mt-1 max-w-full truncate text-[9px] text-gray-500 dark:text-gray-400">
                                      {device.name}
                                    </div>
                                  </div>
                                ))}

                                <div className="relative ml-1 self-stretch">
                                  <button
                                    onClick={() => setMenuRowId(rail.id)}
                                    className="flex h-full w-8 flex-none items-center justify-center rounded border border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:bg-gray-700"
                                    title="Добавить аппарат"
                                  >
                                    +
                                  </button>
                                  {menuRowId === rail.id && (
                                    <>
                                      <div
                                        className="fixed inset-0 z-[410]"
                                        onClick={() => setMenuRowId(null)}
                                      />
                                      <div className="absolute left-0 top-full z-[420] mt-1 w-56 rounded border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                                        {DEVICE_CATALOG.map((option) => (
                                          <button
                                            key={option.name}
                                            onClick={() => handleAddDevice(rail.id, option)}
                                            className="w-full rounded px-2 py-1 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                                          >
                                            {option.name}
                                          </button>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setExtraRowIds((prev) => [...prev, String(nextExtraIdRef.current++)])
                        }
                        className="flex-1 rounded border border-dashed border-gray-300 py-2 text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-700"
                      >
                        + Добавить рейку
                      </button>
                      <button
                        onClick={() => setSections((n) => n + 1)}
                        className="flex-1 rounded border border-dashed border-gray-300 py-2 text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-700"
                      >
                        + Добавить отсек
                      </button>
                    </div>
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

            <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 shadow-sm dark:border-gray-600 dark:bg-gray-800">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
                className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                title="Уменьшить"
              >
                −
              </button>
              <span className="min-w-[3rem] text-center text-xs text-gray-700 dark:text-gray-300">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(2))))}
                className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                title="Увеличить"
              >
                +
              </button>
              <button
                onClick={() => setZoom(1)}
                className="flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                title="Сбросить масштаб"
              >
                ↺
              </button>
            </div>
          </div>
        </div>

        <div
          onPointerDown={handleResizeStart('nw')}
          className="absolute left-1 top-1 z-20 cursor-nwse-resize text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          title="Изменить размер"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 rotate-180" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M20 4 L20 20 L4 20" />
            <path d="M20 10 L10 20" />
          </svg>
        </div>
        <div
          onPointerDown={handleResizeStart('se')}
          className="absolute bottom-1 right-1 z-20 cursor-nwse-resize text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          title="Изменить размер"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M20 4 L20 20 L4 20" />
            <path d="M20 10 L10 20" />
          </svg>
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

function getDropTargetSection(
  clientX: number,
  clientY: number,
  displayRowGroups: PanelRow[][],
  rowRefs: Record<string, HTMLDivElement | null>,
  _dragId: string,
): { sectionIndex: number; index: number } | null {
  let targetRail: PanelRow | null = null
  let targetEl: HTMLDivElement | null = null
  for (const group of displayRowGroups) {
    for (const rail of group) {
      const el = rowRefs[rail.id]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        targetRail = rail
        targetEl = el
        break
      }
    }
    if (targetRail) break
  }
  if (!targetRail || !targetEl) return null

  const rect = targetEl.getBoundingClientRect()
  const relX = clientX - rect.left
  let index = 0
  let x = 0
  for (const device of targetRail.devices) {
    const w = device.width * MODULE_WIDTH + (device.width - 1) * MODULE_GAP
    if (relX < x + w / 2) break
    x += w + MODULE_GAP
    index++
  }

  let sectionOrderIndex = 0
  const section = targetRail.section ?? 0
  for (const group of displayRowGroups) {
    const rail = group[section]
    if (!rail) continue
    if (rail.index < targetRail.index) {
      sectionOrderIndex += rail.devices.length
    } else if (rail.index === targetRail.index) {
      sectionOrderIndex += index
      break
    }
  }
  return { sectionIndex: section, index: sectionOrderIndex }
}

function moveIdInSection(
  orders: string[][],
  dragId: string,
  targetSection: number,
  targetIndex: number,
): string[][] {
  const sourceSection = orders.findIndex((sec) => sec.includes(dragId))
  if (sourceSection === -1) return orders
  if (sourceSection === targetSection) {
    const currentIndex = orders[sourceSection]!.indexOf(dragId)
    if (targetIndex === currentIndex) return orders
  }
  const next = orders.map((sec) => [...sec])
  next[sourceSection] = next[sourceSection]!.filter((id) => id !== dragId)
  let insertAt = targetIndex
  if (sourceSection === targetSection) {
    const currentIndex = orders[sourceSection]!.indexOf(dragId)
    if (targetIndex > currentIndex) insertAt = targetIndex - 1
  }
  insertAt = Math.max(0, Math.min(insertAt, next[targetSection]!.length))
  next[targetSection]!.splice(insertAt, 0, dragId)
  return next
}

function adjustSectionOrders(orders: string[][], sections: number): string[][] {
  const current = orders.length
  if (sections > current) {
    return [...orders, ...Array.from({ length: sections - current }, () => [])]
  }
  if (sections < current) {
    const removed = orders.slice(sections).flat()
    const next = orders.slice(0, sections)
    next[0] = [...(next[0] ?? []), ...removed]
    return next
  }
  return orders
}

function parseSectionFromRowId(rowId: string): number {
  const match = rowId.match(/section-(\d+)/)
  return match ? parseInt(match[1]!, 10) : 0
}

function parseRowIndexFromRowId(rowId: string, rowGroups: PanelRow[][]): number {
  const rowMatch = rowId.match(/row-(\d+)/)
  if (rowMatch) return parseInt(rowMatch[1]!, 10)
  const extraMatch = rowId.match(/extra-(\d+)/)
  if (extraMatch) {
    const maxRows = Math.max(...rowGroups.map((g) => g.length), 0)
    return maxRows + parseInt(extraMatch[1]!, 10)
  }
  return 0
}

function deviceColor(type: string): string {
  if (type === 'input-breaker') return 'border-red-400 bg-red-100 dark:border-red-600 dark:bg-red-900/30'
  if (type === 'breaker') return 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20'
  if (type === 'rcd') return 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
  if (type === 'busbar') return 'border-gray-400 bg-gray-200 dark:border-gray-500 dark:bg-gray-600'
  return 'border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-700'
}

function adaptPanel(raw: {
  usedModules: number
  totalModules: number
  rows: Array<{
    id: string
    index: number
    devices: Array<{ id: string; type: string; name: string; width: number; rating: number }>
  }>
}) {
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
