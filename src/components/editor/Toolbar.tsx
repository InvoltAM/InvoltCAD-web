'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'
import type { ToolName } from '@core/tools/ToolManager'
import { Vector2 } from '@core/geometry/Vector2'
import { projectSync } from '@/lib/projects/sync'
import { icon } from './icons'

interface DockTool {
  name: ToolName
  label: string
  icon: string
}

const wallTools: DockTool[] = [
  { name: 'wall', label: 'Стена', icon: icon('wall') },
  { name: 'door', label: 'Дверь', icon: icon('door') },
  { name: 'window', label: 'Окно', icon: icon('window') },
]

const drawingTools: DockTool[] = [
  { name: 'wall', label: 'Стена', icon: icon('wall') },
  { name: 'cable', label: 'Кабель', icon: icon('cable') },
  { name: 'dimension', label: 'Размер', icon: icon('dimension') },
]

const drawingPrimitiveTools: DockTool[] = [
  { name: 'polyline', label: 'Полилиния', icon: icon('polyline') },
  { name: 'segment', label: 'Отрезок', icon: icon('segment') },
  { name: 'rectangle', label: 'Прямоугольник', icon: icon('rectangle') },
  { name: 'circle', label: 'Круг', icon: icon('circle') },
]

const navigationTools: DockTool[] = [
  { name: 'select', label: 'Выбор', icon: icon('select') },
  { name: 'hand', label: 'Рука', icon: icon('hand') },
]

const modifyTools: DockTool[] = [
  { name: 'move', label: 'Перенести', icon: icon('move') },
  { name: 'rotate', label: 'Повернуть', icon: icon('rotate') },
  { name: 'trim', label: 'Обрезать', icon: icon('trim') },
  { name: 'extend', label: 'Удлинить', icon: icon('extend') },
]

