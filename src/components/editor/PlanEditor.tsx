'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CanvasEngine } from '@core/engine/CanvasEngine'
import { Plan } from '@core/model/Plan'
import { WallTool } from '@core/tools/WallTool'
import { DoorTool } from '@core/tools/DoorTool'
import { WindowTool } from '@core/tools/WindowTool'
import { SelectTool } from '@core/tools/SelectTool'
import { DeviceTool } from '@core/tools/DeviceTool'
import { CableTool } from '@core/tools/CableTool'
import { DimensionTool } from '@core/tools/DimensionTool'
import { ThemeManager } from '@core/editor/ThemeManager'
import { useCadStore } from '@/stores/cadStore'
import { EditorProvider } from './EditorContext'
import { projectSync } from '@/lib/projects/sync'
import { realtimeSync } from '@/lib/projects/realtime'
import Toolbar from './Toolbar'
import PropertyPanel from './PropertyPanel'
import LayersPanel from './LayersPanel'
import SpecPanel from './SpecPanel'
import ValidationPanel from './ValidationPanel'
import MobileMenu from './MobileMenu'
import ProjectsPanel from './ProjectsPanel'
import CableJournalPanel from './CableJournalPanel'
import SheetCablesPanel from './SheetCablesPanel'
import OlsPanel from './OlsPanel'
import PanelEditor from './PanelEditor'
import RoomsPanel from './RoomsPanel'
import RoomNumbersPanel from './RoomNumbersPanel'
import CatalogPanel from './CatalogPanel'
import EstimatesPanel from './EstimatesPanel'
import InvoicesPanel from './InvoicesPanel'
import DocumentsPanel from './DocumentsPanel'
import MarkingPanel from './MarkingPanel'
import AutomationPanel from './AutomationPanel'
import TemplatesPanel from './TemplatesPanel'
import { PanelManager } from './PanelManager'
import { SheetsBar } from './SheetsBar'
import { icon } from './icons'

