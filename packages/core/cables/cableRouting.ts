import { Vector2 } from '../geometry/Vector2'
import { NavGrid, NavigablePlan } from './navGrid'
import { findPath } from './astar'

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
  return path.map((p) => grid.gridToWorld(p.x, p.y))
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
