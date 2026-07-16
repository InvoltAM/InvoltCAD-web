import { Plan } from '@core/model/Plan'
import { Wall } from '@core/model/Wall'
import { Opening } from '@core/model/Opening'
import { Device, DeviceType } from '@core/model/Device'
import { Cable, CableType } from '@core/model/Cable'
import { Dimension } from '@core/model/Dimension'
import { Vector2 } from '@core/geometry/Vector2'

export interface SerializedWall {
  id: string
  startX: number
  startY: number
  endX: number
  endY: number
  thickness: number
  arcRadius?: number
  arcClockwise?: boolean
}

export interface SerializedOpening {
  id: string
  wallId: string
  t: number
  width: number
  type: 'door' | 'window'
  height: number
  swingSide: 'left' | 'right'
  openDir: 1 | -1
}

export interface SerializedDevice {
  id: string
  deviceType: string
  name: string
  wallId: string
  t: number
  side: number
  offset: number
  height?: number
  rotation: number
}

export interface SerializedCable {
  id: string
  cableType: string
  crossSection: number
  length: number
  totalLength?: number
  route: Array<{ x: number; y: number }>
  fromDeviceId: string
  toDeviceId: string
}

export interface SerializedDimension {
  id: string
  startX: number
  startY: number
  endX: number
  endY: number
  length: number
  text?: string
}

export interface SerializedPlan {
  walls: SerializedWall[]
  openings: SerializedOpening[]
  devices: SerializedDevice[]
  cables: SerializedCable[]
  dimensions: SerializedDimension[]
}

/**
 * Сериализует Plan из core в формат для сохранения в БД.
 */
export function serializePlan(plan: Plan): SerializedPlan {
  const walls: SerializedWall[] = []
  const openings: SerializedOpening[] = []

  for (const wall of plan.walls) {
    walls.push({
      id: wall.id,
      startX: wall.a.x,
      startY: wall.a.y,
      endX: wall.b.x,
      endY: wall.b.y,
      thickness: wall.thickness,
      arcRadius: wall.arc?.radius,
      arcClockwise: wall.arc?.clockwise,
    })

    for (const opening of wall.openings) {
      openings.push({
        id: opening.id,
        wallId: wall.id,
        t: opening.t,
        width: opening.width,
        type: opening.type,
        height: 2000, // в нашей модели высота не хранится, используем дефолт
        swingSide: opening.swingSide ?? 'left',
        openDir: opening.openDir ?? 1,
      })
    }
  }

  const devices: SerializedDevice[] = plan.devices.map((device) => ({
    id: device.id,
    deviceType: device.type,
    name: device.name,
    wallId: device.wallId,
    t: device.t,
    side: device.side,
    offset: device.offset,
    height: device.height,
    rotation: device.rotation,
  }))

  const cables: SerializedCable[] = plan.cables.map((cable) => ({
    id: cable.id,
    cableType: cable.type,
    crossSection: cable.crossSection,
    length: cable.length,
    totalLength: cable.totalLength,
    route: cable.route.map((p) => ({ x: p.x, y: p.y })),
    fromDeviceId: cable.fromDeviceId,
    toDeviceId: cable.toDeviceId,
  }))

  const dimensions: SerializedDimension[] = plan.dimensions.map((dim) => ({
    id: dim.id,
    startX: dim.a.x,
    startY: dim.a.y,
    endX: dim.b.x,
    endY: dim.b.y,
    length: dim.length,
    text: dim.text,
  }))

  return { walls, openings, devices, cables, dimensions }
}

/**
 * Десериализует данные из БД в Plan.
 */
export function deserializePlan(data: SerializedPlan): Plan {
  const plan = new Plan()

  // Создаём стены
  const wallMap = new Map<string, Wall>()
  for (const w of data.walls) {
    const wall: Wall = {
      id: w.id,
      a: new Vector2(w.startX, w.startY),
      b: new Vector2(w.endX, w.endY),
      thickness: w.thickness,
      openings: [],
      arc:
        w.arcRadius && w.arcClockwise !== undefined
          ? {
              center: new Vector2(0, 0), // пересчитаем ниже
              radius: w.arcRadius,
              startAngle: 0,
              endAngle: 0,
              clockwise: w.arcClockwise,
            }
          : undefined,
    }
    plan.walls.push(wall)
    wallMap.set(w.id, wall)
  }

  // Создаём проёмы
  for (const o of data.openings) {
    const wall = wallMap.get(o.wallId)
    if (!wall) continue
    const opening: Opening = {
      id: o.id,
      type: o.type,
      wallId: o.wallId,
      t: o.t,
      width: o.width,
      swingSide: o.swingSide,
      openDir: o.openDir,
    }
    wall.openings.push(opening)
  }

  // Создаём устройства
  for (const d of data.devices) {
    const device: Device = {
      id: d.id,
      type: d.deviceType as DeviceType,
      name: d.name,
      wallId: d.wallId,
      t: d.t,
      side: d.side as 1 | -1,
      offset: d.offset,
      rotation: d.rotation,
      height: d.height,
    }
    plan.devices.push(device)
  }

  // Создаём кабели
  for (const c of data.cables) {
    const cable: Cable = {
      id: c.id,
      fromDeviceId: c.fromDeviceId,
      toDeviceId: c.toDeviceId,
      type: c.cableType as CableType,
      crossSection: c.crossSection,
      length: c.length,
      totalLength: c.totalLength,
      route: c.route.map((p) => new Vector2(p.x, p.y)),
    }
    plan.cables.push(cable)
  }

  // Создаём размеры
  for (const d of data.dimensions) {
    const dimension: Dimension = {
      id: d.id,
      a: new Vector2(d.startX, d.startY),
      b: new Vector2(d.endX, d.endY),
      length: d.length,
      text: d.text,
    }
    plan.dimensions.push(dimension)
  }

  plan.invalidateRooms()
  return plan
}
