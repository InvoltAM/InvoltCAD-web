import { Plan } from '../model/Plan'
import { Wall } from '../model/Wall'
import { Vector2 } from '../geometry/Vector2'

interface DxfEntity {
  type: string
  layer?: string
  vertices?: Array<{ x: number; y: number }>
  start?: { x: number; y: number }
  end?: { x: number; y: number }
  center?: { x: number; y: number }
  radius?: number
  startAngle?: number
  endAngle?: number
}

interface DxfData {
  entities?: DxfEntity[]
  layers?: Record<string, { color?: number }>
}

/**
 * Импорт плана из DXF-файла.
 * Парсит стены (LWPOLYLINE, LINE, ARC) и создаёт модель Plan.
 */
export function importDxf(dxfText: string): Plan {
  const plan = new Plan()

  try {
    // Парсим DXF через dxf-parser
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const DxfParser = require('dxf-parser')
    const parser = new DxfParser()
    const data: DxfData = parser.parseSync(dxfText)

    if (!data.entities || data.entities.length === 0) {
      throw new Error('Нет entities в DXF')
    }

    // Собираем стены из LWPOLYLINE и LINE
    const wallEntities = data.entities.filter(
      (e) => e.type === 'LWPOLYLINE' || e.type === 'LINE'
    )

    for (const entity of wallEntities) {
      if (entity.type === 'LWPOLYLINE' && entity.vertices && entity.vertices.length >= 2) {
        for (let i = 0; i < entity.vertices.length - 1; i++) {
          const a = new Vector2(entity.vertices[i].x, entity.vertices[i].y)
          const b = new Vector2(entity.vertices[i + 1].x, entity.vertices[i + 1].y)
          plan.addWall(a, b, 200)
        }
      } else if (entity.type === 'LINE' && entity.start && entity.end) {
        const a = new Vector2(entity.start.x, entity.start.y)
        const b = new Vector2(entity.end.x, entity.end.y)
        plan.addWall(a, b, 200)
      }
    }

    // Собираем дуги (ARC) как дуговые стены
    const arcEntities = data.entities.filter((e) => e.type === 'ARC')
    for (const entity of arcEntities) {
      if (entity.center && entity.radius && entity.startAngle !== undefined && entity.endAngle !== undefined) {
        // Вычисляем начальную и конечную точки дуги
        const startAngle = (entity.startAngle * Math.PI) / 180
        const endAngle = (entity.endAngle * Math.PI) / 180
        const a = new Vector2(
          entity.center.x + entity.radius * Math.cos(startAngle),
          entity.center.y + entity.radius * Math.sin(startAngle)
        )
        const b = new Vector2(
          entity.center.x + entity.radius * Math.cos(endAngle),
          entity.center.y + entity.radius * Math.sin(endAngle)
        )
        const wall = plan.addWall(a, b, 200)
        // Устанавливаем дугу
        wall.arc = {
          center: new Vector2(entity.center.x, entity.center.y),
          radius: entity.radius,
          startAngle,
          endAngle,
          clockwise: true,
        }
      }
    }

    plan.invalidateRooms()
    return plan
  } catch (error) {
    console.error('Ошибка импорта DXF:', error)
    throw new Error(`Ошибка импорта DXF: ${error instanceof Error ? error.message : String(error)}`)
  }
}
