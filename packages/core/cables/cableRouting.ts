import { Vector2 } from '../geometry/Vector2'
import { NavGrid, NavigablePlan } from './navGrid'
import { findPath } from './astar'
import { Wall, wallPolyline } from '../model/Wall'
import { distPointToSegment } from '../geometry/Geometry'

const WALL_CLEARANCE = 100 // мм — минимальный зазор от стены
const SNAP_TOLERANCE = 75  // мм — допуск привязки к стене

/**
 * Автотрассировка кабеля между двумя точками с учётом стен и существующих кабелей.
 */
export function routeCable(
  plan: NavigablePlan,
  from: Vector2,
  to: Vector2,
  cellSize = 50
): Vector2[] | null {
  // Строим NavGrid из плана, расширив границы до начала/конца кабеля
  const grid = NavGrid.fromPlan(plan, cellSize, 200, [from, to])

  // Преобразуем мировые координаты в координаты сетки
  const start = grid.worldToGrid(from)
  const end = grid.worldToGrid(to)

  // Проверяем, что начальная и конечная точки внутри сетки и проходимы
  if (!grid.isValid(start.x, start.y) || !grid.isValid(end.x, end.y)) {
    return null
  }

  const startCell = grid.getCell(start.x, start.y)
  const endCell = grid.getCell(end.x, end.y)

  if (!startCell?.walkable || !endCell?.walkable) {
    // Если точка не проходима, ищем ближайшую проходимую ячейку
    const adjustedStart = findNearestWalkable(grid, start.x, start.y)
    const adjustedEnd = findNearestWalkable(grid, end.x, end.y)
    if (!adjustedStart || !adjustedEnd) return null

    const path = findPath(grid, adjustedStart.x, adjustedStart.y, adjustedEnd.x, adjustedEnd.y)
    if (!path) return null

    // Преобразуем путь обратно в мировые координаты
    return path.map((p) => grid.gridToWorld(p.x, p.y))
  }

  // Ищем путь A*
  const path = findPath(grid, start.x, start.y, end.x, end.y)
  if (!path) return null

  // Преобразуем путь обратно в мировые координаты
  const raw = path.map((p) => grid.gridToWorld(p.x, p.y))
  // Приводим маршрут к прямым углам, удаляем лишние вершины и прижимаем к стенам
  return postprocessRoute(raw, plan, cellSize)
}

/**
 * Автотрассировка кабеля с обязательными промежуточными узлами.
 * Строит путь между каждой парой соседних точек и склеивает результат.
 */
export function routeCableWithVia(
  plan: NavigablePlan,
  points: Vector2[],
  cellSize = 50
): Vector2[] | null {
  if (points.length < 2) return null

  const fullRoute: Vector2[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const segment = routeCable(plan, points[i], points[i + 1], cellSize)
    if (!segment) return null
    // Убираем дублирующуюся конечную точку предыдущего сегмента
    if (i > 0 && fullRoute.length > 0) {
      const last = fullRoute[fullRoute.length - 1]
      const first = segment[0]
      if (last.distanceTo(first) < 1e-3) {
        fullRoute.push(...segment.slice(1).map((p) => p.clone()))
        continue
      }
    }
    fullRoute.push(...segment.map((p) => p.clone()))
  }

  return fullRoute.length >= 2 ? fullRoute : null
}

/**
 * Упрощает маршрут, удаляя промежуточные точки, лежащие на одной прямой,
 * и применяет алгоритм Douglas-Peucker для сокращения числа вершин.
 * Сохраняет начальную и конечную точки, а также точки из `preservePoints`.
 */
