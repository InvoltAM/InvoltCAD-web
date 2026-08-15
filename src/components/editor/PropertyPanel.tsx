/* eslint-disable react-hooks/immutability -- редактор работает через мутации плана по дизайну */
'use client'

import { useEffect, useState } from 'react'
import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'
import { Plan } from '@core/model/Plan'
import { Wall, wallHasArc, createWallArcFromChord } from '@core/model/Wall'
import { Opening } from '@core/model/Opening'
import { Device, DEVICE_SIZE } from '@core/model/Device'
import { Cable } from '@core/model/Cable'
import { Dimension } from '@core/model/Dimension'
import { DrawingPrimitive } from '@core/model/DrawingPrimitive'
import { UpdateWallArcCommand } from '@core/editor/CommandManager'
import { DEVICE_CATALOG, DEVICE_CATEGORIES } from '@core/catalogs/DeviceCatalog'

const WALL_THICKNESS_PRESETS = [100, 150, 200, 250, 300, 400]
const DOOR_WIDTH_PRESETS = [700, 800, 900, 1000]
const WINDOW_WIDTH_PRESETS = [800, 1000, 1200, 1500, 1800]
const DEVICE_OFFSET_PRESETS = [0, 50, 100, 150]

export default function PropertyPanel() {
  const selectedWallIds = useCadStore((s) => s.selectedWallIds)
  const selectedOpeningIds = useCadStore((s) => s.selectedOpeningIds)
  const selectedDeviceIds = useCadStore((s) => s.selectedDeviceIds)
  const selectedCableIds = useCadStore((s) => s.selectedCableIds)
  const selectedDimensionIds = useCadStore((s) => s.selectedDimensionIds)
  const selectedPrimitiveIds = useCadStore((s) => s.selectedPrimitiveIds)
  const currentTool = useCadStore((s) => s.currentTool)
  const { engineRef } = useEditor()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPlan(engineRef.current?.plan ?? null)
    }, 0)
    return () => clearTimeout(timer)
  }, [engineRef])

  // Обновляем панель периодически, чтобы реагировать на мутации плана при мультивыборе.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250)
    return () => clearInterval(id)
  }, [])

  const hasSelection =
    selectedWallIds.length > 0 ||
    selectedOpeningIds.length > 0 ||
    selectedDeviceIds.length > 0 ||
    selectedCableIds.length > 0 ||
    selectedDimensionIds.length > 0 ||
    selectedPrimitiveIds.length > 0

  const hasToolSettings =
    currentTool === 'wall' ||
    currentTool === 'door' ||
    currentTool === 'window' ||
    currentTool === 'device' ||
    currentTool === 'cable'

  if (!plan) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Загрузка…
      </div>
    )
  }

  if (!hasSelection && !hasToolSettings) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Выберите объект или инструмент
      </div>
    )
  }

  const walls = selectedWallIds.map((id) => plan.findWall(id)).filter((w): w is Wall => !!w)
  const openings = selectedOpeningIds
    .map((id) => plan.findOpening(id))
    .filter((o): o is { opening: Opening; wall: Wall } => !!o)
    .map((o) => o.opening)
  const devices = selectedDeviceIds.map((id) => plan.findDevice(id)).filter((d): d is Device => !!d)
  const cables = selectedCableIds.map((id) => plan.findCable(id)).filter((c): c is Cable => !!c)
  const dimensions = selectedDimensionIds
    .map((id) => plan.dimensions.find((d) => d.id === id))
    .filter((d): d is Dimension => !!d)
  const primitives = selectedPrimitiveIds
    .map((id) => plan.primitives.find((p) => p.id === id))
    .filter((p): p is DrawingPrimitive => !!p)

  return (
    <>
      {walls.length > 0 && <WallProperties walls={walls} plan={plan} />}
      {walls.length === 0 && openings.length > 0 && <OpeningProperties openings={openings} />}
      {walls.length === 0 && openings.length === 0 && devices.length > 0 && <DeviceProperties devices={devices} plan={plan} />}
      {walls.length === 0 && openings.length === 0 && devices.length === 0 && cables.length > 0 && <CableProperties cables={cables} />}
      {walls.length === 0 && openings.length === 0 && devices.length === 0 && cables.length === 0 && dimensions.length > 0 && <DimensionProperties dimensions={dimensions} />}
      {walls.length === 0 && openings.length === 0 && devices.length === 0 && cables.length === 0 && dimensions.length === 0 && primitives.length > 0 && <PrimitiveProperties primitives={primitives} plan={plan} />}

      {!hasSelection && currentTool === 'wall' && <WallToolSettings />}
      {!hasSelection && currentTool === 'door' && <DoorToolSettings />}
      {!hasSelection && currentTool === 'window' && <WindowToolSettings />}
      {!hasSelection && currentTool === 'device' && <DeviceToolSettings />}
      {!hasSelection && currentTool === 'cable' && <CableToolSettings />}
    </>
  )
}

