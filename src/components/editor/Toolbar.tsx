'use client'

import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'
import type { ToolName } from '@core/tools/ToolManager'
import { Vector2 } from '@core/geometry/Vector2'
import { projectSync } from '@/lib/projects/sync'

const tools: Array<{ name: ToolName; label: string; icon: string }> = [
  { name: 'wall', label: 'Стена', icon: '▬' },
  { name: 'door', label: 'Дверь', icon: '🚪' },
  { name: 'window', label: 'Окно', icon: '▭' },
  { name: 'device', label: 'Устройство', icon: '🔌' },
  { name: 'cable', label: 'Кабель', icon: '⌇' },
  { name: 'dimension', label: 'Размер', icon: '↔' },
  { name: 'select', label: 'Выбор', icon: '↖' },
  { name: 'hand', label: 'Рука', icon: '✋' },
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
  const { engineRef, themeManagerRef } = useEditor()

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

  const handleSave = async () => {
    const engine = engineRef.current
    if (!engine) return
    try {
      await projectSync.saveProject(engine.plan)
      alert('Проект сохранён')
    } catch (error) {
      alert('Ошибка сохранения проекта')
    }
  }

  const handleExportPng = () => {
    // TODO: экспорт PNG
    alert('Экспорт PNG (в разработке)')
  }

  const handlePrint = () => {
    // TODO: печать / PDF
    alert('Печать / PDF (в разработке)')
  }

  const handleImport = () => {
    // TODO: импорт JSON
    alert('Импорт JSON (в разработке)')
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
            <span className="text-lg">{tool.icon}</span>
            <span className="text-[10px]">{tool.label}</span>
          </button>
        ))}

        <div className="mt-auto flex flex-col gap-2">
          <button
            onClick={handleToggleTheme}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            <span className="text-lg">{theme === 'dark' ? '☀' : '☾'}</span>
          </button>
          <button
            onClick={handleCycleUiScale}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title={`Масштаб UI ${uiScale}×`}
          >
            <span className="text-lg">⚲</span>
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
            <span className="text-lg">⛶</span>
          </button>
          <button
            onClick={handleUndo}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Отменить (Ctrl+Z)"
          >
            <span className="text-lg">↩</span>
          </button>
          <button
            onClick={handleRedo}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Повторить (Ctrl+Y)"
          >
            <span className="text-lg">↪</span>
          </button>
          <button
            onClick={() => handleZoom(1.25)}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Приблизить"
          >
            <span className="text-lg">＋</span>
          </button>
          <button
            onClick={() => handleZoom(0.8)}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Отдалить"
          >
            <span className="text-lg">－</span>
          </button>
          <button
            onClick={handleSave}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Сохранить (Ctrl+S)"
          >
            <span className="text-lg">💾</span>
          </button>
          <button
            onClick={handleExportPng}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Экспорт PNG"
          >
            <span className="text-lg">📷</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Печать / PDF"
          >
            <span className="text-lg">🖨</span>
          </button>
          <button
            onClick={handleImport}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Импорт JSON (Ctrl+O)"
          >
            <span className="text-lg">📂</span>
          </button>
          <button
            onClick={handleClear}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Очистить план"
          >
            <span className="text-lg">🗑</span>
          </button>
        </div>
      </div>

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
            <span className="text-xl">{tool.icon}</span>
          </button>
        ))}
        <button
          onClick={handleUndo}
          className="flex flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-700"
          title="Отменить"
        >
          <span className="text-xl">↩</span>
        </button>
        <button
          onClick={handleRedo}
          className="flex flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-700"
          title="Повторить"
        >
          <span className="text-xl">↪</span>
        </button>
      </div>
    </>
  )
}
