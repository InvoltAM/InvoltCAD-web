import { Plan } from '@core/model/Plan'
import { Vector2 } from '@core/geometry/Vector2'
import { DeviceType } from '@core/model/Device'
import { CableType } from '@core/model/Cable'

export interface AiPlanSnapshot {
  rooms: Array<{
    index: number
    number: number
    name: string
    areaM2: number
    centroid: { x: number; y: number }
    polygon: Array<{ x: number; y: number }>
  }>
  walls: Array<{
    id: string
    start: { x: number; y: number }
    end: { x: number; y: number }
    thickness: number
  }>
  openings: Array<{
    id: string
    wallId: string
    type: string
    t: number
    width: number
  }>
  devices: Array<{
    id: string
    type: DeviceType
    name?: string
    wallId?: string
    t?: number
    side?: number
    offset?: number
    x?: number
    y?: number
    height?: number
  }>
  cables: Array<{
    id: string
    type: CableType
    crossSection: number
    fromDeviceId?: string
    toDeviceId?: string
  }>
  electrical: {
    consumersCount: number
    circuitsCount: number
    distributionBoardsCount: number
  }
}

export function serializePlanForAi(plan: Plan): AiPlanSnapshot {
  const rooms = plan.getRooms().map((room, index) => {
    const centroid = room.polygon.reduce((sum, p) => sum.add(p), new Vector2(0, 0)).scale(1 / Math.max(1, room.polygon.length))
    return {
      index,
      number: plan.roomData[index]?.number ?? index + 1,
      name: plan.roomData[index]?.name ?? '',
      areaM2: (room.area ?? 0) / 1_000_000,
      centroid: { x: centroid.x, y: centroid.y },
      polygon: room.polygon.map((p) => ({ x: p.x, y: p.y })),
    }
  })

  const walls = plan.walls.map((wall) => ({
    id: wall.id,
    start: { x: wall.a.x, y: wall.a.y },
    end: { x: wall.b.x, y: wall.b.y },
    thickness: wall.thickness,
  }))

  const openings = plan.walls.flatMap((wall) =>
    wall.openings.map((opening) => ({
      id: opening.id,
      wallId: wall.id,
      type: opening.type,
      t: opening.t,
      width: opening.width,
    }))
  )

  const devices = plan.devices.map((device) => {
    const base = {
      id: device.id,
      type: device.type,
      name: device.name,
      height: device.height ?? undefined,
    }
    if (device.wallId) {
      return {
        ...base,
        wallId: device.wallId,
        t: device.t,
        side: device.side,
        offset: device.offset,
      }
    }
    return {
      ...base,
      x: device.position?.x,
      y: device.position?.y,
    }
  })

  const cables = plan.cables.map((cable) => ({
    id: cable.id,
    type: cable.type,
    crossSection: cable.crossSection,
    fromDeviceId: cable.fromDeviceId ?? undefined,
    toDeviceId: cable.toDeviceId ?? undefined,
  }))

  return {
    rooms,
    walls,
    openings,
    devices,
    cables,
    electrical: {
      consumersCount: plan.electrical.consumers.length,
      circuitsCount: plan.electrical.circuits.length,
      distributionBoardsCount: plan.electrical.distributionBoards.length,
    },
  }
}