export function simplifyRoute(
  route: Vector2[],
  tolerance = 1e-3,
  dpTolerance = 25,
  preservePoints: Vector2[] = [],
): Vector2[] {
  if (route.length <= 2) return route.map((p) => p.clone())

  // Определяем индексы исходного маршрута, которые нужно сохранить (промежуточные узлы).
  const protectedOriginal = new Set<number>([0, route.length - 1])
  for (const pp of preservePoints) {
    let bestIdx = -1
    let bestDist = Infinity
    for (let i = 0; i < route.length; i++) {
      const d = route[i].distanceTo(pp)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    if (bestIdx >= 0) protectedOriginal.add(bestIdx)
  }

  const collinear: Vector2[] = [route[0].clone()]
  for (let i = 1; i < route.length - 1; i++) {
    if (protectedOriginal.has(i)) {
      collinear.push(route[i].clone())
      continue
    }
    const a = collinear[collinear.length - 1]
    const b = route[i]
    const c = route[i + 1]
    const v1 = b.sub(a)
    const v2 = c.sub(b)
    // Если векторы коллинеарны (крестное произведение ≈ 0), точку b пропускаем
    const cross = Math.abs(v1.x * v2.y - v1.y * v2.x)
    if (cross > tolerance) {
      collinear.push(b.clone())
    }
  }
  collinear.push(route[route.length - 1].clone())

  // Переносим защиту на индексы упрощённого маршрута.
  const protectedSimplified = new Set<number>([0, collinear.length - 1])
  for (const idx of protectedOriginal) {
    let bestIdx = -1
    let bestDist = Infinity
    for (let i = 0; i < collinear.length; i++) {
      const d = collinear[i].distanceTo(route[idx])
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    if (bestIdx >= 0) {
      protectedSimplified.add(bestIdx)
    }
  }

  return douglasPeucker(collinear, dpTolerance, protectedSimplified)
}

/**
 * Алгоритм Douglas-Peucker: удаляет вершины, отклонение которых от прямой
 * между крайними точками не превышает заданный допуск (мм).
 * Индексы из `mustKeep` всегда сохраняются.
 */
function douglasPeucker(route: Vector2[], tolerance: number, mustKeep: Set<number>): Vector2[] {
  if (route.length <= 2) return route.map((p) => p.clone())

  const keep = new Set<number>([0, route.length - 1])
  for (const i of mustKeep) keep.add(i)

  function recurse(start: number, end: number): void {
    if (end <= start + 1) return

    // Если в диапазоне есть точки, которые нужно сохранить, разбиваем по ним.
    let mustIndex = -1
    for (let i = start + 1; i < end; i++) {
      if (keep.has(i)) {
        mustIndex = i
        break
      }
    }
    if (mustIndex !== -1) {
      recurse(start, mustIndex)
      recurse(mustIndex, end)
      return
    }

    const a = route[start]
    const b = route[end]
    const v = b.sub(a)
    const lenSq = v.dot(v)
    let maxDist = -1
    let index = -1
    for (let i = start + 1; i < end; i++) {
      const dist = lenSq === 0 ? route[i].distanceTo(a) : pointLineDistance(route[i], a, b)
      if (dist > maxDist) {
        maxDist = dist
        index = i
      }
    }
    if (maxDist > tolerance && index > start && index < end) {
      keep.add(index)
      recurse(start, index)
      recurse(index, end)
    }
  }

  recurse(0, route.length - 1)
  return Array.from(keep)
    .sort((a, b) => a - b)
    .map((i) => route[i].clone())
}

function pointLineDistance(p: Vector2, a: Vector2, b: Vector2): number {
  const v = b.sub(a)
  const lenSq = v.dot(v)
  if (lenSq === 0) return p.distanceTo(a)
  const t = Math.max(0, Math.min(1, p.sub(a).dot(v) / lenSq))
  const projection = a.add(v.scale(t))
  return p.distanceTo(projection)
}

/**
 * Постобработка A* маршрута:
 * - выравнивает отрезки под прямые углы,
 * - удаляет избыточные промежуточные вершины,
 * - прижимает маршрут к параллельным стенам, сохраняя зазор.
 */
export function postprocessRoute(
  route: Vector2[],
  plan: NavigablePlan,
  cellSize = 50
): Vector2[] {
  if (route.length < 2) return route.map((p) => p.clone())

  const tolerance = cellSize / 2
  let result = straightenRoute(route, tolerance)
  result = removeRedundantVertices(result, plan)
  result = snapRouteToWalls(result, plan, WALL_CLEARANCE, cellSize)
  result = removeRedundantVertices(result, plan)
  result = straightenRoute(result, tolerance)

  // Если постобработка удалила все точки — возвращаем исходный маршрут
  if (result.length < 2) return route.map((p) => p.clone())
  return result
}

/**
 * Выравнивает отрезки маршрута по горизонтали/вертикали.
 * Отрезок считается горизонтальным, если |dx| > |dy|, вертикальным, если |dy| > |dx|.
 * При равенстве (|dx| ≈ |dy|, включая 45°) выравниваем по горизонтали — так маршрут
 * остаётся из прямых углов и лучше ложится вдоль стен.
 */
function straightenRoute(route: Vector2[], tolerance: number): Vector2[] {
  if (route.length < 2) return route.map((p) => p.clone())
  const result: Vector2[] = [route[0].clone()]
  for (let i = 1; i < route.length; i++) {
    const prev = result[result.length - 1]
    const curr = route[i].clone()
    const dx = Math.abs(curr.x - prev.x)
    const dy = Math.abs(curr.y - prev.y)
    if (dx >= dy) {
      curr.y = prev.y
    } else {
      curr.x = prev.x
    }
    // Избегаем дублирования точек
    if (curr.distanceTo(prev) > 1e-3) {
      result.push(curr)
    }
  }
  return result
}

/**
 * Удаляет промежуточные вершины, если прямой отрезок между соседними точками
 * не нарушает зазор до стен.
 */
function removeRedundantVertices(route: Vector2[], plan: NavigablePlan): Vector2[] {
  if (route.length <= 2) return route.map((p) => p.clone())
  const result: Vector2[] = [route[0].clone()]
  let i = 1
  while (i < route.length - 1) {
    const a = result[result.length - 1]
    const c = route[i + 1]
    if (segmentRouteClearance(a, c, plan) >= WALL_CLEARANCE) {
      // Точка i лишняя
      i++
    } else {
      result.push(route[i].clone())
      i++
    }
  }
  result.push(route[route.length - 1].clone())
  return result
}

/**
 * Прижимает горизонтальные отрезки к ближайшим горизонтальным стенам,
 * а вертикальные — к вертикальным, сохраняя WALL_CLEARANCE.
 */
function snapRouteToWalls(
  route: Vector2[],
  plan: NavigablePlan,
  clearance: number,
  tolerance: number
): Vector2[] {
  if (route.length < 2) return route.map((p) => p.clone())

  const snapped = route.map((p) => p.clone())
  for (let i = 0; i < snapped.length - 1; i++) {
    const a = snapped[i]
    const b = snapped[i + 1]
    const dx = Math.abs(b.x - a.x)
    const dy = Math.abs(b.y - a.y)

    if (dx > dy) {
      // Горизонтальный отрезок
      const y = snapToWallY((a.y + b.y) / 2, plan, clearance, tolerance)
      if (y !== null) {
        a.y = y
        b.y = y
      }
    } else if (dy > dx) {
      // Вертикальный отрезок
      const x = snapToWallX((a.x + b.x) / 2, plan, clearance, tolerance)
      if (x !== null) {
        a.x = x
        b.x = x
      }
    }
  }

  // Удаляем дублирующиеся точки
  const result: Vector2[] = [snapped[0]]
  for (let i = 1; i < snapped.length; i++) {
    if (snapped[i].distanceTo(result[result.length - 1]) > 1e-3) {
      result.push(snapped[i])
    }
  }
  return result
}

function snapToWallY(
  y: number,
  plan: NavigablePlan,
  clearance: number,
  tolerance: number
): number | null {
  let best: { y: number; dist: number } | null = null
  for (const wall of plan.walls) {
    for (let i = 0; i < wallPolyline(wall).length - 1; i++) {
      const wa = wallPolyline(wall)[i]
      const wb = wallPolyline(wall)[i + 1]
      if (Math.abs(wa.y - wb.y) > 1) continue // не горизонтальная
      const wallY = wa.y
      const dist = Math.abs(y - wallY)
      if (dist > tolerance) continue
      const side = Math.sign(y - wallY)
      const snappedY = wallY + side * clearance
      const finalDist = Math.abs(y - snappedY)
      if (!best || finalDist < best.dist) {
        best = { y: snappedY, dist: finalDist }
      }
    }
  }
  return best ? best.y : null
}

function snapToWallX(
  x: number,
  plan: NavigablePlan,
  clearance: number,
  tolerance: number
): number | null {
  let best: { x: number; dist: number } | null = null
  for (const wall of plan.walls) {
    for (let i = 0; i < wallPolyline(wall).length - 1; i++) {
      const wa = wallPolyline(wall)[i]
      const wb = wallPolyline(wall)[i + 1]
      if (Math.abs(wa.x - wb.x) > 1) continue // не вертикальная
      const wallX = wa.x
      const dist = Math.abs(x - wallX)
      if (dist > tolerance) continue
      const side = Math.sign(x - wallX)
      const snappedX = wallX + side * clearance
      const finalDist = Math.abs(x - snappedX)
      if (!best || finalDist < best.dist) {
        best = { x: snappedX, dist: finalDist }
      }
    }
  }
  return best ? best.x : null
}

/**
 * Минимальный зазор от маршрута до любой стены.
 */
function segmentRouteClearance(a: Vector2, b: Vector2, plan: NavigablePlan): number {
  let minClearance = Infinity
  for (const wall of plan.walls) {
    minClearance = Math.min(minClearance, segmentClearanceToWall(a, b, wall))
  }
  return minClearance
}

function segmentClearanceToWall(a: Vector2, b: Vector2, wall: Wall): number {
  const poly = wallPolyline(wall)
  let minDist = Infinity
  for (let i = 0; i < poly.length - 1; i++) {
    const wa = poly[i]
    const wb = poly[i + 1]
    minDist = Math.min(minDist, segmentToSegmentDistance(a, b, wa, wb))
  }
  return minDist - wall.thickness / 2
}

function segmentToSegmentDistance(a1: Vector2, a2: Vector2, b1: Vector2, b2: Vector2): number {
  if (segmentsIntersect(a1, a2, b1, b2)) return 0
  return Math.min(
    distPointToSegment(a1, b1, b2),
    distPointToSegment(a2, b1, b2),
    distPointToSegment(b1, a1, a2),
    distPointToSegment(b2, a1, a2),
  )
}

/** Пересечение двух отрезков. */
function segmentsIntersect(a1: Vector2, a2: Vector2, b1: Vector2, b2: Vector2): boolean {
  function ccw(A: Vector2, B: Vector2, C: Vector2): boolean {
    return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x)
  }
  return ccw(a1, b1, b2) !== ccw(a2, b1, b2) && ccw(a1, a2, b1) !== ccw(a1, a2, b2)
}

/**
 * Находит ближайшую проходимую ячейку к заданной.
 */
function findNearestWalkable(
  grid: NavGrid,
  x: number,
  y: number,
  maxRadius = 10
): { x: number; y: number } | null {
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
        const nx = x + dx
        const ny = y + dy
        const cell = grid.getCell(nx, ny)
        if (cell?.walkable) {
          return { x: nx, y: ny }
        }
      }
    }
  }
  return null
}
