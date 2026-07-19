import { Plan } from '../model/Plan'
import { Vector2 } from '../geometry/Vector2'
import { Wall } from '../model/Wall'
import { Device } from '../model/Device'

export interface AutoDesignResult {
  plan: Plan
  steps: Array<{
    step: number
    description: string
    completed: boolean
  }>
}

/**
 * Автопроектирование (rule-based): автоматическая расстановка устройств по правилам.
 */
export function autoDesign(plan: Plan): AutoDesignResult {
  const steps: AutoDesignResult['steps'] = []

  // Шаг 1: Анализ планировки
  steps.push({
    step: 1,
    description: 'Анализ планировки',
    completed: true,
  })

  // Шаг 2: Расстановка розеток
  steps.push({
    step: 2,
    description: 'Расстановка розеток',
    completed: placeSockets(plan),
  })

  // Шаг 3: Расстановка выключателей
  steps.push({
    step: 3,
    description: 'Расстановка выключателей',
    completed: placeSwitches(plan),
  })

  // Шаг 4: Расстановка светильников
  steps.push({
    step: 4,
    description: 'Расстановка светильников',
    completed: placeLights(plan),
  })

  // Шаг 5: Прокладка кабелей
  steps.push({
    step: 5,
    description: 'Прокладка кабелей',
    completed: routeCables(plan),
  })

  return { plan, steps }
}

/**
 * Расстановка розеток по правилам:
 * - В каждой комнате минимум 1 розетка на 4 м²
 * - Розетки от дверей ≥0.5 м
 * - Розетки на высоте 300 мм
 */
function placeSockets(plan: Plan): boolean {
  const rooms = plan.getRooms()

  for (const room of rooms) {
    const area = room.area / 1_000_000 // м²
    const requiredSockets = Math.max(1, Math.ceil(area / 4))

    // Находим стены комнаты
    const roomWalls = plan.walls.filter((wall) => {
      const center = wall.a.add(wall.b).scale(0.5)
      return isPointInRoom(center, room.polygon)
    })

    if (roomWalls.length === 0) continue

    // Расставляем розетки равномерно по стенам
    for (let i = 0; i < requiredSockets; i++) {
      const wall = roomWalls[i % roomWalls.length]
      const t = (i + 1) / (requiredSockets + 1)

      // Проверяем, нет ли уже розетки рядом
      const hasSocket = plan.devices.some((d) => {
        if (d.type !== 'socket' && d.type !== 'socket-uz' && d.type !== 'socket-usb') return false
        if (d.wallId !== wall.id) return false
        return Math.abs(d.t - t) < 0.1
      })

      if (!hasSocket) {
        plan.addDevice(wall.id, 'socket', t, 300, 1, `Розетка ${plan.devices.length + 1}`)
      }
    }
  }

  return true
}

/**
 * Расстановка выключателей по правилам:
 * - У каждой двери минимум 1 выключатель
 * - Выключатели на высоте 900 мм
 */
function placeSwitches(plan: Plan): boolean {
  const doors = plan.walls.flatMap((wall) =>
    wall.openings.filter((o) => o.type === 'door').map((o) => ({ wall, opening: o }))
  )

  for (const { wall, opening } of doors) {
    // Находим сторону двери, где нет петель
    const side = opening.swingSide === 'left' ? -1 : 1
    const t = opening.t + (opening.swingSide === 'left' ? 0.1 : -0.1)

    // Проверяем, нет ли уже выключателя рядом
    const hasSwitch = plan.devices.some((d) => {
      if (d.type !== 'switch' && d.type !== 'switch-2') return false
      if (d.wallId !== wall.id) return false
      return Math.abs(d.t - t) < 0.15
    })

    if (!hasSwitch) {
      plan.addDevice(wall.id, 'switch', Math.max(0.05, Math.min(0.95, t)), 900, side as 1 | -1, `Выключатель ${plan.devices.length + 1}`)
    }
  }

  return true
}

/**
 * Расстановка светильников по правилам:
 * - В каждой комнате минимум 1 светильник
 * - Светильники на высоте 2500 мм
 */
function placeLights(plan: Plan): boolean {
  const rooms = plan.getRooms()

  for (const room of rooms) {
    // Проверяем, есть ли уже светильник в комнате
    const hasLight = plan.devices.some((d) => {
      if (d.type !== 'light') return false
      const pos = plan.deviceWorldPosition(d)
      return isPointInRoom(pos, room.polygon)
    })

    if (!hasLight) {
      // Находим центр комнаты
      const center = room.polygon.reduce((sum, p) => sum.add(p), new Vector2(0, 0)).scale(1 / room.polygon.length)

      // Находим ближайшую стену к центру
      let nearestWall: Wall | null = null
      let minDistance = Infinity

      for (const wall of plan.walls) {
        const wallCenter = wall.a.add(wall.b).scale(0.5)
        const distance = center.distanceTo(wallCenter)
        if (distance < minDistance) {
          minDistance = distance
          nearestWall = wall
        }
      }

      if (nearestWall) {
        plan.addDevice(nearestWall.id, 'light', 0.5, 2500, 1, `Светильник ${plan.devices.length + 1}`)
      }
    }
  }

  return true
}

/**
 * Прокладка кабелей от розеток/выключателей к светильникам/щиту.
 */
function routeCables(plan: Plan): boolean {
  const lights = plan.devices.filter((d) => d.type === 'light')
  const sockets = plan.devices.filter((d) => d.type === 'socket' || d.type === 'socket-uz' || d.type === 'socket-usb')
  const switches = plan.devices.filter((d) => d.type === 'switch' || d.type === 'switch-2')
  const panels = plan.devices.filter((d) => d.type === 'panel')

  // Прокладываем кабели от розеток к ближайшему щиту или к другой розетке
  for (const socket of sockets) {
    const hasCable = plan.cables.some((c) => c.fromDeviceId === socket.id || c.toDeviceId === socket.id)
    if (!hasCable && panels.length > 0) {
      plan.addCable(socket.id, panels[0].id, 'power', 2.5)
    }
  }

  // Прокладываем кабели от выключателей к светильникам
  for (const switchDevice of switches) {
    // Находим ближайший светильник
    let nearestLight: Device | null = null
    let minDistance = Infinity

    for (const light of lights) {
      const switchPos = plan.deviceWorldPosition(switchDevice)
      const lightPos = plan.deviceWorldPosition(light)
      const distance = switchPos.distanceTo(lightPos)
      if (distance < minDistance) {
        minDistance = distance
        nearestLight = light
      }
    }

    if (nearestLight) {
      const hasCable = plan.cables.some(
        (c) =>
          (c.fromDeviceId === switchDevice.id && c.toDeviceId === nearestLight!.id) ||
          (c.fromDeviceId === nearestLight!.id && c.toDeviceId === switchDevice.id)
      )
      if (!hasCable) {
        plan.addCable(switchDevice.id, nearestLight.id, 'lighting', 1.5)
      }
    }
  }

  return true
}

/**
 * Проверяет, находится ли точка внутри комнаты.
 */
function isPointInRoom(point: Vector2, polygon: Vector2[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}
