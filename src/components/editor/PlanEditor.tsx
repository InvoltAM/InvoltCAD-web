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
import OlsPanel from './OlsPanel'
import PanelEditor from './PanelEditor'
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
  }>({ property: null, layers: null, spec: null })

  const currentTool = useCadStore((s) => s.currentTool)
  const theme = useCadStore((s) => s.theme)

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
    engine.editorState.set('orthoMode', useCadStore.getState().orthoMode)

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
      projectSync.scheduleSave(plan)
    }

    engine.setTool(currentTool)

    // Для отладки
    // @ts-expect-error — добавляем глобальную переменную для отладки
    window.__engine = engine

    // Инициализация плавающих панелей и листов
    const app = document.getElementById('app')
    if (app) {
      // Создаём панели для PanelManager
      const propertyBody = document.createElement('div')
      const layersBody = document.createElement('div')
      const specBody = document.createElement('div')

      panelManagerRef.current = new PanelManager([
        { id: 'properties', title: 'Свойства', icon: icon('properties'), body: propertyBody },
        { id: 'layers', title: 'Слои', icon: icon('layers'), body: layersBody },
        { id: 'spec', title: 'Спецификация', icon: icon('spec'), body: specBody },
      ], app)

      sheetsBarRef.current = new SheetsBar(plan, engine, app)

      // Рендерим React-компоненты внутри плавающих панелей через порталы
      setPanelBodies({ property: propertyBody, layers: layersBody, spec: specBody })
    }

    return () => {
      setPanelBodies({ property: null, layers: null, spec: null })
      engine.destroy()
      engineRef.current = null
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

  return (
    <EditorProvider engineRef={engineRef} themeManagerRef={themeManagerRef} panelManagerRef={panelManagerRef}>
      <div className="relative h-full w-full">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none"
        />
        <Toolbar />
        <ValidationPanel />
        <MobileMenu />
        <ProjectsPanel />
        <CableJournalPanel />
        <OlsPanel />
        <PanelEditor />
        {panelBodies.property && createPortal(<PropertyPanel />, panelBodies.property)}
        {panelBodies.layers && createPortal(<LayersPanel />, panelBodies.layers)}
        {panelBodies.spec && createPortal(<SpecPanel />, panelBodies.spec)}
      </div>
    </EditorProvider>
  )
}
