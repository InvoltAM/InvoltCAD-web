'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CanvasEngine } from '@core/engine/CanvasEngine'
import { Plan } from '@core/model/Plan'
import { ThemeManager } from '@core/editor/ThemeManager'
import { DrawingTool } from '@core/tools/DrawingTool'
import { SelectTool } from '@core/tools/SelectTool'
import { MoveTool } from '@core/tools/MoveTool'
import { RotateTool } from '@core/tools/RotateTool'
import { TrimTool } from '@core/tools/TrimTool'
import { ExtendTool } from '@core/tools/ExtendTool'
import { useCadStore, type CustomDevice } from '@/stores/cadStore'
import { icon } from './icons'

type ModalTool = 'select' | 'segment' | 'rectangle' | 'circle' | 'polyline' | 'move' | 'rotate' | 'trim' | 'extend'

const CATEGORIES = [
  { id: 'socket', label: 'Розетки' },
  { id: 'switch', label: 'Выключатель' },
  { id: 'light', label: 'Светильник' },
  { id: 'sensor', label: 'Датчик' },
  { id: 'output', label: 'Вывод' },
  { id: 'camera', label: 'В.камера' },
  { id: 'sks', label: 'СКС' },
  { id: 'drive', label: 'Привод' },
  { id: 'smartHome', label: 'УД' },
  { id: 'panel', label: 'Щиты' },
]

interface DeviceEditorModalProps {
  onClose: () => void
}

export default function DeviceEditorModal({ onClose }: DeviceEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<CanvasEngine | null>(null)
  const [currentTool, setCurrentTool] = useState<ModalTool>('segment')
  const [name, setName] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0]?.id ?? 'socket')
  const [error, setError] = useState<string | null>(null)
  const addCustomDevice = useCadStore((s) => s.addCustomDevice)
  const theme = useCadStore((s) => s.theme)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const plan = new Plan()
    const themeManager = new ThemeManager(theme)
    const engine = new CanvasEngine(canvas, plan, themeManager)
    engineRef.current = engine

    // Регистрируем инструменты черчения
    const segmentTool = new DrawingTool('segment', engine, plan, engine.snapEngine)
    const rectangleTool = new DrawingTool('rectangle', engine, plan, engine.snapEngine)
    const circleTool = new DrawingTool('circle', engine, plan, engine.snapEngine)
    const polylineTool = new DrawingTool('polyline', engine, plan, engine.snapEngine)

    engine.registerTool('segment', segmentTool)
    engine.registerTool('rectangle', rectangleTool)
    engine.registerTool('circle', circleTool)
    engine.registerTool('polyline', polylineTool)

    // Инструменты выделения и модификации примитивов
    const selectTool = new SelectTool(engine, plan, engine.snapEngine)
    const moveTool = new MoveTool(engine, plan, engine.snapEngine)
    const rotateTool = new RotateTool(engine, plan, engine.snapEngine)
    const trimTool = new TrimTool(engine, plan, engine.snapEngine)
    const extendTool = new ExtendTool(engine, plan, engine.snapEngine)

    engine.registerTool('select', selectTool)
    engine.registerTool('move', moveTool)
    engine.registerTool('rotate', rotateTool)
    engine.registerTool('trim', trimTool)
    engine.registerTool('extend', extendTool)

    engine.setTool('segment')
    engine.camera.fitToFrame(1000, 1000)

    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [theme])

  useEffect(() => {
    engineRef.current?.setTool(currentTool)
  }, [currentTool])

  const handleSave = () => {
    const engine = engineRef.current
    if (!engine) return

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Введите имя устройства')
      return
    }
    if (engine.plan.primitives.length === 0) {
      setError('Нарисуйте хотя бы один элемент')
      return
    }

    const device: CustomDevice = {
      id: crypto.randomUUID(),
      name: trimmed,
      category,
      primitives: engine.plan.primitives.map((p) => ({
        id: p.id,
        type: p.type,
        points: p.points.map((pt) => pt.clone()),
      })),
    }

    addCustomDevice(device)
    onClose()
  }

  const handleUndo = () => engineRef.current?.commandManager.undo()
  const handleRedo = () => engineRef.current?.commandManager.redo()
  const handleClear = () => {
    const engine = engineRef.current
    if (!engine) return
    engine.plan.primitives = []
    engine.notifyChanged()
    engine.requestRender()
  }

  const tools: { id: ModalTool; label: string; icon: Parameters<typeof icon>[0] }[] = [
    { id: 'select', label: 'Выбор', icon: 'select' },
    { id: 'segment', label: 'Отрезок', icon: 'segment' },
    { id: 'rectangle', label: 'Прямоугольник', icon: 'rectangle' },
    { id: 'circle', label: 'Круг', icon: 'circle' },
    { id: 'polyline', label: 'Полилиния', icon: 'polyline' },
    { id: 'move', label: 'Перенести', icon: 'move' },
    { id: 'rotate', label: 'Повернуть', icon: 'rotate' },
    { id: 'trim', label: 'Обрезать', icon: 'trim' },
    { id: 'extend', label: 'Удлинить', icon: 'extend' },
  ]

  return createPortal(
    <div className="device-editor-modal-overlay" onClick={onClose}>
      <div className="device-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="device-editor-modal-header">
          <h3 className="device-editor-modal-title">Редактор устройств</h3>
          <button className="device-editor-modal-close" onClick={onClose} title="Закрыть">
            ×
          </button>
        </div>

        <div className="device-editor-modal-toolbar">
          {tools.map((t) => (
            <button
              key={t.id}
              className={`device-editor-modal-tool-btn ${currentTool === t.id ? 'active' : ''}`}
              onClick={() => {
                setCurrentTool(t.id)
                setError(null)
              }}
              title={t.label}
            >
              <span
                className="ui-icon"
                dangerouslySetInnerHTML={{ __html: icon(t.icon) }}
              />
              <span>{t.label}</span>
            </button>
          ))}
          <div className="device-editor-modal-divider" />
          <button className="device-editor-modal-tool-btn" onClick={handleUndo} title="Отменить">
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('undo') }} />
            <span>Отменить</span>
          </button>
          <button className="device-editor-modal-tool-btn" onClick={handleRedo} title="Повторить">
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('redo') }} />
            <span>Повторить</span>
          </button>
          <button className="device-editor-modal-tool-btn" onClick={handleClear} title="Очистить">
            <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('clear') }} />
            <span>Очистить</span>
          </button>
        </div>

        <div className="device-editor-modal-canvas-wrap">
          <canvas ref={canvasRef} className="device-editor-modal-canvas" />
        </div>

        <div className="device-editor-modal-form">
          <label className="device-editor-modal-field">
            <span>Имя устройства</span>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              placeholder="Например, Розетка 220В"
              className="device-editor-modal-input"
            />
          </label>

          <label className="device-editor-modal-field">
            <span>Категория</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="device-editor-modal-select"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <div className="device-editor-modal-error">{error}</div>}

        <div className="device-editor-modal-actions">
          <button className="device-editor-modal-btn primary" onClick={handleSave}>
            Сохранить
          </button>
          <button className="device-editor-modal-btn" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
