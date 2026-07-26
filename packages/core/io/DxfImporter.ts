import { Plan } from '../model/Plan'
import { Wall } from '../model/Wall'
import { Vector2 } from '../geometry/Vector2'
import DxfParser from 'dxf-parser'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  shape?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DxfData {
  header?: Record<string, number | string | { x: number; y: number; z?: number }>
  entities?: DxfEntity[]
  layers?: Record<string, { color?: number }>
}

/** Множители пересчёта $INSUNITS в миллиметры. */
const INSUNITS_TO_MM: Record<number, number> = {
  0: 1,      // без единиц — считаем мм
  1: 25.4,   // дюймы
  2: 304.8,  // футы
  4: 1,      // миллиметры
  5: 10,     // сантиметры
  6: 1000,   // метры
}

function readScale(data: DxfData): number {
  const value = data.header?.['$INSUNITS']
  if (typeof value === 'number') {
    return INSUNITS_TO_MM[value] ?? 1
  }
  if (typeof value === 'string') {
    const n = parseInt(value, 10)
    return Number.isNaN(n) ? 1 : (INSUNITS_TO_MM[n] ?? 1)
  }
  return 1
}

/**
 * DXF использует систему координат Y-up, а холст редактора — Y-down.
 * Поэтому инвертируем Y и приводим к миллиметрам по $INSUNITS.
 */
function toCanvas(x: number, y: number, scale: number): Vector2 {
  return new Vector2(x * scale, -y * scale)
}

/**
 * Импорт плана из DXF-файла.
 * Парсит стены (LWPOLYLINE, POLYLINE, LINE, ARC) и создаёт модель Plan.
 */
export function importDxf(dxfText: string): Plan {
  const plan = new Plan()

  try {
    const parser = new DxfParser()
    const data: DxfData = parser.parseSync(dxfText) ?? {}
    const scale = readScale(data)

    if (!data.entities || data.entities.length === 0) {
      throw new Error('Нет entities в DXF')
    }

    // Собираем стены из LINE, LWPOLYLINE и POLYLINE
    const wallEntities = data.entities.filter(
      (e) => e.type === 'LWPOLYLINE' || e.type === 'POLYLINE' || e.type === 'LINE'
    )

    for (const entity of wallEntities) {
      if ((entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') && entity.vertices && entity.vertices.length >= 2) {
        const n = entity.vertices.length
        for (let i = 0; i < n - 1; i++) {
          const a = toCanvas(entity.vertices[i].x, entity.vertices[i].y, scale)
          const b = toCanvas(entity.vertices[i + 1].x, entity.vertices[i + 1].y, scale)
          plan.addWall(a, b, 200)
        }
        if (entity.shape && n > 2) {
          const a = toCanvas(entity.vertices[n - 1].x, entity.vertices[n - 1].y, scale)
          const b = toCanvas(entity.vertices[0].x, entity.vertices[0].y, scale)
          plan.addWall(a, b, 200)
        }
      } else if (entity.type === 'LINE' && entity.start && entity.end) {
        const a = toCanvas(entity.start.x, entity.start.y, scale)
        const b = toCanvas(entity.end.x, entity.end.y, scale)
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
        const a = toCanvas(
          entity.center.x + entity.radius * Math.cos(startAngle),
          entity.center.y + entity.radius * Math.sin(startAngle),
          scale
        )
        const b = toCanvas(
          entity.center.x + entity.radius * Math.cos(endAngle),
          entity.center.y + entity.radius * Math.sin(endAngle),
          scale
        )
        const wall = plan.addWall(a, b, 200)
        // Устанавливаем дугу (угол сохраняем в мировой системе DXF,
        // но центр переводим в canvas-координаты)
        wall.arc = {
          center: toCanvas(entity.center.x, entity.center.y, scale),
          radius: entity.radius * scale,
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

/**
 * Устаревший алиас для совместимости со старым API.
 * Возвращает набор сегментов, извлечённых из DXF.
 */
export function parseDxf(dxfText: string): Array<{ a: Vector2; b: Vector2 }> {
  const plan = importDxf(dxfText)
  return plan.walls.map((w) => ({ a: w.a.clone(), b: w.b.clone() }))
}