export default function PlanEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<CanvasEngine | null>(null)
  const themeManagerRef = useRef<ThemeManager | null>(null)
  const panelManagerRef = useRef<PanelManager | null>(null)
  const sheetsBarRef = useRef<SheetsBar | null>(null)
  const [panelBodies, setPanelBodies] = useState<{
    property: HTMLElement | null
    layers: HTMLElement | null
    spec: HTMLElement | null
    sheetCables: HTMLElement | null
    validation: HTMLElement | null
    cableJournal: HTMLElement | null
    roomNumbers: HTMLElement | null
  }>({ property: null, layers: null, spec: null, sheetCables: null, validation: null, cableJournal: null, roomNumbers: null })

  const currentTool = useCadStore((s) => s.currentTool)
  const theme = useCadStore((s) => s.theme)
  const selectedWallId = useCadStore((s) => s.selectedWallId)
  const selectedOpeningId = useCadStore((s) => s.selectedOpeningId)
  const selectedDeviceId = useCadStore((s) => s.selectedDeviceId)
  const selectedCableId = useCadStore((s) => s.selectedCableId)
  const selectedDimensionId = useCadStore((s) => s.selectedDimensionId)
  const selectedRoomIndex = useCadStore((s) => s.selectedRoomIndex)

  // Инициализация движка
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const plan = new Plan()
    const themeManager = new ThemeManager(theme)
    themeManagerRef.current = themeManager

    const engine = new CanvasEngine(canvas, plan, themeManager)
    engineRef.current = engine

    // Синхронизируем начальное состояние cadStore -> EditorState
    const initial = useCadStore.getState()
    engine.editorState.set('orthoMode', initial.orthoMode)
    engine.editorState.set('deviceIconScale', initial.deviceIconScale)
    engine.editorState.set('selectedDeviceType', initial.selectedDeviceType)
    engine.editorState.set('wallThickness', initial.wallThickness)
    engine.editorState.set('doorWidth', initial.doorWidth)
    engine.editorState.set('windowWidth', initial.windowWidth)
    engine.editorState.set('defaultCableType', initial.defaultCableType)
    engine.editorState.set('defaultCableSection', initial.defaultCableSection)
    engine.editorState.set('layers', initial.layers)
    engine.editorState.set('snap', initial.snap)

    // Подписка на изменения cadStore, чтобы инструменты всегда видели актуальные значения
    const syncKeys: Array<keyof typeof initial & string> = [
      'orthoMode',
      'deviceIconScale',
      'selectedDeviceType',
      'wallThickness',
      'doorWidth',
      'windowWidth',
      'defaultCableType',
      'defaultCableSection',
      'layers',
      'snap',
    ]
    const unsubscribe = useCadStore.subscribe((state, prevState) => {
      for (const key of syncKeys) {
        if (state[key as keyof typeof state] !== prevState[key as keyof typeof prevState]) {
          engine.editorState.set(
            key as Parameters<typeof engine.editorState.set>[0],
            state[key as keyof typeof state] as never
          )
        }
      }
    })

    // Регистрация инструментов
    const wallTool = new WallTool(engine, plan, engine.snapEngine)
    const doorTool = new DoorTool(engine, plan, engine.snapEngine)
    const windowTool = new WindowTool(engine, plan, engine.snapEngine)
    const selectTool = new SelectTool(engine, plan, engine.snapEngine)
    const deviceTool = new DeviceTool(engine, plan, engine.snapEngine)
    const cableTool = new CableTool(engine, plan)
    const dimensionTool = new DimensionTool(engine, plan, engine.snapEngine)

    engine.registerTool('wall', wallTool)
    engine.registerTool('door', doorTool)
    engine.registerTool('window', windowTool)
    engine.registerTool('select', selectTool)
    engine.registerTool('device', deviceTool)
    engine.registerTool('cable', cableTool)
    engine.registerTool('dimension', dimensionTool)

    // Инструмент "Рука"
    engine.toolManager.register({
      name: 'hand',
      onActivate() {
        engine.setGhost(null)
      },
    })

    // Подписка на изменения плана для валидации и автосохранения
    engine.onChange = () => {
      const rooms = plan.getRooms()
      const issues: import('@core/rules/ValidationTypes').ValidationIssue[] = rooms.length === 0
        ? [{
            id: 'plan-no-rooms',
            type: 'plan',
            severity: 'error',
            message: 'План не содержит замкнутых комнат. Проверьте, что стены образуют замкнутые контуры.',
          }]
        : []
      useCadStore.getState().setValidationIssues(issues)
      sheetsBarRef.current?.refresh()
      projectSync.scheduleSave(plan)
    }

    engine.setTool(currentTool)

    // Для отладки
    // @ts-expect-error — добавляем глобальную переменную для отладки
    window.__engine = engine

    // Инициализация плавающих панелей и листов
    const app = document.getElementById('app')
    if (app) {
      // Сначала создаём панель листов, чтобы PanelManager мог избегать её области
      sheetsBarRef.current = new SheetsBar(plan, engine, themeManager, app)

      // Создаём тела плавающих панелей
      const propertyBody = document.createElement('div')
      const layersBody = document.createElement('div')
      const specBody = document.createElement('div')
      const sheetCablesBody = document.createElement('div')
      const validationBody = document.createElement('div')
      const cableJournalBody = document.createElement('div')
      const roomNumbersBody = document.createElement('div')

      panelManagerRef.current = new PanelManager(
        [
          { id: 'properties', title: 'Свойства', icon: icon('properties'), body: propertyBody },
          { id: 'layers', title: 'Слои', icon: icon('layers'), body: layersBody },
          { id: 'spec', title: 'Спецификация листа', icon: icon('spec'), body: specBody },
          { id: 'sheetCables', title: 'Кабели', icon: icon('cable'), body: sheetCablesBody, width: 400 },
          { id: 'validation', title: 'Проверка', icon: icon('properties'), body: validationBody },
          {
            id: 'cableJournal',
            title: 'Кабельный журнал',
            icon: icon('cable'),
            body: cableJournalBody,
            width: 1200,
            height: 500,
            menuVisible: false,
            onVisibilityChange: (visible) => useCadStore.getState().setCableJournalOpen(visible),
          },
          { id: 'roomNumbers', title: '№ помещения', icon: icon('roomNumbers'), body: roomNumbersBody, width: 360 },
        ],
        app,
        sheetsBarRef.current.element
      )

      // Кабельный журнал по умолчанию скрыт, открывается только кнопкой КЖ
      panelManagerRef.current.hide('cableJournal')

      // Рендерим React-компоненты внутри плавающих панелей через порталы
      setPanelBodies({
        property: propertyBody,
        layers: layersBody,
        spec: specBody,
        sheetCables: sheetCablesBody,
        validation: validationBody,
        cableJournal: cableJournalBody,
        roomNumbers: roomNumbersBody,
      })
    }

    return () => {
      unsubscribe()
      setPanelBodies({ property: null, layers: null, spec: null, sheetCables: null, validation: null, cableJournal: null, roomNumbers: null })
      engine.destroy()
      engineRef.current = null
      panelManagerRef.current?.destroy()
      panelManagerRef.current = null
      sheetsBarRef.current = null
      realtimeSync.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Real-time синхронизация совместного доступа
  useEffect(() => {
    const projectId = projectSync.getCurrentProjectId()
    if (!projectId) return

    realtimeSync.start({
      projectId,
      onUpdate: (plan) => {
        const engine = engineRef.current
        if (!engine) return
        engine.plan = plan
        engine.notifyChanged()
        engine.requestRender()
      },
      onError: (error) => {
        console.error('Ошибка real-time синхронизации:', error)
      },
    })

    return () => {
      realtimeSync.stop()
    }
  }, [])

  // Переключение инструмента
  useEffect(() => {
    engineRef.current?.setTool(currentTool)
  }, [currentTool])

  // Переключение темы
  useEffect(() => {
    themeManagerRef.current?.setTheme(theme)
    document.documentElement.dataset.theme = theme
    engineRef.current?.requestRender()
  }, [theme])

  // Синхронизация выделения cadStore -> engine
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.setSelectedWall(selectedWallId)
    engine.setSelectedOpening(selectedOpeningId)
    engine.setSelectedDevice(selectedDeviceId)
    engine.setSelectedCable(selectedCableId)
    engine.setSelectedDimension(selectedDimensionId)
    engine.setSelectedRoom(selectedRoomIndex)
  }, [selectedWallId, selectedOpeningId, selectedDeviceId, selectedCableId, selectedDimensionId, selectedRoomIndex])

  // Синхронизация выделения engine -> cadStore (чтобы панели реагировали на клики в canvas)
  // Для мультивыделения рамкой обновляем cadStore только если выбран не более чем один объект данного типа.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const subs = [
      engine.editorState.subscribe('selectedWallIds', (ids) => {
        if (ids.length <= 1) useCadStore.getState().setSelectedWall(ids[0] ?? null)
      }),
      engine.editorState.subscribe('selectedOpeningIds', (ids) => {
        if (ids.length <= 1) useCadStore.getState().setSelectedOpening(ids[0] ?? null)
      }),
      engine.editorState.subscribe('selectedDeviceIds', (ids) => {
        if (ids.length <= 1) useCadStore.getState().setSelectedDevice(ids[0] ?? null)
      }),
      engine.editorState.subscribe('selectedCableIds', (ids) => {
        if (ids.length <= 1) useCadStore.getState().setSelectedCable(ids[0] ?? null)
      }),
      engine.editorState.subscribe('selectedDimensionIds', (ids) => {
        if (ids.length <= 1) useCadStore.getState().setSelectedDimension(ids[0] ?? null)
      }),
      engine.editorState.subscribe('selectedRoomIndices', (indices) => {
        if (indices.length <= 1) useCadStore.getState().setSelectedRoom(indices[0] ?? null)
      }),
    ]
    return () => subs.forEach((unsub) => unsub())
  }, [])

  return (
    <EditorProvider engineRef={engineRef} themeManagerRef={themeManagerRef} panelManagerRef={panelManagerRef}>
      <div className="relative h-full w-full">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none"
        />
        <Toolbar />
        <MobileMenu />
        <ProjectsPanel />
        <OlsPanel />
        <PanelEditor />
        <RoomsPanel />
        <CatalogPanel />
        <EstimatesPanel />
        <InvoicesPanel />
        <DocumentsPanel />
        <MarkingPanel />
        <AutomationPanel />
        <TemplatesPanel />
        {panelBodies.property && createPortal(<PropertyPanel />, panelBodies.property)}
        {panelBodies.layers && createPortal(<LayersPanel />, panelBodies.layers)}
        {panelBodies.spec && createPortal(<SpecPanel />, panelBodies.spec)}
        {panelBodies.sheetCables && createPortal(<SheetCablesPanel />, panelBodies.sheetCables)}
        {panelBodies.validation && createPortal(<ValidationPanel />, panelBodies.validation)}
        {panelBodies.cableJournal && createPortal(<CableJournalPanel />, panelBodies.cableJournal)}
        {panelBodies.roomNumbers && createPortal(<RoomNumbersPanel />, panelBodies.roomNumbers)}
      </div>
    </EditorProvider>
  )
}
