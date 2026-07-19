/* eslint-disable react-hooks/immutability -- редактор работает через мутации плана по дизайну */
'use client'

import { useEffect, useState } from 'react'
import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'
import { Plan } from '@core/model/Plan'
import { Wall, wallHasArc, createWallArcFromChord } from '@core/model/Wall'
import { Opening } from '@core/model/Opening'
import { Device, defaultDeviceHeight, DEVICE_SIZE } from '@core/model/Device'
import { Cable } from '@core/model/Cable'
import { Dimension } from '@core/model/Dimension'
import { UpdateWallArcCommand } from '@core/editor/CommandManager'

const WALL_THICKNESS_PRESETS = [100, 150, 200, 250, 300, 400]
const DOOR_WIDTH_PRESETS = [700, 800, 900, 1000]
const WINDOW_WIDTH_PRESETS = [800, 1000, 1200, 1500, 1800]
const DEVICE_OFFSET_PRESETS = [0, 50, 100, 150]

export default function PropertyPanel() {
  const selectedWallId = useCadStore((s) => s.selectedWallId)
  const selectedOpeningId = useCadStore((s) => s.selectedOpeningId)
  const selectedDeviceId = useCadStore((s) => s.selectedDeviceId)
  const selectedCableId = useCadStore((s) => s.selectedCableId)
  const selectedDimensionId = useCadStore((s) => s.selectedDimensionId)
  const currentTool = useCadStore((s) => s.currentTool)
  const { engineRef } = useEditor()
  const [plan, setPlan] = useState<Plan | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPlan(engineRef.current?.plan ?? null)
    }, 0)
    return () => clearTimeout(timer)
  }, [engineRef])

  const hasSelection =
    selectedWallId ||
    selectedOpeningId ||
    selectedDeviceId ||
    selectedCableId ||
    selectedDimensionId

  const hasToolSettings =
    currentTool === 'wall' ||
    currentTool === 'door' ||
    currentTool === 'window' ||
    currentTool === 'device' ||
    currentTool === 'cable'

  if (!hasSelection && !hasToolSettings) {
    return (
      <div className="absolute right-3 top-3 z-20 hidden w-48 rounded-lg border border-gray-200 bg-white p-3 shadow-md dark:border-gray-700 dark:bg-gray-800 md:block">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Выберите объект или инструмент
        </div>
      </div>
    )
  }

  const wall = selectedWallId && plan ? plan.findWall(selectedWallId) : null
  const opening = selectedOpeningId && plan ? plan.findOpening(selectedOpeningId) : null
  const device = selectedDeviceId && plan ? plan.findDevice(selectedDeviceId) : null
  const cable = selectedCableId && plan ? plan.findCable(selectedCableId) : null
  const dimension = selectedDimensionId && plan ? plan.dimensions.find(d => d.id === selectedDimensionId) : null

  return (
    <div className="absolute right-3 top-3 z-20 hidden w-48 rounded-lg border border-gray-200 bg-white p-3 shadow-md dark:border-gray-700 dark:bg-gray-800 md:block">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-gray-900 dark:text-white">Свойства</span>
        <button
          onClick={() => useCadStore.getState().clearSelection()}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          ×
        </button>
      </div>

      {wall && <WallProperties wall={wall} plan={plan!} />}
      {opening && <OpeningProperties opening={opening.opening} />}
      {device && <DeviceProperties device={device} plan={plan!} />}
      {cable && <CableProperties cable={cable} />}
      {dimension && <DimensionProperties dimension={dimension} />}

      {!hasSelection && currentTool === 'wall' && <WallToolSettings />}
      {!hasSelection && currentTool === 'door' && <DoorToolSettings />}
      {!hasSelection && currentTool === 'window' && <WindowToolSettings />}
      {!hasSelection && currentTool === 'device' && <DeviceToolSettings />}
      {!hasSelection && currentTool === 'cable' && <CableToolSettings />}
    </div>
  )
}