function allSame<T>(items: T[], getter: (item: T) => unknown): boolean {
  if (items.length <= 1) return true
  const first = getter(items[0])
  return items.every((item) => getter(item) === first)
}

function commonValue<T, V>(items: T[], getter: (item: T) => V): V | undefined {
  if (!allSame(items, getter)) return undefined
  return getter(items[0])
}

function WallProperties({ walls, plan }: { walls: Wall[]; plan: Plan }) {
  const { engineRef } = useEditor()
  const count = walls.length
  const firstWall = walls[0]
  const hasArc = commonValue(walls, wallHasArc) ?? false
  const [arcEnabled, setArcEnabled] = useState(hasArc)
  const [arcRadius, setArcRadius] = useState(
    commonValue(walls, (w) => (w.arc ? Math.round(w.arc.radius) : 0)) || 1000,
  )
  const [arcSide, setArcSide] = useState<'left' | 'right'>(
    (commonValue(walls, (w) => (w.arc?.clockwise ? 'right' : 'left')) as 'left' | 'right') ?? 'left',
  )

  useEffect(() => {
    setArcEnabled(hasArc)
    setArcRadius(commonValue(walls, (w) => (w.arc ? Math.round(w.arc.radius) : 0)) || 1000)
    setArcSide(
      (commonValue(walls, (w) => (w.arc?.clockwise ? 'right' : 'left')) as 'left' | 'right') ?? 'left',
    )
  }, [walls])

  const commonThickness = commonValue(walls, (w) => w.thickness)

  const handleThicknessChange = (thickness: number) => {
    for (const wall of walls) {
      wall.thickness = thickness
    }
    useCadStore.getState().setWallThickness(thickness)
    plan.invalidateRooms()
    engineRef.current?.notifyChanged()
  }

  const handleApplyArc = () => {
    if (!engineRef.current) return
    const clockwise = arcSide === 'right'
    for (const wall of walls) {
      const chord = wall.a.distanceTo(wall.b)
      const minR = chord / 2 + 1
      let radius = arcRadius
      if (!Number.isFinite(radius) || radius < minR) radius = Math.round(minR)
      const arc = createWallArcFromChord(wall.a, wall.b, radius, clockwise)
      if (arc) {
        engineRef.current.commandManager.execute(new UpdateWallArcCommand(plan, wall.id, arc))
      }
    }
  }

  const handleToggleArc = (enabled: boolean) => {
    setArcEnabled(enabled)
    if (!engineRef.current) return
    if (enabled) {
      for (const wall of walls) {
        const chord = wall.a.distanceTo(wall.b)
        const radius = Math.max(1000, Math.round(chord))
        const clockwise = true
        const arc = createWallArcFromChord(wall.a, wall.b, radius, clockwise)
        if (arc) {
          engineRef.current.commandManager.execute(new UpdateWallArcCommand(plan, wall.id, arc))
        }
      }
    } else {
      for (const wall of walls) {
        engineRef.current.commandManager.execute(new UpdateWallArcCommand(plan, wall.id, undefined))
      }
    }
  }

  return (
    <div className="space-y-3">
      {count > 1 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">Выбрано стен: {count}</div>
      )}

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Толщина стены, мм</label>
        <div className="mb-1 flex flex-wrap gap-1">
          {WALL_THICKNESS_PRESETS.map((t) => (
            <button
              key={t}
              onClick={() => handleThicknessChange(t)}
              className={`rounded border px-2 py-1 text-xs ${
                commonThickness === t
                  ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-600 dark:text-white'
                  : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={commonThickness ?? ''}
          placeholder={commonThickness === undefined ? 'разные' : ''}
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
                    ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-600 dark:text-white'
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
                    ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-600 dark:text-white'
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

function OpeningProperties({ openings }: { openings: Opening[] }) {
  const { engineRef } = useEditor()
  const count = openings.length
  const opening = openings[0]
  const commonWidth = commonValue(openings, (o) => o.width)
  const commonSwingSide = commonValue(openings, (o) => o.swingSide)
  const commonOpenDir = commonValue(openings, (o) => o.openDir)

  const handleWidthChange = (width: number) => {
    for (const opening of openings) {
      opening.width = width
    }
    engineRef.current?.notifyChanged()
  }

  const handleSwingSideChange = (swingSide: 'left' | 'right') => {
    for (const opening of openings) {
      opening.swingSide = swingSide
    }
    engineRef.current?.notifyChanged()
  }

  const handleOpenDirChange = (openDir: 1 | -1) => {
    for (const opening of openings) {
      opening.openDir = openDir
    }
    engineRef.current?.notifyChanged()
  }

  const presets = allSame(openings, (o) => o.type) && opening?.type === 'door' ? DOOR_WIDTH_PRESETS : WINDOW_WIDTH_PRESETS

  return (
    <div className="space-y-3">
      {count > 1 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">Выбрано проёмов: {count}</div>
      )}

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Ширина проёма, мм</label>
        <div className="mb-1 flex flex-wrap gap-1">
          {presets.map((w) => (
            <button
              key={w}
              onClick={() => handleWidthChange(w)}
              className={`rounded border px-2 py-1 text-xs ${
                commonWidth === w
                  ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-600 dark:text-white'
                  : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={commonWidth ?? ''}
          placeholder={commonWidth === undefined ? 'разные' : ''}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (v > 0) handleWidthChange(v)
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      {(!opening || opening.type === 'door') && (
        <>
          <div>
            <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Сторона петель</label>
            <div className="flex gap-1">
              {(['left', 'right'] as const).map((side) => (
                <button
                  key={side}
                  onClick={() => handleSwingSideChange(side)}
                  className={`flex-1 rounded border px-2 py-1 text-xs ${
                    commonSwingSide === side
                      ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-600 dark:text-white'
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
                    commonOpenDir === dir
                      ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-600 dark:text-white'
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

function DeviceProperties({ devices, plan }: { devices: Device[]; plan: Plan }) {
  const { engineRef } = useEditor()
  const deviceIconScale = useCadStore((s) => s.deviceIconScale)
  const count = devices.length
  const device = devices[0]
  const isFree = allSame(devices, (d) => !!d.position) && !!device?.position
  const commonName = commonValue(devices, (d) => d.name)
  const commonType = commonValue(devices, (d) => d.type)
  const commonSide = commonValue(devices, (d) => d.side)
  const commonOffset = commonValue(devices, (d) => Math.round(d.offset))
  const commonIconScale = commonValue(devices, (d) => d.iconScale ?? 1)
  const commonNameOffsetX = commonValue(devices, (d) => Math.round(d.nameOffset?.x ?? 0))
  const commonNameOffsetY = commonValue(devices, (d) => Math.round(d.nameOffset?.y ?? 0))

  const handleNameChange = (name: string) => {
    for (const device of devices) {
      device.name = name
    }
    engineRef.current?.notifyChanged()
  }

  const handleOffsetChange = (offset: number) => {
    for (const device of devices) {
      device.offset = offset
    }
    engineRef.current?.notifyChanged()
  }

  const handleTypeChange = (type: string) => {
    for (const device of devices) {
      device.type = type as Device['type']
    }
    engineRef.current?.notifyChanged()
  }

  const handleSideChange = (side: 1 | -1) => {
    for (const device of devices) {
      device.side = side
    }
    engineRef.current?.notifyChanged()
  }

  const handleIconScaleChange = (scale: number) => {
    for (const device of devices) {
      device.iconScale = scale
    }
    engineRef.current?.notifyChanged()
  }

  const handleNameOffsetXChange = (x: number) => {
    for (const device of devices) {
      device.nameOffset = { x, y: device.nameOffset?.y ?? 0 }
    }
    engineRef.current?.notifyChanged()
  }

  const handleNameOffsetYChange = (y: number) => {
    for (const device of devices) {
      device.nameOffset = { x: device.nameOffset?.x ?? 0, y }
    }
    engineRef.current?.notifyChanged()
  }

  const wall = device && !isFree ? plan.findWall(device.wallId) : null
  const wallLen = wall ? wall.a.distanceTo(wall.b) : 0
  const distanceMm = device && !isFree && wallLen > 0 ? Math.round(device.t * wallLen) : 0

  const handleDistanceChange = (distance: number) => {
    if (!wall || wallLen <= 0 || devices.length > 1) return
    const d = devices[0]
    const scale = deviceIconScale * (d.iconScale ?? 1)
    const size = Math.max(DEVICE_SIZE[d.type].width, DEVICE_SIZE[d.type].height) * scale
    const minDist = size / 2 + 20
    const maxDist = wallLen - size / 2 - 20
    d.t = Math.max(minDist, Math.min(maxDist, distance)) / wallLen
    engineRef.current?.notifyChanged()
  }

  return (
    <div className="space-y-3">
      {count > 1 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">Выбрано устройств: {count}</div>
      )}

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Имя устройства</label>
        <input
          type="text"
          value={commonName ?? ''}
          placeholder={commonName === undefined ? 'разные' : ''}
          onChange={(e) => handleNameChange(e.target.value)}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Смещение подписи, мм</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={commonNameOffsetX ?? ''}
            placeholder={commonNameOffsetX === undefined ? 'разные' : 'X'}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) handleNameOffsetXChange(v)
            }}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <input
            type="number"
            value={commonNameOffsetY ?? ''}
            placeholder={commonNameOffsetY === undefined ? 'разные' : 'Y'}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) handleNameOffsetYChange(v)
            }}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Масштаб иконки</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={commonIconScale ?? 1}
            onChange={(e) => {
              handleIconScaleChange(parseFloat(e.target.value))
            }}
            className="flex-1"
          />
          <span className="w-10 text-right text-xs text-gray-600 dark:text-gray-400">
            {(commonIconScale ?? 1).toFixed(1)}×
          </span>
        </div>
      </div>

      {!isFree && (
        <>
          <div>
            <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Смещение от стены, мм</label>
            <div className="mb-1 flex flex-wrap gap-1">
              {DEVICE_OFFSET_PRESETS.map((off) => (
                <button
                  key={off}
                  onClick={() => handleOffsetChange(off)}
                  className={`rounded border px-2 py-1 text-xs ${
                    commonOffset === off
                      ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-600 dark:text-white'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                  }`}
                >
                  {off}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={commonOffset ?? ''}
              placeholder={commonOffset === undefined ? 'разные' : ''}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v) && v >= 0) handleOffsetChange(v)
              }}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {devices.length === 1 && (
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
          )}
        </>
      )}

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Тип устройства</label>
        <select
          value={commonType ?? ''}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          {commonType === undefined && <option value="">разные</option>}
          {Object.entries(DEVICE_CATEGORIES).map(([category, label]) => (
            <optgroup key={category} label={label}>
              {DEVICE_CATALOG.filter((item) => item.category === category).map((item) => (
                <option key={item.type} value={item.type}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {!isFree && (
        <div>
          <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Сторона стены</label>
          <div className="flex gap-1">
            {([1, -1] as const).map((side) => (
              <button
                key={side}
                onClick={() => handleSideChange(side)}
                className={`flex-1 rounded border px-2 py-1 text-xs ${
                  commonSide === side
                    ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-600 dark:text-white'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                {side === 1 ? 'Сторона A' : 'Сторона B'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CableProperties({ cables }: { cables: Cable[] }) {
  const { engineRef } = useEditor()
  const count = cables.length
  const cable = cables[0]
  const commonType = commonValue(cables, (c) => c.type)
  const commonSection = commonValue(cables, (c) => c.crossSection)
  const commonLength = commonValue(cables, (c) => c.length)

  const handleTypeChange = (type: string) => {
    for (const cable of cables) {
      cable.type = type as Cable['type']
    }
    engineRef.current?.notifyChanged()
  }

  const handleSectionChange = (crossSection: number) => {
    for (const cable of cables) {
      cable.crossSection = crossSection
    }
    engineRef.current?.notifyChanged()
  }

  return (
    <div className="space-y-3">
      {count > 1 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">Выбрано кабелей: {count}</div>
      )}

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Тип кабеля</label>
        <select
          value={commonType ?? ''}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          {commonType === undefined && <option value="">разные</option>}
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
          value={commonSection ?? ''}
          placeholder={commonSection === undefined ? 'разные' : ''}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (v > 0) handleSectionChange(v)
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
          Длина: {commonLength !== undefined ? (commonLength / 1000).toFixed(2) : 'разная'} м
        </label>
      </div>
    </div>
  )
}

function DimensionProperties({ dimensions }: { dimensions: Dimension[] }) {
  const { engineRef } = useEditor()
  const count = dimensions.length
  const dimension = dimensions[0]
  const commonText = commonValue(dimensions, (d) => d.text ?? '')
  const commonLength = commonValue(dimensions, (d) => Math.round(d.length))
  const commonAx = commonValue(dimensions, (d) => Math.round(d.a.x))
  const commonAy = commonValue(dimensions, (d) => Math.round(d.a.y))
  const commonBx = commonValue(dimensions, (d) => Math.round(d.b.x))
  const commonBy = commonValue(dimensions, (d) => Math.round(d.b.y))

  const handleTextChange = (text: string) => {
    const value = text || undefined
    for (const dimension of dimensions) {
      dimension.text = value
    }
    engineRef.current?.notifyChanged()
  }

  const updatePoint = (point: 'a' | 'b', axis: 'x' | 'y', value: number) => {
    if (dimensions.length > 1) return
    const dimension = dimensions[0]
    dimension[point][axis] = value
    dimension.length = dimension.a.distanceTo(dimension.b)
    engineRef.current?.notifyChanged()
  }

  return (
    <div className="space-y-3">
      {count > 1 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">Выбрано размеров: {count}</div>
      )}

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Подпись размера</label>
        <input
          type="text"
          value={commonText ?? ''}
          placeholder={commonText === undefined ? 'разные' : `${commonLength ?? Math.round(dimension.length)} мм`}
          onChange={(e) => handleTextChange(e.target.value)}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">
          Длина: {commonLength !== undefined ? `${commonLength} мм` : 'разная'}
        </label>
      </div>

      {dimensions.length === 1 && (
        <>
          <div>
            <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Точка A</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={commonAx ?? ''}
                onChange={(e) => updatePoint('a', 'x', parseFloat(e.target.value))}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <input
                type="number"
                value={commonAy ?? ''}
                onChange={(e) => updatePoint('a', 'y', parseFloat(e.target.value))}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Точка B</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={commonBx ?? ''}
                onChange={(e) => updatePoint('b', 'x', parseFloat(e.target.value))}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <input
                type="number"
                value={commonBy ?? ''}
                onChange={(e) => updatePoint('b', 'y', parseFloat(e.target.value))}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </>
      )}
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
                  ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-600 dark:text-white'
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
                  ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-600 dark:text-white'
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
                ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-600 dark:text-white'
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
                ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-600 dark:text-white'
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
          {Object.entries(DEVICE_CATEGORIES).map(([category, label]) => (
            <optgroup key={category} label={label}>
              {DEVICE_CATALOG.filter((item) => item.category === category).map((item) => (
                <option key={item.type} value={item.type}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
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

function PrimitiveProperties({ primitives }: { primitives: DrawingPrimitive[]; plan: Plan }) {
  const { engineRef } = useEditor()
  const tablePrimitives = primitives.filter((p) => p.type === 'table')
  const textPrimitives = primitives.filter((p) => p.type === 'text')
  const shapePrimitives = primitives.filter((p) => ['polyline', 'segment', 'rectangle', 'circle'].includes(p.type))

  return (
    <div className="space-y-4">
      {shapePrimitives.length > 0 && (
        <ShapeProperties primitives={shapePrimitives} />
      )}

      {textPrimitives.length > 0 && (
        <TextProperties primitives={textPrimitives} />
      )}

      {tablePrimitives.length > 0 && (
        <TableProperties primitives={tablePrimitives} />
      )}
    </div>
  )
}

function ShapeProperties({ primitives }: { primitives: DrawingPrimitive[] }) {
  const { engineRef } = useEditor()
  const hasFillable = primitives.some((p) => p.type === 'rectangle' || p.type === 'circle')

  const commonLineWidth = commonValue(primitives, (p) => p.lineWidth) ?? 1
  const commonLineColor = commonValue(primitives, (p) => p.lineColor) ?? ''
  const commonLineStyle = commonValue(primitives, (p) => p.lineStyle) ?? 'solid'
  const commonFillColor = commonValue(primitives, (p) => p.fillColor) ?? ''

  const apply = (patch: Partial<DrawingPrimitive>) => {
    for (const p of primitives) {
      if (patch.lineWidth !== undefined) p.lineWidth = patch.lineWidth
      if (patch.lineColor !== undefined) p.lineColor = patch.lineColor || undefined
      if (patch.lineStyle !== undefined) p.lineStyle = patch.lineStyle
      if (patch.fillColor !== undefined) p.fillColor = patch.fillColor || undefined
    }
    engineRef.current?.notifyChanged()
    engineRef.current?.requestRender()
  }

  return (
    <div className="space-y-3">
      {primitives.length > 1 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">Выбрано примитивов: {primitives.length}</div>
      )}

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Толщина линии, мм</label>
        <input
          type="number"
          min={0.1}
          step={0.1}
          value={commonLineWidth}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (Number.isFinite(v) && v > 0) apply({ lineWidth: v })
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Стиль линии</label>
        <select
          value={commonLineStyle}
          onChange={(e) => apply({ lineStyle: e.target.value as DrawingPrimitive['lineStyle'] })}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="solid">Сплошная</option>
          <option value="dashed">Штриховая</option>
          <option value="dotted">Пунктирная</option>
          <option value="dashdot">Штрих-пунктирная</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Цвет линии</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={commonLineColor || '#000000'}
            onChange={(e) => apply({ lineColor: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded border border-gray-300 dark:border-gray-600"
          />
          <input
            type="text"
            value={commonLineColor || ''}
            onChange={(e) => apply({ lineColor: e.target.value })}
            placeholder="#000000"
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          {commonLineColor && (
            <button
              onClick={() => apply({ lineColor: undefined })}
              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Авто
            </button>
          )}
        </div>
      </div>

      {hasFillable && (
        <div>
          <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Заливка</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={commonFillColor || '#000000'}
              onChange={(e) => apply({ fillColor: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border border-gray-300 dark:border-gray-600"
            />
            <input
              type="text"
              value={commonFillColor || ''}
              onChange={(e) => apply({ fillColor: e.target.value })}
              placeholder="transparent"
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            {commonFillColor && (
              <button
                onClick={() => apply({ fillColor: undefined })}
                className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Нет
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TextProperties({ primitives }: { primitives: DrawingPrimitive[] }) {
  const { engineRef } = useEditor()

  const count = primitives.length
  const commonText = commonValue(primitives, (p) => p.text) ?? ''
  const commonFontSize = commonValue(primitives, (p) => p.fontSize) ?? 250
  const commonFontFamily = commonValue(primitives, (p) => p.fontFamily) ?? 'ui-sans-serif, system-ui, sans-serif'
  const commonColor = commonValue(primitives, (p) => p.color) ?? ''
  const commonItalic = commonValue(primitives, (p) => p.italic) ?? false
  const commonTextAlign = commonValue(primitives, (p) => p.textAlign) ?? 'left'

  const apply = (patch: Partial<DrawingPrimitive>) => {
    for (const p of primitives) {
      if (patch.text !== undefined) p.text = patch.text
      if (patch.fontSize !== undefined) p.fontSize = patch.fontSize
      if (patch.fontFamily !== undefined) p.fontFamily = patch.fontFamily
      if (patch.color !== undefined) p.color = patch.color || undefined
      if (patch.italic !== undefined) p.italic = patch.italic
      if (patch.textAlign !== undefined) p.textAlign = patch.textAlign
    }
    engineRef.current?.notifyChanged()
    engineRef.current?.requestRender()
  }

  return (
    <div className="space-y-3">
      {count > 1 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">Выбрано текстовых блоков: {count}</div>
      )}

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Текст</label>
        <textarea
          rows={3}
          value={commonText}
          onChange={(e) => apply({ text: e.target.value })}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Размер шрифта, мм</label>
        <input
          type="number"
          min={10}
          step={10}
          value={commonFontSize}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (Number.isFinite(v) && v > 0) apply({ fontSize: v })
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Шрифт</label>
        <select
          value={commonFontFamily}
          onChange={(e) => apply({ fontFamily: e.target.value })}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="ui-sans-serif, system-ui, sans-serif">Без засечек</option>
          <option value="serif">С засечками</option>
          <option value="monospace">Моноширинный</option>
          <option value="Arial, Helvetica, sans-serif">Arial</option>
          <option value="Times New Roman, Times, serif">Times New Roman</option>
          <option value="Courier New, Courier, monospace">Courier New</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Цвет</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={commonColor || '#000000'}
            onChange={(e) => apply({ color: e.target.value })}
            className="h-8 w-8 cursor-pointer rounded border border-gray-300 dark:border-gray-600"
          />
          <input
            type="text"
            value={commonColor || ''}
            onChange={(e) => apply({ color: e.target.value })}
            placeholder="#000000"
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          {commonColor && (
            <button
              onClick={() => apply({ color: undefined })}
              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Авто
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={commonItalic}
            onChange={(e) => apply({ italic: e.target.checked })}
          />
          Курсив
        </label>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Выравнивание</label>
        <div className="flex rounded border border-gray-300 dark:border-gray-600">
          {[
            { value: 'left', label: 'Лево' },
            { value: 'center', label: 'Центр' },
            { value: 'right', label: 'Право' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => apply({ textAlign: opt.value as DrawingPrimitive['textAlign'] })}
              className={`flex-1 px-2 py-1 text-xs ${
                commonTextAlign === opt.value
                  ? 'bg-orange-500 text-white'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function TableProperties({ primitives }: { primitives: DrawingPrimitive[] }) {
  const { engineRef } = useEditor()
  const first = primitives[0]
  const table = first?.table
  const [tick, setTick] = useState(0)

  if (!table || primitives.length > 1) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {primitives.length > 1
          ? 'Редактирование таблицы доступно только по одной таблице за раз.'
          : 'Таблица не найдена.'}
      </div>
    )
  }

  const forceUpdate = () => {
    setTick((t) => t + 1)
    engineRef.current?.notifyChanged()
    engineRef.current?.requestRender()
  }

  const updateCell = (row: number, col: number, patch: Partial<import('@core/model/DrawingPrimitive').DrawingTableCell>) => {
    const cell = table.cells.find((c) => c.row === row && c.col === col)
    if (!cell) return
    Object.assign(cell, patch)
    forceUpdate()
  }

  const updateColumnWidth = (col: number, width: number) => {
    if (width <= 0) return
    table.columnWidths[col] = width
    forceUpdate()
  }

  const updateRowHeight = (row: number, height: number) => {
    if (height <= 0) return
    table.rowHeights[row] = height
    forceUpdate()
  }

  const addRow = () => {
    const newRow = table.rows
    table.rows++
    table.rowHeights.push(500)
    for (let c = 0; c < table.cols; c++) {
      table.cells.push({ row: newRow, col: c })
    }
    forceUpdate()
  }

  const removeRow = () => {
    if (table.rows <= 1) return
    const lastRow = table.rows - 1
    table.rows--
    table.rowHeights.pop()
    table.cells = table.cells.filter((c) => c.row !== lastRow)
    for (const cell of table.cells) {
      if (cell.rowSpan && cell.row + (cell.rowSpan - 1) > table.rows - 1) {
        cell.rowSpan = Math.max(1, table.rows - cell.row)
      }
    }
    forceUpdate()
  }

  const addCol = () => {
    const newCol = table.cols
    table.cols++
    table.columnWidths.push(600)
    for (let r = 0; r < table.rows; r++) {
      table.cells.push({ row: r, col: newCol })
    }
    forceUpdate()
  }

  const removeCol = () => {
    if (table.cols <= 1) return
    const lastCol = table.cols - 1
    table.cols--
    table.columnWidths.pop()
    table.cells = table.cells.filter((c) => c.col !== lastCol)
    for (const cell of table.cells) {
      if (cell.colSpan && cell.col + (cell.colSpan - 1) > table.cols - 1) {
        cell.colSpan = Math.max(1, table.cols - cell.col)
      }
    }
    forceUpdate()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">Редактирование таблицы</span>
        <div className="flex gap-1">
          <button
            onClick={addRow}
            className="rounded border border-gray-300 px-1.5 py-0.5 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            title="Добавить строку"
          >
            + строка
          </button>
          <button
            onClick={removeRow}
            className="rounded border border-gray-300 px-1.5 py-0.5 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            title="Удалить строку"
          >
            − строка
          </button>
          <button
            onClick={addCol}
            className="rounded border border-gray-300 px-1.5 py-0.5 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            title="Добавить столбец"
          >
            + столбец
          </button>
          <button
            onClick={removeCol}
            className="rounded border border-gray-300 px-1.5 py-0.5 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            title="Удалить столбец"
          >
            − столбец
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Размер шрифта таблицы, мм</label>
        <input
          type="number"
          min={10}
          step={10}
          value={table.fontSize ?? 140}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (Number.isFinite(v) && v > 0) {
              table.fontSize = v
              forceUpdate()
            }
          }}
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
      </div>

      <div className="max-h-64 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-gray-300 px-1 py-1 dark:border-gray-600"></th>
              {Array.from({ length: table.cols }).map((_, c) => (
                <th key={c} className="border border-gray-300 px-1 py-1 dark:border-gray-600">
                  <input
                    type="number"
                    min={10}
                    step={10}
                    value={table.columnWidths[c]}
                    onChange={(e) => updateColumnWidth(c, parseFloat(e.target.value))}
                    className="w-16 rounded border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    title="Ширина столбца"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: table.rows }).map((_, r) => (
              <tr key={r}>
                <td className="border border-gray-300 px-1 py-1 dark:border-gray-600">
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={table.rowHeights[r]}
                    onChange={(e) => updateRowHeight(r, parseFloat(e.target.value))}
                    className="w-16 rounded border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    title="Высота строки"
                  />
                </td>
                {Array.from({ length: table.cols }).map((_, c) => {
                  const cell = table.cells.find((x) => x.row === r && x.col === c)
                  if (!cell) return <td key={c} className="border border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-800" />
                  return (
                    <td key={c} className="border border-gray-300 px-1 py-1 dark:border-gray-600">
                      <input
                        type="text"
                        value={cell.text ?? ''}
                        onChange={(e) => updateCell(r, c, { text: e.target.value })}
                        className="w-full rounded border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                      <div className="mt-1 flex gap-1">
                        <input
                          type="number"
                          min={1}
                          value={cell.rowSpan ?? 1}
                          onChange={(e) => updateCell(r, c, { rowSpan: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                          className="w-10 rounded border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          title="Row span"
                        />
                        <input
                          type="number"
                          min={1}
                          value={cell.colSpan ?? 1}
                          onChange={(e) => updateCell(r, c, { colSpan: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                          className="w-10 rounded border border-gray-300 px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          title="Col span"
                        />
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
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
