/* eslint-disable react-hooks/immutability -- редактор работает через мутации плана по дизайну */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from './EditorContext'
import { useCadStore } from '@/stores/cadStore'
import { Plan } from '@core/model/Plan'
import { generatePanelDevices, layoutPanel } from '@core/panels/panelModel'
import { DistributionBoardData, BoardComponent } from '@core/electrical/BoardEngine'
import { icon } from './icons'

const MODULE_WIDTH = 18 // ширина одного модуля, мм
const MODULE_GAP = 0 // зазор между модулями, мм
const RAIL_MODULES = 12
const RAIL_HEIGHT_MM = 80 // высота рейки/устройств, мм
const RAIL_CENTER_SPACING_MM = 125 // расстояние между центральными осями реек, мм

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
  category?: string
}

interface DeviceCategory {
  id: string
  label: string
  icon: Parameters<typeof icon>[0]
}

const PANEL_CATEGORIES: DeviceCategory[] = [
  { id: 'panel', label: 'Щиты', icon: 'panel' },
  { id: 'smartHome', label: 'УД', icon: 'smartHome' },
  { id: 'terminal', label: 'Клеммы', icon: 'terminal' },
  { id: 'automation', label: 'Автоматика', icon: 'automation' },
  { id: 'contactor', label: 'Контакторы', icon: 'contactor' },
  { id: 'bus', label: 'Шины', icon: 'bus' },
  { id: 'relay', label: 'Реле', icon: 'relay' },
  { id: 'psu', label: 'БП', icon: 'psu' },
]