function WallProperties({ wall, plan }: { wall: Wall; plan: Plan }) {
  const { engineRef } = useEditor()
  const [arcEnabled, setArcEnabled] = useState(wallHasArc(wall))
  const [arcRadius, setArcRadius] = useState(wall.arc ? Math.round(wall.arc.radius) : 1000)
  const [arcSide, setArcSide] = useState<'left' | 'right'>(wall.arc?.clockwise ? 'right' : 'left')

  const handleThicknessChange = (thickness: number) => {
    wall.thickness = thickness
    useCadStore.getState().setWallThickness(thickness)
    plan.invalidateRooms()
    engineRef.current?.notifyChanged()
  }

  const handleApplyArc = () => {
    if (!engineRef.current) return
    const chord = wall.a.distanceTo(wall.b)
    const minR = chord / 2 + 1
    let radius = arcRadius
    if (!Number.isFinite(radius) || radius < minR) radius = Math.round(minR)
    const clockwise = arcSide === 'right'
    const arc = createWallArcFromChord(wall.a, wall.b, radius, clockwise)
    if (arc) {
      engineRef.current.commandManager.execute(new UpdateWallArcCommand(plan, wall.id, arc))
    }
  }

  const handleToggleArc = (enabled: boolean) => {
    setArcEnabled(enabled)
    if (!engineRef.current) return
    if (enabled) {
      const chord = wall.a.distanceTo(wall.b)
      const radius = Math.max(1000, Math.round(chord))
      const clockwise = true
      const arc = createWallArcFromChord(wall.a, wall.b, radius, clockwise)
      if (arc) {
        engineRef.current.commandManager.execute(new UpdateWallArcCommand(plan, wall.id, arc))
      }
    } else {
      engineRef.current.commandManager.execute(new UpdateWallArcCommand(plan, wall.id, undefined))
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Толщина стены, мм</label>
        <div className="mb-1 flex flex-wrap gap-1">
          {WALL_THICKNESS_PRESETS.map((t) => (
            <button
              key={t}
              onClick={() => handleThicknessChange(t)}
              className={`rounded border px-2 py-1 text-xs ${
                wall.thickness === t
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={wall.thickness}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (v > 0) handleThicknessChange(v)
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={arcEnabled}
            onChange={(e) => handleToggleArc(e.target.checked)}
          />
          Дуговая стена
        </label>
        {arcEnabled && (
          <div className="mt-1 space-y-1">
            <input
              type="number"
              value={arcRadius}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                setArcRadius(v)
              }}
              onBlur={handleApplyArc}
              placeholder="Радиус"
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setArcSide('left')
                  handleApplyArc()
                }}
                className={`flex-1 rounded border px-2 py-1 text-xs ${
                  arcSide === 'left'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                Лево
              </button>
              <button
                onClick={() => {
                  setArcSide('right')
                  handleApplyArc()
                }}
                className={`flex-1 rounded border px-2 py-1 text-xs ${
                  arcSide === 'right'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                Право
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function OpeningProperties({ opening }: { opening: Opening }) {
  const { engineRef } = useEditor()

  const handleWidthChange = (width: number) => {
    opening.width = width
    engineRef.current?.notifyChanged()
  }

  const handleSwingSideChange = (swingSide: 'left' | 'right') => {
    opening.swingSide = swingSide
    engineRef.current?.notifyChanged()
  }

  const handleOpenDirChange = (openDir: 1 | -1) => {
    opening.openDir = openDir
    engineRef.current?.notifyChanged()
  }

  const presets = opening.type === 'door' ? DOOR_WIDTH_PRESETS : WINDOW_WIDTH_PRESETS

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Ширина проёма, мм</label>
        <div className="mb-1 flex flex-wrap gap-1">
          {presets.map((w) => (
            <button
              key={w}
              onClick={() => handleWidthChange(w)}
              className={`rounded border px-2 py-1 text-xs ${
                opening.width === w
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={opening.width}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (v > 0) handleWidthChange(v)
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      {opening.type === 'door' && (
        <>
          <div>
            <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Сторона петель</label>
            <div className="flex gap-1">
              {(['left', 'right'] as const).map((side) => (
                <button
                  key={side}
                  onClick={() => handleSwingSideChange(side)}
                  className={`flex-1 rounded border px-2 py-1 text-xs ${
                    opening.swingSide === side
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  {side === 'left' ? 'Левые' : 'Правые'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Направление открывания</label>
            <div className="flex gap-1">
              {([1, -1] as const).map((dir) => (
                <button
                  key={dir}
                  onClick={() => handleOpenDirChange(dir)}
                  className={`flex-1 rounded border px-2 py-1 text-xs ${
                    opening.openDir === dir
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  {dir === 1 ? 'Внутрь' : 'Наружу'}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function DeviceProperties({ device, plan }: { device: Device; plan: Plan }) {
  const { engineRef } = useEditor()

  const handleNameChange = (name: string) => {
    device.name = name
    engineRef.current?.notifyChanged()
  }

  const handleOffsetChange = (offset: number) => {
    device.offset = offset
    engineRef.current?.notifyChanged()
  }

  const handleHeightChange = (height: number) => {
    device.height = height
    engineRef.current?.notifyChanged()
  }

  const handleTypeChange = (type: string) => {
    device.type = type as Device['type']
    engineRef.current?.notifyChanged()
  }

  const handleSideChange = (side: 1 | -1) => {
    device.side = side
    engineRef.current?.notifyChanged()
  }

  const wall = plan.findWall(device.wallId)
  const wallLen = wall ? wall.a.distanceTo(wall.b) : 0
  const distanceMm = Math.round(device.t * wallLen)

  const handleDistanceChange = (distance: number) => {
    if (wall && wallLen > 0) {
      const size = Math.max(DEVICE_SIZE[device.type].width, DEVICE_SIZE[device.type].height)
      const minDist = size / 2 + 20
      const maxDist = wallLen - size / 2 - 20
      device.t = Math.max(minDist, Math.min(maxDist, distance)) / wallLen
      engineRef.current?.notifyChanged()
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Имя устройства</label>
        <input
          type="text"
          value={device.name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Смещение от стены, мм</label>
        <div className="mb-1 flex flex-wrap gap-1">
          {DEVICE_OFFSET_PRESETS.map((off) => (
            <button
              key={off}
              onClick={() => handleOffsetChange(off)}
              className={`rounded border px-2 py-1 text-xs ${
                Math.abs(device.offset - off) < 5
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              {off}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={Math.round(device.offset)}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (v >= 0) handleOffsetChange(v)
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Высота установки, мм</label>
        <input
          type="number"
          value={Math.round(device.height ?? defaultDeviceHeight(device.type))}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (!isNaN(v) && v >= 0) handleHeightChange(v)
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Расстояние от начала стены, мм</label>
        <input
          type="number"
          value={distanceMm}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (!isNaN(v)) handleDistanceChange(v)
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Тип устройства</label>
        <select
          value={device.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="socket">Розетка</option>
          <option value="socket-uz">Розетка с заземлением</option>
          <option value="socket-usb">Розетка USB</option>
          <option value="switch">Выключатель</option>
          <option value="switch-2">Двойной выключатель</option>
          <option value="panel">Щит</option>
          <option value="breaker">Автомат</option>
          <option value="light">Светильник</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Сторона стены</label>
        <div className="flex gap-1">
          {([1, -1] as const).map((side) => (
            <button
              key={side}
              onClick={() => handleSideChange(side)}
              className={`flex-1 rounded border px-2 py-1 text-xs ${
                device.side === side
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              {side === 1 ? 'Сторона A' : 'Сторона B'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function CableProperties({ cable }: { cable: Cable }) {
  const { engineRef } = useEditor()

  const handleTypeChange = (type: string) => {
    cable.type = type as Cable['type']
    engineRef.current?.notifyChanged()
  }

  const handleSectionChange = (crossSection: number) => {
    cable.crossSection = crossSection
    engineRef.current?.notifyChanged()
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Тип кабеля</label>
        <select
          value={cable.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="power">Силовой</option>
          <option value="lighting">Освещение</option>
          <option value="low-current">Слаботочка</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Сечение, мм²</label>
        <input
          type="number"
          step="0.5"
          value={cable.crossSection}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (v > 0) handleSectionChange(v)
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
          Длина: {(cable.length / 1000).toFixed(2)} м
        </label>
      </div>
    </div>
  )
}

function DimensionProperties({ dimension }: { dimension: Dimension }) {
  const { engineRef } = useEditor()

  const handleTextChange = (text: string) => {
    dimension.text = text || undefined
    engineRef.current?.notifyChanged()
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Подпись размера</label>
        <input
          type="text"
          value={dimension.text ?? ''}
          placeholder={`${Math.round(dimension.length)} мм`}
          onChange={(e) => handleTextChange(e.target.value)}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
          Длина: {Math.round(dimension.length)} мм
        </label>
      </div>
    </div>
  )
}

function WallToolSettings() {
  const wallThickness = useCadStore((s) => s.wallThickness)
  const setWallThickness = useCadStore((s) => s.setWallThickness)
  const wallJoinStyle = useCadStore((s) => s.wallJoinStyle)
  const setWallJoinStyle = useCadStore((s) => s.setWallJoinStyle)
  const { engineRef } = useEditor()

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Толщина новой стены, мм</label>
        <div className="mb-1 flex flex-wrap gap-1">
          {WALL_THICKNESS_PRESETS.map((t) => (
            <button
              key={t}
              onClick={() => setWallThickness(t)}
              className={`rounded border px-2 py-1 text-xs ${
                wallThickness === t
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={wallThickness}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (v > 0) setWallThickness(v)
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Стиль соединений стен</label>
        <div className="flex flex-wrap gap-1">
          {(['square', 'round', 'miter', 'bevel', 'none'] as const).map((style) => (
            <button
              key={style}
              onClick={() => {
                setWallJoinStyle(style)
                engineRef.current?.requestRender()
              }}
              className={`rounded border px-2 py-1 text-xs ${
                wallJoinStyle === style
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              {style === 'square' ? 'Прямые' : style === 'round' ? 'Скруглённые' : style === 'miter' ? 'Острые' : style === 'bevel' ? 'Скошенные' : 'Без'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function DoorToolSettings() {
  const doorWidth = useCadStore((s) => s.doorWidth)
  const setDoorWidth = useCadStore((s) => s.setDoorWidth)

  return (
    <div>
      <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Ширина новой двери, мм</label>
      <div className="mb-1 flex flex-wrap gap-1">
        {DOOR_WIDTH_PRESETS.map((w) => (
          <button
            key={w}
            onClick={() => setDoorWidth(w)}
            className={`rounded border px-2 py-1 text-xs ${
              doorWidth === w
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
            }`}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  )
}

function WindowToolSettings() {
  const windowWidth = useCadStore((s) => s.windowWidth)
  const setWindowWidth = useCadStore((s) => s.setWindowWidth)

  return (
    <div>
      <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Ширина нового окна, мм</label>
      <div className="mb-1 flex flex-wrap gap-1">
        {WINDOW_WIDTH_PRESETS.map((w) => (
          <button
            key={w}
            onClick={() => setWindowWidth(w)}
            className={`rounded border px-2 py-1 text-xs ${
              windowWidth === w
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
            }`}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  )
}

function DeviceToolSettings() {
  const selectedDeviceType = useCadStore((s) => s.selectedDeviceType)
  const setSelectedDeviceType = useCadStore((s) => s.setSelectedDeviceType)
  const deviceIconScale = useCadStore((s) => s.deviceIconScale)
  const setDeviceIconScale = useCadStore((s) => s.setDeviceIconScale)
  const { engineRef } = useEditor()

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Тип устройства для размещения</label>
        <select
          value={selectedDeviceType}
          onChange={(e) => setSelectedDeviceType(e.target.value as Device['type'])}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="socket">Розетка</option>
          <option value="socket-uz">Розетка с заземлением</option>
          <option value="socket-usb">Розетка USB</option>
          <option value="switch">Выключатель</option>
          <option value="switch-2">Двойной выключатель</option>
          <option value="panel">Щит</option>
          <option value="breaker">Автомат</option>
          <option value="light">Светильник</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Масштаб иконки</label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={deviceIconScale}
          onChange={(e) => {
            setDeviceIconScale(parseFloat(e.target.value))
            engineRef.current?.requestRender()
          }}
          className="w-full"
        />
      </div>
    </div>
  )
}

function CableToolSettings() {
  const defaultCableType = useCadStore((s) => s.defaultCableType)
  const setDefaultCableType = useCadStore((s) => s.setDefaultCableType)
  const defaultCableSection = useCadStore((s) => s.defaultCableSection)
  const setDefaultCableSection = useCadStore((s) => s.setDefaultCableSection)

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Тип кабеля по умолчанию</label>
        <select
          value={defaultCableType}
          onChange={(e) => setDefaultCableType(e.target.value as Cable['type'])}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="power">Силовой</option>
          <option value="lighting">Освещение</option>
          <option value="low-current">Слаботочка</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Сечение по умолчанию, мм²</label>
        <input
          type="number"
          step="0.5"
          value={defaultCableSection}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (v > 0) setDefaultCableSection(v)
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>
    </div>
  )
}
