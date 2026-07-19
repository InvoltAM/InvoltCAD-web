'use client'

import { useEffect, useRef } from 'react'
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

export default function PlanEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<CanvasEngine | null>(null)
  const themeManagerRef = useRef<ThemeManager | null>(null)

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
      const validation = plan.validate()
      useCadStore.getState().setValidationIssues(validation.issues)
      projectSync.scheduleSave(plan)
    }

    engine.setTool(currentTool)

    // Для отладки
    // @ts-expect-error — добавляем глобальную переменную для отладки
    window.__engine = engine

    return () => {
      engine.destroy()
      engineRef.current = null
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
    <EditorProvider engineRef={engineRef} themeManagerRef={themeManagerRef}>
      <div className="relative h-full w-full">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none"
        />
        <Toolbar />
        <PropertyPanel />
        <LayersPanel />
        <SpecPanel />
        <ValidationPanel />
        <MobileMenu />
        <ProjectsPanel />
        <CableJournalPanel />
        <OlsPanel />
        <PanelEditor />
      </div>
    </EditorProvider>
  )
}