const DEVICE_CATALOG: DeviceOption[] = [
  { category: 'automation', type: 'breaker', name: 'Автомат 16А', baseWidth: 1, ratingA: 16, characteristic: 'C' },
  { category: 'automation', type: 'breaker', name: 'Автомат 25А', baseWidth: 1, ratingA: 25, characteristic: 'C' },
  { category: 'automation', type: 'breaker', name: 'Автомат 32А', baseWidth: 1, ratingA: 32, characteristic: 'C' },
  { category: 'automation', type: 'breaker', name: 'Автомат 40А', baseWidth: 1, ratingA: 40, characteristic: 'C' },
  { category: 'automation', type: 'rcd', name: 'УЗО 25А 30мА', baseWidth: 2, ratingA: 25, rcdType: 'A', rcdMA: 30 },
  { category: 'automation', type: 'rcd', name: 'УЗО 40А 30мА', baseWidth: 2, ratingA: 40, rcdType: 'A', rcdMA: 30 },
  { category: 'automation', type: 'rcd', name: 'УЗО 63А 30мА', baseWidth: 2, ratingA: 63, rcdType: 'A', rcdMA: 30 },
  { category: 'contactor', type: 'contactor', name: 'Контактор 25А', baseWidth: 2, ratingA: 25 },
  { category: 'bus', type: 'bus', name: 'Шина N', baseWidth: 2 },
  { category: 'bus', type: 'bus', name: 'Шина PE', baseWidth: 2 },
  { category: 'terminal', type: 'blank', name: 'Заглушка', baseWidth: 1 },
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
  const [activeTab, setActiveTab] = useState<'editor' | 'basket' | 'devices'>('editor')
  const [catalogCategory, setCatalogCategory] = useState<string | null>(null)
  const [catalogDevice, setCatalogDevice] = useState<DeviceOption | null>(null)
  const [sections, setSections] = useState(1)
  const [sectionOrders, setSectionOrders] = useState<string[][][]>([])
  const [fallbackEdits, setFallbackEdits] = useState<{
    hidden: Set<string>
    custom: PanelDevice[]
    sections: number
    sectionOrders: string[][][]
  } | null>(null)
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
  const dialogRef = useRef<HTMLDivElement | null>(null)
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

  useEffect(() => {
    if (!open) return
    const el = dialogRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom((z) => Math.min(3, Math.max(0.5, Number((z + delta).toFixed(2)))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [open])

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
      setSectionOrders([
        splitIntoRows(
          board.components.map((c) => c.id),
          board.components,
          RAIL_MODULES,
        ).map((row) => row.devices.map((d) => d.id)),
      ])
      setFallbackEdits(null)
      return
    }
    if (!fallbackPanel) return
    const baseRows = fallbackPanel.rows.map((r) => r.devices.map((d) => d.id))
    setFallbackEdits((prev) => {
      const sectionOrders = prev?.sectionOrders ?? [baseRows]
      const hidden = prev?.hidden ?? new Set<string>()
      const custom = prev?.custom ?? []
      const baseIds = baseRows.flat()
      const visibleRows = sectionOrders[0]?.map((row) =>
        row.filter(
          (id) => (baseIds.includes(id) || custom.some((d) => d.id === id)) && !hidden.has(id),
        ),
      ) ?? [[]]
      const visibleIds = new Set(visibleRows.flat())
      const newIds = baseIds.filter((id) => !visibleIds.has(id))
      // Новые устройства добавляем в первую рейку первого отсека.
      return {
        sectionOrders: [[[...visibleRows[0]!, ...newIds], ...visibleRows.slice(1)]],
        hidden,
        custom,
        sections: 1,
      }
    })
    setSectionOrders([])
  }, [board, fallbackPanel])

  // Сбрасываем добавленные пустые рейки и отсеки при смене источника данных.
  useEffect(() => {
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
      const map = new Map(board.components.map((c) => [c.id, c]))
      return sectionOrders.map((sectionRows, s) =>
        sectionRows.map((rowIds, rowIndex) => ({
          id: `section-${s}-row-${rowIndex}`,
          index: rowIndex,
          section: s,
          devices: rowIds
            .map((id) => map.get(id))
            .filter((comp): comp is BoardComponent => !!comp)
            .map((comp) => ({
              id: comp.id,
              type: comp.type,
              name: comp.name,
              width: comp.widthModules,
              rating: comp.ratingA ?? 0,
              color: deviceColor(comp.type),
            })),
        })),
      )
    }
    if (!fallbackEdits) return []
    return fallbackEdits.sectionOrders.map((sectionRows, s) =>
      sectionRows.map((rowIds, rowIndex) => ({
        id: `section-${s}-row-${rowIndex}`,
        index: rowIndex,
        section: s,
        devices: rowIds
          .map((id) => fallbackDeviceMap.get(id))
          .filter((d): d is PanelDevice => !!d),
      })),
    )
  }, [board, sectionOrders, fallbackEdits, fallbackDeviceMap])

  const displayRowGroups = useMemo<PanelRow[][]>(() => {
    const maxRows = Math.max(...rowGroups.map((g) => g.length), 0)
    const groups: PanelRow[][] = []
    for (let i = 0; i < maxRows; i++) {
      const group: PanelRow[] = []
      for (let s = 0; s < sections; s++) {
        group.push(rowGroups[s]?.[i] ?? { id: `section-${s}-row-${i}`, index: i, section: s, devices: [] })
      }
      groups.push(group)
    }
    return groups
  }, [rowGroups, sections])

  const displayRows = useMemo<PanelRow[]>(() => displayRowGroups.flat(), [displayRowGroups])

  const totalUsed = useMemo(
    () => displayRows.reduce((sum, row) => sum + row.devices.reduce((s, d) => s + d.width, 0), 0),
    [displayRows],
  )
  const totalModules = sections * RAIL_MODULES * Math.max(displayRowGroups.length, 1)

  // Синхронизируем порядок компонентов доски с sectionOrders.
  useEffect(() => {
    if (!board) return
    const flatOrder = sectionOrders.flat(2)
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
      setSectionOrders((prev) => prev.map((sec) => sec.map((row) => row.filter((id) => id !== deviceId))))
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
    const rowIndex = rowGroup[0]?.index ?? 0
    const idsToRemove = new Set(rowGroup.flatMap((rail) => rail.devices.map((d) => d.id)))

    if (idsToRemove.size === 0) {
      // Удаляем пустую рейку из каждого отсека.
      if (board) {
        setSectionOrders((prev) => prev.map((sec) => sec.filter((_, idx) => idx !== rowIndex)))
      } else if (fallbackEdits) {
        setFallbackEdits((prev) => {
          if (!prev) return null
          return { ...prev, sectionOrders: prev.sectionOrders.map((sec) => sec.filter((_, idx) => idx !== rowIndex)) }
        })
      }
      return
    }

    if (!confirm('Удалить все аппараты на этой рейке?')) return

    if (board) {
      setSectionOrders((prev) => prev.map((sec) => sec.filter((_, idx) => idx !== rowIndex)))
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
        sectionOrders: prev.sectionOrders.map((sec) => sec.filter((_, idx) => idx !== rowIndex)),
        hidden: nextHidden,
        custom: prev.custom.filter((c) => !idsToRemove.has(c.id)),
      }
    })
  }

  const handleDeleteSection = (sectionIndex: number) => {
    if (sections <= 1) return
    let idsToRemove: string[] = []
    if (board) {
      idsToRemove = sectionOrders[sectionIndex]?.flat(2) ?? []
    } else if (fallbackEdits) {
      idsToRemove = fallbackEdits.sectionOrders[sectionIndex]?.flat(2) ?? []
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
      setSectionOrders((prev) => {
        const next = prev.map((sec) => sec.map((row) => [...row]))
        while (!next[section]) next.push([[]])
        while (next[section].length <= rowIndex) next[section].push([])
        next[section][rowIndex] = [...next[section][rowIndex]!, id]
        // Пересчитываем глобальную позицию в board.components.
        const globalPos =
          next.slice(0, section).flat(2).length +
          next[section].slice(0, rowIndex).flat().length +
          next[section][rowIndex].length -
          1
        const nextComponents = [...board.components]
        nextComponents.splice(globalPos, 0, comp)
        board.components = nextComponents
        return next
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
        const next = prev.sectionOrders.map((sec) => sec.map((row) => [...row]))
        while (!next[section]) next.push([[]])
        while (next[section].length <= rowIndex) next[section].push([])
        next[section][rowIndex] = [...next[section][rowIndex]!, id]
        return { ...prev, sectionOrders: next, custom: [...prev.custom, customDevice] }
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
        setSectionOrders((prev) => moveIdInSection(prev, dragId, target.sectionIndex, target.rowIndex, target.index))
      } else {
        setFallbackEdits((prev) => {
          if (!prev) return null
          return {
            ...prev,
            sectionOrders: moveIdInSection(prev.sectionOrders, dragId, target.sectionIndex, target.rowIndex, target.index),
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
        ref={dialogRef}
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
              onClick={() => { setActiveTab('editor'); setCatalogCategory(null) }}
              className={`project-sidebar-btn ${activeTab === 'editor' ? 'active' : ''}`}
              title="Редактор"
            >
              <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('panel') }} />
              <span className="project-sidebar-label">Щит</span>
            </button>
            <button
              onClick={() => { setActiveTab('devices'); setCatalogCategory(null) }}
              className={`project-sidebar-btn ${activeTab === 'devices' ? 'active' : ''}`}
              title="Устройства"
            >
              <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('device') }} />
              <span className="project-sidebar-label">Устройства</span>
            </button>
            <button
              onClick={() => { setActiveTab('basket'); setCatalogCategory(null) }}
              className={`project-sidebar-btn ${activeTab === 'basket' ? 'active' : ''}`}
              title="Набор из проекта"
            >
              <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('basket') }} />
              <span className="project-sidebar-label">Набор из проекта</span>
            </button>
          </div>

          {/* Основная область */}
          <div
            className="flex-1 overflow-auto rounded-bl-lg bg-gray-50 p-4 dark:bg-gray-900"
            style={{ position: 'relative' }}
          >
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
              {activeTab === 'editor' && (
                displayRowGroups.length > 0 ? (
                  <div className="space-y-4">
                    {catalogDevice && (
                      <div className="flex items-center justify-between rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                        <span>Выбрано устройство: <strong>{catalogDevice.name}</strong></span>
                        <button
                          onClick={() => setCatalogDevice(null)}
                          className="text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
                          title="Сбросить выбор"
                        >
                          ×
                        </button>
                      </div>
                    )}

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
                      <div
                        key={rgIdx}
                        style={{
                          marginBottom:
                            rgIdx === displayRowGroups.length - 1
                              ? undefined
                              : `${RAIL_CENTER_SPACING_MM - RAIL_HEIGHT_MM}mm`,
                        }}
                      >
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
                                className="flex items-center gap-0 rounded border border-dashed border-transparent p-1 hover:border-gray-200 dark:hover:border-gray-600"
                                style={{ width: `${RAIL_MODULES * MODULE_WIDTH}mm`, height: `${RAIL_HEIGHT_MM}mm` }}
                                data-row-id={rail.id}
                              >
                                {rail.devices.map((device) => (
                                  <div
                                    key={device.id}
                                    data-device-id={device.id}
                                    onPointerDown={handlePointerDown(device.id)}
                                    className={`group relative flex h-full cursor-grab flex-col items-center justify-center rounded border px-0.5 py-1 text-center touch-none select-none ${device.color} ${dragId === device.id ? 'opacity-60 pointer-events-none' : ''}`}
                                    style={{ width: `${device.width * MODULE_WIDTH + (device.width - 1) * MODULE_GAP}mm` }}
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
                                    onClick={() => {
                                      if (catalogDevice) {
                                        handleAddDevice(rail.id, catalogDevice)
                                      } else {
                                        setMenuRowId(rail.id)
                                      }
                                    }}
                                    className="flex h-full w-8 flex-none items-center justify-center rounded border border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:bg-gray-700"
                                    title={catalogDevice ? `Добавить ${catalogDevice.name}` : 'Добавить аппарат'}
                                  >
                                    {catalogDevice ? '→' : '+'}
                                  </button>
                                  {menuRowId === rail.id && !catalogDevice && (
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
                        onClick={() => {
                          if (board) {
                            setSectionOrders((prev) => prev.map((sec) => [...sec, []]))
                          } else if (fallbackEdits) {
                            setFallbackEdits((prev) => {
                              if (!prev) return null
                              return { ...prev, sectionOrders: prev.sectionOrders.map((sec) => [...sec, []]) }
                            })
                          }
                        }}
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
              )}

              {activeTab === 'basket' && (
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

              {activeTab === 'devices' && (
                <div className="space-y-3">
                  {catalogCategory === null ? (
                    <>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Категории устройств</div>
                      <div className="grid grid-cols-2 gap-2">
                        {PANEL_CATEGORIES.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => setCatalogCategory(cat.id)}
                            className="flex flex-col items-center gap-1 rounded border border-gray-200 bg-white p-3 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                            title={cat.label}
                          >
                            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon(cat.icon) }} />
                            <span>{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCatalogCategory(null)}
                          className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          ← Назад
                        </button>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {PANEL_CATEGORIES.find((c) => c.id === catalogCategory)?.label}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {DEVICE_CATALOG.filter((d) => d.category === catalogCategory).length === 0 ? (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            В этой категории пока нет устройств.
                          </div>
                        ) : (
                          DEVICE_CATALOG.filter((d) => d.category === catalogCategory).map((option) => (
                            <button
                              key={option.name}
                              onClick={() => {
                                setCatalogDevice(option)
                                setActiveTab('editor')
                                setCatalogCategory(null)
                              }}
                              className={`w-full rounded border p-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                catalogDevice?.name === option.name
                                  ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                                  : 'border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800'
                              }`}
                            >
                              <div className="font-medium text-gray-900 dark:text-white">{option.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {option.baseWidth} модуль
                              </div>
                            </button>
                          ))
                        )}
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
  dragId: string,
): { sectionIndex: number; rowIndex: number; index: number } | null {
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

  // Определяем позицию вставки по центрам устройств в DOM, а не по MODULE_WIDTH,
  // чтобы не расходиться с фактическим рендером (width задан в mm).
  const deviceEls = Array.from(targetEl.querySelectorAll('[data-device-id]')).filter(
    (el) => el.getAttribute('data-device-id') !== dragId,
  ) as HTMLElement[]
  let index = 0
  for (const deviceEl of deviceEls) {
    const rect = deviceEl.getBoundingClientRect()
    if (clientX < rect.left + rect.width / 2) break
    index++
  }

  return { sectionIndex: targetRail.section ?? 0, rowIndex: targetRail.index, index }
}

function moveIdInSection(
  orders: string[][][],
  dragId: string,
  targetSection: number,
  targetRow: number,
  targetIndex: number,
): string[][][] {
  let sourceSection = -1
  let sourceRow = -1
  let sourceIndex = -1
  for (let s = 0; s < orders.length; s++) {
    for (let r = 0; r < orders[s].length; r++) {
      const idx = orders[s][r].indexOf(dragId)
      if (idx !== -1) {
        sourceSection = s
        sourceRow = r
        sourceIndex = idx
        break
      }
    }
    if (sourceSection !== -1) break
  }
  if (sourceSection === -1) return orders

  const next = orders.map((sec) => sec.map((row) => [...row]))
  next[sourceSection][sourceRow].splice(sourceIndex, 1)

  let insertRow = targetRow
  let insertIndex = targetIndex
  if (sourceSection === targetSection && sourceRow === targetRow && targetIndex > sourceIndex) {
    insertIndex = targetIndex - 1
  }
  while (!next[targetSection]) next.push([[]])
  while (next[targetSection].length <= insertRow) next[targetSection].push([])
  insertIndex = Math.max(0, Math.min(insertIndex, next[targetSection][insertRow].length))
  next[targetSection][insertRow].splice(insertIndex, 0, dragId)
  return next
}

function adjustSectionOrders(orders: string[][][], sections: number): string[][][] {
  const current = orders.length
  if (sections > current) {
    return [...orders, ...Array.from({ length: sections - current }, () => [[]])]
  }
  if (sections < current) {
    const removed = orders.slice(sections).flat(1)
    const next = orders.slice(0, sections)
    if (removed.length > 0) {
      next[0] = [...next[0]!, ...removed]
    }
    return next
  }
  return orders
}

function parseSectionFromRowId(rowId: string): number {
  const match = rowId.match(/section-(\d+)/)
  return match ? parseInt(match[1]!, 10) : 0
}

function parseRowIndexFromRowId(rowId: string, _rowGroups: PanelRow[][]): number {
  const rowMatch = rowId.match(/row-(\d+)/)
  if (rowMatch) return parseInt(rowMatch[1]!, 10)
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