const textModes: Array<{ mode: 'single' | 'multi' | 'callout'; label: string }> = [
  { mode: 'single', label: 'Однострочный' },
  { mode: 'multi', label: 'Многострочный' },
  { mode: 'callout', label: 'Выноска' },
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
  const cableJournalOpen = useCadStore((s) => s.cableJournalOpen)
  const devicePaletteOpen = useCadStore((s) => s.devicePaletteOpen)
  const aiChatOpen = useCadStore((s) => s.aiChatOpen)
  const { engineRef, themeManagerRef, panelManagerRef } = useEditor()
  const [, setTick] = useState(0)

  const [panelMenuOpen, setPanelMenuOpen] = useState(false)
  const [panelMenuPos, setPanelMenuPos] = useState({ x: 0, y: 0 })
  const [panelItems, setPanelItems] = useState<Array<{ id: string; title: string; icon: string; visible: boolean }>>([])
  const panelMenuBtnRef = useRef<HTMLButtonElement>(null)

  const [wallMenuOpen, setWallMenuOpen] = useState(false)
  const wallMenuBtnRef = useRef<HTMLButtonElement>(null)

  const [drawingMenuOpen, setDrawingMenuOpen] = useState(false)
  const drawingMenuBtnRef = useRef<HTMLButtonElement>(null)

  const [modifyMenuOpen, setModifyMenuOpen] = useState(false)
  const modifyMenuBtnRef = useRef<HTMLButtonElement>(null)

  const [textMenuOpen, setTextMenuOpen] = useState(false)
  const textMenuBtnRef = useRef<HTMLButtonElement>(null)

  const [underlayMenuOpen, setUnderlayMenuOpen] = useState(false)
  const underlayMenuBtnRef = useRef<HTMLButtonElement>(null)
  const underlayInputRef = useRef<HTMLInputElement>(null)

  const selectedTextMode = useCadStore((s) => s.selectedTextMode)
  const setSelectedTextMode = useCadStore((s) => s.setSelectedTextMode)

  // macOS dock hover state
  const [hoveredDockId, setHoveredDockId] = useState<string | null>(null)
  const dockRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.style.setProperty('--ui-scale', String(uiScale))
    document.documentElement.classList.toggle('compact', compactPanels)
  }, [uiScale, compactPanels])

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

  useEffect(() => {
    if (!wallMenuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!wallMenuBtnRef.current?.contains(e.target as Node)) {
        setWallMenuOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [wallMenuOpen])

  useEffect(() => {
    if (!drawingMenuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!drawingMenuBtnRef.current?.contains(e.target as Node)) {
        setDrawingMenuOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [drawingMenuOpen])

  useEffect(() => {
    if (!modifyMenuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!modifyMenuBtnRef.current?.contains(e.target as Node)) {
        setModifyMenuOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [modifyMenuOpen])

  useEffect(() => {
    if (!textMenuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!textMenuBtnRef.current?.contains(e.target as Node)) {
        setTextMenuOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [textMenuOpen])

  useEffect(() => {
    if (!underlayMenuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!underlayMenuBtnRef.current?.contains(e.target as Node)) {
        setUnderlayMenuOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [underlayMenuOpen])

  const handleToggleWallMenu = () => {
    setWallMenuOpen((prev) => !prev)
  }

  const handleSelectWallTool = (name: ToolName) => {
    setTool(name)
    setWallMenuOpen(false)
  }

  const handleToggleDrawingMenu = () => {
    setDrawingMenuOpen((prev) => !prev)
  }

  const handleSelectDrawingTool = (name: ToolName) => {
    setTool(name)
    setDrawingMenuOpen(false)
  }

  const handleToggleModifyMenu = () => {
    setModifyMenuOpen((prev) => !prev)
  }

  const handleSelectModifyTool = (name: ToolName) => {
    setTool(name)
    setModifyMenuOpen(false)
  }

  const handleToggleTextMenu = () => {
    if (currentTool !== 'text') {
      setTool('text')
      engineRef.current?.setTool('text')
    }
    setTextMenuOpen((prev) => !prev)
  }

  const handleSelectTextMode = (mode: 'single' | 'multi' | 'callout') => {
    setSelectedTextMode(mode)
    setTool('text')
    engineRef.current?.setTool('text')
    setTextMenuOpen(false)
  }

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

  const handleToggleDevicePalette = () => {
    panelManagerRef.current?.toggle('devicePalette')
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

  const handleToggleAiChat = () => {
    panelManagerRef.current?.toggle('aiChat')
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

  const handleToggleUnderlayMenu = () => {
    setUnderlayMenuOpen((prev) => !prev)
  }

  const handleUploadUnderlay = () => {
    underlayInputRef.current?.click()
  }

  const applyUnderlayDataUrl = (dataUrl: string) => {
    const engine = engineRef.current
    const plan = engine?.plan
    if (!plan || !engine) return
    const img = new Image()
    img.onload = () => {
      // Начальный масштаб: 1 px = 1 мм, центрируем по камере
      const cx = plan.activeSheet.underlay?.position.x ?? engine.camera.x
      const cy = plan.activeSheet.underlay?.position.y ?? engine.camera.y
      plan.activeSheet.underlay = {
        id: crypto.randomUUID(),
        dataUrl,
        position: { x: cx - (img.width * 1) / 2, y: cy - (img.height * 1) / 2 },
        scale: 1,
        opacity: 0.6,
        visible: true,
        locked: false,
      }
      engine.underlayRenderer.clearCache()
      engine.notifyChanged?.()
      engine.requestRender()
    }
    img.src = dataUrl
  }

  const handleUnderlayFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер 10 МБ.')
      e.target.value = ''
      return
    }

    try {
      const ext = file.name.toLowerCase().split('.').pop()
      if (ext === 'pdf' || file.type === 'application/pdf') {
        const { pdfFirstPageToPng } = await import('@/lib/pdfToImage')
        const dataUrl = await pdfFirstPageToPng(file, 2)
        applyUnderlayDataUrl(dataUrl)
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = () => {
          applyUnderlayDataUrl(reader.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        alert('Поддерживаются PNG, JPEG и PDF. DWG пока не реализован.')
      }
    } catch (err) {
      console.error('Ошибка загрузки подложки:', err)
      alert('Ошибка загрузки подложки. Проверьте формат файла.')
    }

    e.target.value = ''
    setUnderlayMenuOpen(false)
  }

  const handleDeleteUnderlay = () => {
    const engine = engineRef.current
    const plan = engine?.plan
    if (!plan || !plan.activeSheet.underlay) return
    delete plan.activeSheet.underlay
    engine.underlayRenderer.clearCache()
    engine.notifyChanged?.()
    engine.requestRender()
    setUnderlayMenuOpen(false)
  }

  const handleToggleUnderlayVisible = () => {
    const underlay = engineRef.current?.plan.activeSheet.underlay
    if (!underlay) return
    underlay.visible = !underlay.visible
    engineRef.current?.requestRender()
    setTick((t) => t + 1)
  }

  const handleCalibrateUnderlay = () => {
    setTool('underlay')
    engineRef.current?.setTool('underlay')
    setUnderlayMenuOpen(false)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json,.dxf,.pdf,.dwg'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const ext = file.name.toLowerCase().split('.').pop()
      try {
        const engine = engineRef.current
        if (!engine) return

        if (ext === 'dxf') {
          const text = await file.text()
          const { importDxf } = await import('@core/io/DxfImporter')
          const plan = importDxf(text)
          engine.plan = plan
          engine.notifyChanged()
          engine.requestRender()
          alert('DXF импортирован')
        } else if (ext === 'pdf') {
          alert('Импорт PDF в качестве подложки пока не реализован. Конвертируйте PDF в DXF или используйте его как растровое изображение вручную.')
        } else if (ext === 'dwg') {
          alert('Импорт DWG напрямую не поддерживается в браузере. Сохраните файл в формате DXF и импортируйте его.')
        } else {
          const text = await file.text()
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
      const allIds = [
        'wall',
        'devicePalette',
        ...drawingTools.filter((t) => t.name !== 'wall').map((t) => t.name),
        'drawing',
        ...navigationTools.map((t) => t.name),
        'text',
        'table',
        'modify',
        ...modifyTools.map((t) => t.name),
        'undo',
        'redo',
        'zoomOut',
        'zoomIn',
        'clear',
        'ortho',
        'panels',
        'validation',
        'theme',
      ] as string[]
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
      id: 'undo',
      label: 'Отменить',
      icon: icon('undo'),
      onClick: handleUndo,
    },
    {
      id: 'redo',
      label: 'Повторить',
      icon: icon('redo'),
      onClick: handleRedo,
    },
    {
      id: 'zoomOut',
      label: 'Отдалить',
      icon: icon('zoomOut'),
      onClick: () => handleZoom(0.8),
    },
    {
      id: 'zoomIn',
      label: 'Приблизить',
      icon: icon('zoomIn'),
      onClick: () => handleZoom(1.25),
    },
    {
      id: 'clear',
      label: 'Очистить план',
      icon: icon('clear'),
      onClick: handleClear,
    },
    {
      id: 'ortho',
      label: 'Орто',
      icon: icon('ortho'),
      active: orthoMode,
      onClick: handleToggleOrtho,
    },
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
            className={`project-sidebar-btn ${cableJournalOpen ? 'active' : ''}`}
            title="Кабельный журнал"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('cable') }} />
            <span className="project-sidebar-label">КЖ</span>
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
            onClick={handleToggleAiChat}
            className={`project-sidebar-btn ${aiChatOpen ? 'active' : ''}`}
            title="AI-ассистент"
          >
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('ai') }} />
            <span className="project-sidebar-label">AI</span>
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
          <button onClick={handleImport} className="project-sidebar-btn" title="Импорт JSON (Ctrl+O)">
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('import') }} />
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
        onMouseLeave={() => {
          setHoveredDockId(null)
          setWallMenuOpen(false)
          setDrawingMenuOpen(false)
          setTextMenuOpen(false)
        }}
      >
        <div key="underlay" className="editor-dock-group">
          {(() => {
            const underlay = engineRef.current?.plan.activeSheet.underlay
            const hasUnderlay = !!underlay
            return (
              <button
                ref={underlayMenuBtnRef}
                onClick={handleToggleUnderlayMenu}
                onMouseEnter={() => setHoveredDockId('underlay')}
                className={`editor-dock-item editor-dock-item-menu ${currentTool === 'underlay' ? 'active' : ''} ${hasUnderlay ? 'has-underlay' : ''}`}
                title={`Подложка ${hasUnderlay ? '●' : ''} ▼`}
                style={{ transform: `scale(${getDockScale('underlay')})` }}
              >
                <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('underlay') }} />
                <span className="editor-dock-arrow">▼</span>
                <span className="editor-dock-tooltip">Подложка</span>
              </button>
            )
          })()}
          {underlayMenuOpen && (
            <div className="editor-dock-submenu">
              <button className="editor-dock-submenu-item" onClick={handleUploadUnderlay}>
                <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('import') }} />
                <span>Загрузить PNG/JPEG/PDF</span>
              </button>
              {engineRef.current?.plan.activeSheet.underlay && (
                <>
                  <button className="editor-dock-submenu-item" onClick={handleCalibrateUnderlay}>
                    <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('calibrate') }} />
                    <span>Калибровать масштаб</span>
                  </button>
                  <button className="editor-dock-submenu-item" onClick={handleToggleUnderlayVisible}>
                    <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon(engineRef.current?.plan.activeSheet.underlay?.visible ? 'eyeSlash' : 'eye') }} />
                    <span>{engineRef.current?.plan.activeSheet.underlay?.visible ? 'Скрыть' : 'Показать'}</span>
                  </button>
                  <button className="editor-dock-submenu-item" onClick={handleDeleteUnderlay}>
                    <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('clear') }} />
                    <span>Удалить</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="editor-dock-divider" />
        {drawingTools.flatMap((tool) => {
          const elements: React.ReactNode[] = []
          if (tool.name === 'wall') {
            const activeWallTool =
              wallTools.find((wt) => wt.name === currentTool) ?? wallTools[0]
            const isWallToolActive =
              currentTool === 'wall' || currentTool === 'door' || currentTool === 'window'
            elements.push(
              <div key="wall" className="editor-dock-group">
                <button
                  ref={wallMenuBtnRef}
                  onClick={handleToggleWallMenu}
                  onMouseEnter={() => setHoveredDockId('wall')}
                  className={`editor-dock-item editor-dock-item-menu ${isWallToolActive ? 'active' : ''}`}
                  title={`${activeWallTool.label} ▼`}
                  style={{ transform: `scale(${getDockScale('wall')})` }}
                >
                  <span className="ui-icon" dangerouslySetInnerHTML={{ __html: activeWallTool.icon }} />
                  <span className="editor-dock-arrow">▼</span>
                  <span className="editor-dock-tooltip">{activeWallTool.label}</span>
                </button>
                {wallMenuOpen && (
                  <div
                    className="editor-dock-submenu"
                  >
                    {wallTools.map((wt) => (
                      <button
                        key={wt.name}
                        className={`editor-dock-submenu-item ${currentTool === wt.name ? 'active' : ''}`}
                        onClick={() => handleSelectWallTool(wt.name)}
                      >
                        <span className="ui-icon" dangerouslySetInnerHTML={{ __html: wt.icon }} />
                        <span>{wt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          } else {
            elements.push(
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
            )
          }
          if (tool.name === 'wall') {
            elements.push(
              <button
                key="devicePalette"
                onClick={handleToggleDevicePalette}
                onMouseEnter={() => setHoveredDockId('devicePalette')}
                className={`editor-dock-item ${devicePaletteOpen ? 'active' : ''}`}
                title="Устройства"
                style={{ transform: `scale(${getDockScale('devicePalette')})` }}
              >
                <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('device') }} />
                <span className="editor-dock-tooltip">Устройства</span>
              </button>
            )
          }
          if (tool.name === 'cable') {
            elements.push(<div key="divider-after-cable" className="editor-dock-divider" />)
          }
          return elements
        })}
        <div key="drawing" className="editor-dock-group">
          {(() => {
            const activeDrawingTool =
              drawingPrimitiveTools.find((dt) => dt.name === currentTool) ?? drawingPrimitiveTools[0]
            const isDrawingToolActive = drawingPrimitiveTools.some((dt) => dt.name === currentTool)
            return (
              <button
                ref={drawingMenuBtnRef}
                onClick={handleToggleDrawingMenu}
                onMouseEnter={() => setHoveredDockId('drawing')}
                className={`editor-dock-item editor-dock-item-menu ${isDrawingToolActive ? 'active' : ''}`}
                title={`${activeDrawingTool.label} ▼`}
                style={{ transform: `scale(${getDockScale('drawing')})` }}
              >
                <span className="ui-icon" dangerouslySetInnerHTML={{ __html: activeDrawingTool.icon }} />
                <span className="editor-dock-arrow">▼</span>
                <span className="editor-dock-tooltip">{activeDrawingTool.label}</span>
              </button>
            )
          })()}
          {drawingMenuOpen && (
            <div className="editor-dock-submenu">
              {drawingPrimitiveTools.map((dt) => (
                <button
                  key={dt.name}
                  className={`editor-dock-submenu-item ${currentTool === dt.name ? 'active' : ''}`}
                  onClick={() => handleSelectDrawingTool(dt.name)}
                >
                  <span className="ui-icon" dangerouslySetInnerHTML={{ __html: dt.icon }} />
                  <span>{dt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {navigationTools.flatMap((tool) => {
          const elements: React.ReactNode[] = [
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
            </button>,
          ]
          if (tool.name === 'select') {
            elements.push(
              <div key="modify" className="editor-dock-group">
                {(() => {
                  const activeModifyTool =
                    modifyTools.find((mt) => mt.name === currentTool) ?? modifyTools[0]
                  const isModifyToolActive = modifyTools.some((mt) => mt.name === currentTool)
                  return (
                    <button
                      ref={modifyMenuBtnRef}
                      onClick={handleToggleModifyMenu}
                      onMouseEnter={() => setHoveredDockId('modify')}
                      className={`editor-dock-item editor-dock-item-menu ${isModifyToolActive ? 'active' : ''}`}
                      title={`${activeModifyTool.label} ▼`}
                      style={{ transform: `scale(${getDockScale('modify')})` }}
                    >
                      <span className="ui-icon" dangerouslySetInnerHTML={{ __html: activeModifyTool.icon }} />
                      <span className="editor-dock-arrow">▼</span>
                      <span className="editor-dock-tooltip">{activeModifyTool.label}</span>
                    </button>
                  )
                })()}
                {modifyMenuOpen && (
                  <div className="editor-dock-submenu">
                    {modifyTools.map((mt) => (
                      <button
                        key={mt.name}
                        className={`editor-dock-submenu-item ${currentTool === mt.name ? 'active' : ''}`}
                        onClick={() => handleSelectModifyTool(mt.name)}
                      >
                        <span className="ui-icon" dangerouslySetInnerHTML={{ __html: mt.icon }} />
                        <span>{mt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          }
          if (tool.name === 'hand') {
            elements.push(<div key="divider-after-hand" className="editor-dock-divider" />)
          }
          return elements
        })}
        <div key="text" className="editor-dock-group">
          {(() => {
            const activeTextMode = textModes.find((tm) => tm.mode === selectedTextMode) ?? textModes[0]
            return (
              <button
                ref={textMenuBtnRef}
                onClick={handleToggleTextMenu}
                onMouseEnter={() => setHoveredDockId('text')}
                className={`editor-dock-item editor-dock-item-menu ${currentTool === 'text' ? 'active' : ''}`}
                title={`Текст: ${activeTextMode.label} ▼`}
                style={{ transform: `scale(${getDockScale('text')})` }}
              >
                <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('text') }} />
                <span className="editor-dock-arrow">▼</span>
                <span className="editor-dock-tooltip">Текст: {activeTextMode.label}</span>
              </button>
            )
          })()}
          {textMenuOpen && (
            <div className="editor-dock-submenu">
              {textModes.map((tm) => (
                <button
                  key={tm.mode}
                  className={`editor-dock-submenu-item ${selectedTextMode === tm.mode && currentTool === 'text' ? 'active' : ''}`}
                  onClick={() => handleSelectTextMode(tm.mode)}
                >
                  <span>{tm.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          key="table"
          onClick={() => {
            setTool('table')
            engineRef.current?.setTool('table')
          }}
          onMouseEnter={() => setHoveredDockId('table')}
          className={`editor-dock-item ${currentTool === 'table' ? 'active' : ''}`}
          title="Таблица"
          style={{ transform: `scale(${getDockScale('table')})` }}
        >
          <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('table') }} />
          <span className="editor-dock-tooltip">Таблица</span>
        </button>
        <div className="editor-dock-divider" />
        <input
          ref={underlayInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,application/pdf,.pdf"
          className="hidden"
          onChange={handleUnderlayFileChange}
        />
        {dockActions.flatMap((action) => {
          const elements: React.ReactNode[] = [
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
            </button>,
          ]
          if (action.id === 'clear') {
            elements.push(<div key="divider-after-clear" className="editor-dock-divider" />)
          }
          return elements
        })}
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
