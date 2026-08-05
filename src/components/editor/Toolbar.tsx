'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'
import type { ToolName } from '@core/tools/ToolManager'
import { Vector2 } from '@core/geometry/Vector2'
import { projectSync } from '@/lib/projects/sync'
import { PngExporter } from '@core/io/PngExporter'
import { PrintExporter } from '@core/io/PrintExporter'
import { icon } from './icons'

interface DockTool {
  name: ToolName
  label: string
  icon: string
}

const drawingTools: DockTool[] = [
  { name: 'wall', label: 'Стена', icon: icon('wall') },
  { name: 'door', label: 'Дверь', icon: icon('door') },
  { name: 'window', label: 'Окно', icon: icon('window') },
  { name: 'device', label: 'Устройство', icon: icon('device') },
  { name: 'cable', label: 'Кабель', icon: icon('cable') },
  { name: 'dimension', label: 'Размер', icon: icon('dimension') },
  { name: 'select', label: 'Выбор', icon: icon('select') },
  { name: 'hand', label: 'Рука', icon: icon('hand') },
]

interface DockAction {
  id: string
  label: string
  icon: string
  active?: boolean
  onClick: () => void
}

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
  const projectsOpen = useCadStore((s) => s.projectsOpen)
  const setProjectsOpen = useCadStore((s) => s.setProjectsOpen)
  const roomsOpen = useCadStore((s) => s.roomsOpen)
  const setRoomsOpen = useCadStore((s) => s.setRoomsOpen)
  const estimatesOpen = useCadStore((s) => s.estimatesOpen)
  const setEstimatesOpen = useCadStore((s) => s.setEstimatesOpen)
  const invoicesOpen = useCadStore((s) => s.invoicesOpen)
  const setInvoicesOpen = useCadStore((s) => s.setInvoicesOpen)
  const documentsOpen = useCadStore((s) => s.documentsOpen)
  const setDocumentsOpen = useCadStore((s) => s.setDocumentsOpen)
  const catalogOpen = useCadStore((s) => s.catalogOpen)
  const setCatalogOpen = useCadStore((s) => s.setCatalogOpen)
  const markingOpen = useCadStore((s) => s.markingOpen)
  const setMarkingOpen = useCadStore((s) => s.setMarkingOpen)
  const automationOpen = useCadStore((s) => s.automationOpen)
  const setAutomationOpen = useCadStore((s) => s.setAutomationOpen)
  const templatesOpen = useCadStore((s) => s.templatesOpen)
  const setTemplatesOpen = useCadStore((s) => s.setTemplatesOpen)
  const { engineRef, themeManagerRef, panelManagerRef } = useEditor()

  const [panelMenuOpen, setPanelMenuOpen] = useState(false)
  const [panelMenuPos, setPanelMenuPos] = useState({ x: 0, y: 0 })
  const [panelItems, setPanelItems] = useState<Array<{ id: string; title: string; icon: string; visible: boolean }>>([])
  const panelMenuBtnRef = useRef<HTMLButtonElement>(null)

  // macOS dock hover state
  const [hoveredDockId, setHoveredDockId] = useState<string | null>(null)
  const dockRef = useRef<HTMLDivElement>(null)

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
      setPanelMenuPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
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
          const { importDxf } = await import('@core/io/DxfImporter')
          const plan = importDxf(text)
          engine.plan = plan
          engine.notifyChanged()
          engine.requestRender()
          alert('DXF импортирован')
        } else {
          const data = JSON.parse(text)
          const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: file.name.replace(/\.json$/i, '') }),
          })
          if (!res.ok) throw new Error('Ошибка создания проекта')
          const project = await res.json()
          await fetch(`/api/projects/${project.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: data }),
          })
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

  const getDockScale = useCallback(
    (id: string) => {
      if (!hoveredDockId) return 1
      const allIds = [...drawingTools.map((t) => t.name), 'panels', 'validation', 'theme'] as string[]
      const idx = allIds.indexOf(id)
      const hoverIdx = allIds.indexOf(hoveredDockId)
      if (idx === -1 || hoverIdx === -1) return 1
      const distance = Math.abs(idx - hoverIdx)
      if (distance === 0) return 1.55
      if (distance === 1) return 1.25
      if (distance === 2) return 1.08
      return 1
    },
    [hoveredDockId]
  )

  const dockActions: DockAction[] = [
    {
      id: 'panels',
      label: 'Панели',
      icon: icon('menu'),
      active: panelMenuOpen,
      onClick: handleTogglePanelMenu,
    },
    {
      id: 'validation',
      label: 'Проверка',
      icon: icon('validation'),
      active: panelManagerRef.current?.isVisible('validation') ?? false,
      onClick: handleToggleValidation,
    },
    {
      id: 'theme',
      label: theme === 'dark' ? 'Светлая тема' : 'Тёмная тема',
      icon: icon(theme === 'dark' ? 'sun' : 'moon'),
      onClick: handleToggleTheme,
    },
  ]

  return (
    <>
      {/* Left project sidebar */}
      <div className="project-sidebar">
        <div className="project-sidebar-top">
          <button
            onClick={() => setProjectsOpen(!projectsOpen)}
            className={`project-sidebar-btn ${projectsOpen ? 'active' : ''}`}
            title="Проекты"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('projects') }} />
            <span className="project-sidebar-label">Проекты</span>
          </button>
          <button
            onClick={handleToggleCableJournal}
            className={`project-sidebar-btn ${panelManagerRef.current?.isVisible('cableJournal') ? 'active' : ''}`}
            title="Кабельный журнал"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('cable') }} />
            <span className="project-sidebar-label">Кабели</span>
          </button>
          <button
            onClick={handleToggleOls}
            className={`project-sidebar-btn ${olsOpen ? 'active' : ''}`}
            title="Однолинейная схема"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('ols') }} />
            <span className="project-sidebar-label">ОЛС</span>
          </button>
          <button
            onClick={handleTogglePanelEditor}
            className={`project-sidebar-btn ${panelEditorOpen ? 'active' : ''}`}
            title="Визуализация щита"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('panel') }} />
            <span className="project-sidebar-label">Щит</span>
          </button>
          <button
            onClick={() => setRoomsOpen(!roomsOpen)}
            className={`project-sidebar-btn ${roomsOpen ? 'active' : ''}`}
            title="Комнаты и потребители"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('rooms') }} />
            <span className="project-sidebar-label">Комнаты</span>
          </button>
          <button
            onClick={() => setCatalogOpen(!catalogOpen)}
            className={`project-sidebar-btn ${catalogOpen ? 'active' : ''}`}
            title="Каталог материалов и работ"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('catalog') }} />
            <span className="project-sidebar-label">Каталог</span>
          </button>
          <button
            onClick={() => setEstimatesOpen(!estimatesOpen)}
            className={`project-sidebar-btn ${estimatesOpen ? 'active' : ''}`}
            title="Сметы и КП"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('estimates') }} />
            <span className="project-sidebar-label">Сметы</span>
          </button>
          <button
            onClick={() => setInvoicesOpen(!invoicesOpen)}
            className={`project-sidebar-btn ${invoicesOpen ? 'active' : ''}`}
            title="Счета"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('invoices') }} />
            <span className="project-sidebar-label">Счета</span>
          </button>
          <button
            onClick={() => setDocumentsOpen(!documentsOpen)}
            className={`project-sidebar-btn ${documentsOpen ? 'active' : ''}`}
            title="Договоры и акты"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('documents') }} />
            <span className="project-sidebar-label">Документы</span>
          </button>
          <button
            onClick={() => setMarkingOpen(!markingOpen)}
            className={`project-sidebar-btn ${markingOpen ? 'active' : ''}`}
            title="Маркировка IEC"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('marking') }} />
            <span className="project-sidebar-label">Маркировка</span>
          </button>
          <button
            onClick={() => setAutomationOpen(!automationOpen)}
            className={`project-sidebar-btn ${automationOpen ? 'active' : ''}`}
            title="Wirenboard / Умный дом"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('automation') }} />
            <span className="project-sidebar-label">Автоматика</span>
          </button>
          <button
            onClick={() => setTemplatesOpen(!templatesOpen)}
            className={`project-sidebar-btn ${templatesOpen ? 'active' : ''}`}
            title="Шаблоны проектов"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('templates') }} />
            <span className="project-sidebar-label">Шаблоны</span>
          </button>
        </div>

        <div className="project-sidebar-bottom">
          <button onClick={handleUndo} className="project-sidebar-btn" title="Отменить (Ctrl+Z)">
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('undo') }} />
          </button>
          <button onClick={handleRedo} className="project-sidebar-btn" title="Повторить (Ctrl+Y)">
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('redo') }} />
          </button>
          <button onClick={() => handleZoom(1.25)} className="project-sidebar-btn" title="Приблизить">
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('zoomIn') }} />
          </button>
          <button onClick={() => handleZoom(0.8)} className="project-sidebar-btn" title="Отдалить">
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('zoomOut') }} />
          </button>
          <button onClick={handleSave} className="project-sidebar-btn" title="Сохранить (Ctrl+S)">
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('save') }} />
          </button>
          <button onClick={handleExportPng} className="project-sidebar-btn" title="Экспорт PNG">
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('exportPng') }} />
          </button>
          <button onClick={handleExportXlsx} className="project-sidebar-btn" title="Экспорт XLSX">
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('exportXlsx') }} />
          </button>
          <button onClick={handleExportSvg} className="project-sidebar-btn" title="Экспорт SVG">
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('exportSvg') }} />
          </button>
          <button onClick={handlePrint} className="project-sidebar-btn" title="Печать / PDF">
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('print') }} />
          </button>
          <button onClick={handleImport} className="project-sidebar-btn" title="Импорт JSON (Ctrl+O)">
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('import') }} />
          </button>
          <button onClick={handleClear} className="project-sidebar-btn" title="Очистить план">
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('clear') }} />
          </button>
          <button
            onClick={handleToggleOrtho}
            className={`project-sidebar-btn ${orthoMode ? 'active' : ''}`}
            title={orthoMode ? 'Орто: вкл' : 'Орто: выкл (Shift — временно)'}
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('ortho') }} />
          </button>
          <button onClick={handleCycleUiScale} className="project-sidebar-btn" title={`Масштаб UI ${uiScale}×`}>
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('uiScale') }} />
          </button>
          <button
            onClick={handleToggleCompact}
            className={`project-sidebar-btn ${compactPanels ? 'active' : ''}`}
            title={compactPanels ? 'Расширенные панели' : 'Компактные панели'}
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('compact') }} />
          </button>
        </div>
      </div>

      {/* macOS-style dock */}
      <div
        ref={dockRef}
        className="editor-dock"
        onMouseLeave={() => setHoveredDockId(null)}
      >
        {drawingTools.map((tool) => (
          <button
            key={tool.name}
            onClick={() => setTool(tool.name)}
            onMouseEnter={() => setHoveredDockId(tool.name)}
            className={`editor-dock-item ${currentTool === tool.name ? 'active' : ''}`}
            title={tool.label}
            style={{ transform: `scale(${getDockScale(tool.name)})` }}
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: tool.icon }} />
            <span className="editor-dock-tooltip">{tool.label}</span>
          </button>
        ))}
        <div className="editor-dock-divider" />
        {dockActions.map((action) => (
          <button
            key={action.id}
            ref={action.id === 'panels' ? panelMenuBtnRef : undefined}
            onClick={action.onClick}
            onMouseEnter={() => setHoveredDockId(action.id)}
            className={`editor-dock-item ${action.active ? 'active' : ''}`}
            title={action.label}
            style={{ transform: `scale(${getDockScale(action.id)})` }}
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: action.icon }} />
            <span className="editor-dock-tooltip">{action.label}</span>
          </button>
        ))}
      </div>

      {panelMenuOpen && (
        <div
          className="panels-menu panels-menu-dock"
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
          <button
            key="reset"
            className="panels-menu-item"
            onClick={() => {
              panelManagerRef.current?.resetLayout()
              setPanelMenuOpen(false)
            }}
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('reset') }} />
            <span>Упорядочить панели</span>
          </button>
        </div>
      )}
    </>
  )
}
