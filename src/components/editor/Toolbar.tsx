'use client'

import { useState, useRef, useEffect } from 'react'
import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'
import type { ToolName } from '@core/tools/ToolManager'
import { Vector2 } from '@core/geometry/Vector2'
import { projectSync } from '@/lib/projects/sync'
import { PngExporter } from '@core/io/PngExporter'
import { PrintExporter } from '@core/io/PrintExporter'
import { icon } from './icons'

const tools: Array<{ name: ToolName; label: string; icon: string }> = [
  { name: 'wall', label: 'Стена', icon: icon('wall') },
  { name: 'door', label: 'Дверь', icon: icon('door') },
  { name: 'window', label: 'Окно', icon: icon('window') },
  { name: 'device', label: 'Устройство', icon: icon('device') },
  { name: 'cable', label: 'Кабель', icon: icon('cable') },
  { name: 'dimension', label: 'Размер', icon: icon('dimension') },
  { name: 'select', label: 'Выбор', icon: icon('select') },
  { name: 'hand', label: 'Рука', icon: icon('hand') },
]

export default function Toolbar() {
  const currentTool = useCadStore((s) => s.currentTool)
  const setTool = useCadStore((s) => s.setTool)
  const theme = useCadStore((s) => s.theme)
  const setTheme = useCadStore((s) => s.setTheme)
  const uiScale = useCadStore((s) => s.uiScale)
  const setUiScale = useCadStore((s) => s.setUiScale)
  const compactPanels = useCadStore((s) => s.compactPanels)
  const setCompactPanels = useCadStore((s) => s.setCompactPanels)
  const orthoMode = useCadStore((s) => s.orthoMode)
  const setOrthoMode = useCadStore((s) => s.setOrthoMode)
  const olsOpen = useCadStore((s) => s.olsOpen)
  const setOlsOpen = useCadStore((s) => s.setOlsOpen)
  const panelEditorOpen = useCadStore((s) => s.panelEditorOpen)
  const setPanelEditorOpen = useCadStore((s) => s.setPanelEditorOpen)
  const { engineRef, themeManagerRef, panelManagerRef } = useEditor()

  const [panelMenuOpen, setPanelMenuOpen] = useState(false)
  const [panelMenuPos, setPanelMenuPos] = useState({ x: 0, y: 0 })
  const [panelItems, setPanelItems] = useState<Array<{ id: string; title: string; icon: string; visible: boolean }>>([])
  const panelMenuBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!panelMenuOpen) return
    setPanelItems(panelManagerRef.current?.list() ?? [])
    const onDocClick = (e: MouseEvent) => {
      if (!panelMenuBtnRef.current?.contains(e.target as Node)) {
        setPanelMenuOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [panelMenuOpen, panelManagerRef])

  const handleTogglePanelMenu = () => {
    if (!panelManagerRef.current) return
    const rect = panelMenuBtnRef.current?.getBoundingClientRect()
    if (rect) {
      setPanelMenuPos({ x: rect.right + 8, y: rect.top })
    }
    setPanelMenuOpen((prev) => !prev)
  }

  const handleToggleCableJournal = () => {
    panelManagerRef.current?.toggle('cableJournal')
  }

  const handleToggleOls = () => {
    setOlsOpen(!olsOpen)
  }

  const handleTogglePanelEditor = () => {
    setPanelEditorOpen(!panelEditorOpen)
  }

  const handleToggleValidation = () => {
    panelManagerRef.current?.toggle('validation')
  }

  const handlePanelMenuItemClick = (id: string) => {
    panelManagerRef.current?.toggle(id)
    setPanelMenuOpen(false)
  }

  const handleUndo = () => engineRef.current?.commandManager.undo()
  const handleRedo = () => engineRef.current?.commandManager.redo()

  const handleZoom = (factor: number) => {
    const engine = engineRef.current
    if (!engine) return
    const { viewportWidth, viewportHeight } = engine.camera
    engine.camera.zoomAt(
      new Vector2(viewportWidth / 2, viewportHeight / 2),
      factor
    )
    useCadStore.getState().setZoom(engine.camera.scale)
    engine.requestRender()
  }

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    themeManagerRef.current?.setTheme(next)
    setTheme(next)
  }

  const handleCycleUiScale = () => {
    const scales = [1, 1.25, 1.5]
    const idx = scales.indexOf(uiScale)
    const next = scales[(idx + 1) % scales.length]
    setUiScale(next)
    document.documentElement.style.setProperty('--ui-scale', String(next))
  }

  const handleToggleCompact = () => {
    const next = !compactPanels
    setCompactPanels(next)
    document.documentElement.classList.toggle('compact', next)
  }

  const handleToggleOrtho = () => {
    const next = !orthoMode
    setOrthoMode(next)
    engineRef.current?.editorState.set('orthoMode', next)
  }

  const handleSave = async () => {
    const engine = engineRef.current
    if (!engine) return
    try {
      await projectSync.saveProject(engine.plan)
      alert('Проект сохранён')
    } catch {
      alert('Ошибка сохранения проекта')
    }
  }

  const handleExportPng = () => {
    const engine = engineRef.current
    if (!engine) return
    const exporter = new PngExporter(engine.plan, engine.editorState, themeManagerRef.current!)
    exporter.export({ filename: 'involtcad-plan.png', title: 'План помещения' })
  }

  const handleExportXlsx = async () => {
    const engine = engineRef.current
    if (!engine) return
    const { exportToXlsx } = await import('@core/io/XlsxExporter')
    await exportToXlsx(engine.plan, 'involtcad-spec.xlsx')
  }

  const handleExportSvg = async () => {
    const engine = engineRef.current
    if (!engine) return
    const { exportToSvg } = await import('@core/io/SvgExporter')
    exportToSvg(engine.plan, 'involtcad-plan.svg')
  }

  const handlePrint = () => {
    const engine = engineRef.current
    if (!engine) return
    const exporter = new PrintExporter(engine.plan, engine.editorState, themeManagerRef.current!)
    exporter.print({ title: 'План помещения' })
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json,.dxf'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const engine = engineRef.current
        if (!engine) return

        if (file.name.toLowerCase().endsWith('.dxf')) {
          // Импорт DXF
          const { importDxf } = await import('@core/io/DxfImporter')
          const plan = importDxf(text)
          engine.plan = plan
          engine.notifyChanged()
          engine.requestRender()
          alert('DXF импортирован')
        } else {
          // Импорт JSON
          const data = JSON.parse(text)
          // Создаём новый проект с импортированными данными
          const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: file.name.replace(/\.json$/i, '') }),
          })
          if (!res.ok) throw new Error('Ошибка создания проекта')
          const project = await res.json()
          // Сохраняем план в проект
          await fetch(`/api/projects/${project.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: data }),
          })
          // Открываем проект
          await projectSync.loadProject(project.id)
          engine.plan = (await projectSync.loadProject(project.id)).plan
          engine.notifyChanged()
          engine.requestRender()
          alert('Проект импортирован')
        }
      } catch (err) {
        console.error('Ошибка импорта:', err)
        alert('Ошибка импорта файла')
      }
    }
    input.click()
  }

  const handleClear = () => {
    if (confirm('Очистить план?')) {
      engineRef.current?.clearPlan()
    }
  }

  return (
    <>
      {/* Desktop toolbar */}
      <div className="absolute left-0 top-0 z-30 hidden h-full w-16 flex-col gap-2 border-r border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800 md:flex">
        {tools.map((tool) => (
          <button
            key={tool.name}
            onClick={() => setTool(tool.name)}
            className={`flex flex-col items-center justify-center rounded-lg border p-2 text-xs ${
              currentTool === tool.name
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}
            title={tool.label}
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: tool.icon }} />
            <span className="text-[10px]">{tool.label}</span>
          </button>
        ))}

        <div className="mt-auto flex flex-col gap-2">
          <button
            ref={panelMenuBtnRef}
            onClick={handleTogglePanelMenu}
            className={`flex flex-col items-center justify-center rounded-lg border p-2 text-xs ${
              panelMenuOpen
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}
            title="Панели"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('menu') }} />
          </button>
          <button
            onClick={handleToggleCableJournal}
            className={`flex flex-col items-center justify-center rounded-lg border p-2 text-xs ${
              panelManagerRef.current?.isVisible('cableJournal')
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}
            title="Кабельный журнал"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('cable') }} />
          </button>
          <button
            onClick={handleToggleOls}
            className={`flex flex-col items-center justify-center rounded-lg border p-2 text-xs ${
              olsOpen
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}
            title="Однолинейная схема"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('ols') }} />
          </button>
          <button
            onClick={handleTogglePanelEditor}
            className={`flex flex-col items-center justify-center rounded-lg border p-2 text-xs ${
              panelEditorOpen
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}
            title="Визуализация щита"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('panel') }} />
          </button>
          <button
            onClick={handleToggleValidation}
            className={`flex flex-col items-center justify-center rounded-lg border p-2 text-xs ${
              panelManagerRef.current?.isVisible('validation')
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}
            title="Проверка"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('validation') }} />
          </button>
          <button
            onClick={handleToggleTheme}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon(theme === 'dark' ? 'sun' : 'moon') }} />
          </button>
          <button
            onClick={handleCycleUiScale}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title={`Масштаб UI ${uiScale}×`}
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('uiScale') }} />
          </button>
          <button
            onClick={handleToggleCompact}
            className={`flex flex-col items-center justify-center rounded-lg border p-2 text-xs ${
              compactPanels
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}
            title={compactPanels ? 'Расширенные панели' : 'Компактные панели'}
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('compact') }} />
          </button>
          <button
            onClick={handleToggleOrtho}
            className={`flex flex-col items-center justify-center rounded-lg border p-2 text-xs ${
              orthoMode
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}
            title={orthoMode ? 'Орто: вкл' : 'Орто: выкл (Shift — временно)'}
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('ortho') }} />
          </button>
          <button
            onClick={handleUndo}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Отменить (Ctrl+Z)"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('undo') }} />
          </button>
          <button
            onClick={handleRedo}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Повторить (Ctrl+Y)"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('redo') }} />
          </button>
          <button
            onClick={() => handleZoom(1.25)}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Приблизить"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('zoomIn') }} />
          </button>
          <button
            onClick={() => handleZoom(0.8)}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Отдалить"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('zoomOut') }} />
          </button>
          <button
            onClick={handleSave}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Сохранить (Ctrl+S)"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('save') }} />
          </button>
          <button
            onClick={handleExportPng}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Экспорт PNG"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('exportPng') }} />
          </button>
          <button
            onClick={handleExportXlsx}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Экспорт XLSX"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('exportXlsx') }} />
          </button>
          <button
            onClick={handleExportSvg}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Экспорт SVG"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('exportSvg') }} />
          </button>
          <button
            onClick={handlePrint}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Печать / PDF"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('print') }} />
          </button>
          <button
            onClick={handleImport}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Импорт JSON (Ctrl+O)"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('import') }} />
          </button>
          <button
            onClick={handleClear}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Очистить план"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('clear') }} />
          </button>
        </div>
      </div>

      {panelMenuOpen && (
        <div
          className="panels-menu"
          style={{ left: panelMenuPos.x, top: panelMenuPos.y }}
        >
          {panelItems.map((item) => (
            <button
              key={item.id}
              className={`panels-menu-item ${item.visible ? 'visible' : ''}`}
              onClick={() => handlePanelMenuItemClick(item.id)}
            >
              <span className="ui-icon" dangerouslySetInnerHTML={{ __html: item.icon }} />
              <span>{item.title}</span>
              <span className="panels-menu-check">{item.visible ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      )}

      {/* Mobile toolbar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 flex gap-2 overflow-x-auto border-t border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800 md:hidden">
        {tools.map((tool) => (
          <button
            key={tool.name}
            onClick={() => setTool(tool.name)}
            className={`flex flex-shrink-0 items-center justify-center rounded-lg border p-3 ${
              currentTool === tool.name
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-700'
            }`}
            title={tool.label}
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: tool.icon }} />
          </button>
        ))}
        <button
          onClick={handleUndo}
          className="flex flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-700"
          title="Отменить"
        >
          <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('undo') }} />
        </button>
        <button
          onClick={handleRedo}
          className="flex flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-700"
          title="Повторить"
        >
          <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('redo') }} />
        </button>
      </div>
    </>
  )
}
