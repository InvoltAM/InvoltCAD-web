import { Vector2 } from '../geometry/Vector2'
import { NavGrid, NavigablePlan } from './navGrid'
import { findPath } from './astar'
import { Wall, wallHasArc, wallLength, wallDirection, wallPolyline } from '../model/Wall'
import { Opening } from '../model/Opening'
import { distPointToSegment, segmentsIntersection } from '../geometry/Geometry'

export const WALL_CLEARANCE = 400 // мм — минимальный зазор от ПОВЕРХНОСТИ стены
export const CONNECTOR_CLEARANCE = 100 // мм — зазор от поверхности стены для первых/последних 2 сегментов (connector offset)
export const DOORWAY_MARGIN = 100 // мм — отступ от краёв дверного проёма
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
  // Строим NavGrid из плана с запасом для обхода стен с зазором 400 мм
  const grid = NavGrid.fromPlan(plan, cellSize, 800, [from, to])

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

    // Преобразуем путь обратно в мировые координаты и упрощаем
    const raw = path.map((p) => grid.gridToWorld(p.x, p.y))
    return postprocessRoute(raw, plan, cellSize)
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
 * - удаляет избыточные промежуточные вершины с помощью динамического
 *   программирования (только горизонтальные/вертикальные сегменты),
 * - прокладывает пересечения со стенами только через проёмы,
 * - привязывает точки пересечения к центральной линии проёма.
 */
export function postprocessRoute(
  route: Vector2[],
  plan: NavigablePlan,
  cellSize = 50
): Vector2[] {
  if (route.length < 2) return route.map((p) => p.clone())

  const tolerance = cellSize / 2
  let result = straightenRoute(route, tolerance)
  result = deduplicateRoute(result)
  result = insertOpeningWaypoints(result, plan)
  result = orthogonalDPSimplify(result, plan)
  // result = snapCrossingsToOpenings(result, plan)
  result = mergeCollinearSegments(result, plan)
  result = removeRedundantVertices(result, plan)
  result = straightenRoute(result, tolerance)
  result = mergeCollinearSegments(result, plan)
  result = removeRedundantVertices(result, plan)
  result = deduplicateRoute(result)

  // Если постобработка удалила все точки — возвращаем исходный маршрут
  if (result.length < 2) return route.map((p) => p.clone())
  return result
}

/**
 * Объединяет идущие подряд коллинеарные сегменты в один,
 * если прямой отрезок между их концами допустим (не пересекает стены
 * вне проёмов и сохраняет зазор).
 */
function mergeCollinearSegments(route: Vector2[], plan: NavigablePlan): Vector2[] {
  if (route.length < 3) return route.map((p) => p.clone())
  const result: Vector2[] = [route[0].clone()]
  let i = 1
  while (i < route.length - 1) {
    const prev = result[result.length - 1]
    const curr = route[i]
    const next = route[i + 1]
    const sameY = Math.abs(prev.y - curr.y) < 1 && Math.abs(curr.y - next.y) < 1
    const sameX = Math.abs(prev.x - curr.x) < 1 && Math.abs(curr.x - next.x) < 1
    if ((sameY || sameX) && straightSegmentIsAllowed(prev, next, plan)) {
      // curr лишняя, объединяем prev->curr->next в prev->next
      i++
      continue
    }
    result.push(curr.clone())
    i++
  }
  result.push(route[route.length - 1].clone())
  return result
}

/**
 * Выравнивает отрезки маршрута по горизонтали/вертикали.
 * Отрезок считается горизонтальным, если |dx| > |dy|, вертикальным, если |dy| > |dx|.
 * При равенстве (|dx| ≈ |dy|, включая 45°) выравниваем по горизонтали — так маршрут
 * остаётся из прямых углов и лучше ложится вдоль стен.
 */
export function straightenRoute(route: Vector2[], tolerance: number): Vector2[] {
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
 * не нарушает зазор до стен и не пересекает их вне проёмов.
 */
function removeRedundantVertices(route: Vector2[], plan: NavigablePlan): Vector2[] {
  if (route.length <= 2) return route.map((p) => p.clone())
  const result: Vector2[] = [route[0].clone()]
  let i = 1
  while (i < route.length - 1) {
    const a = result[result.length - 1]
    const c = route[i + 1]
    if (straightSegmentIsAllowed(a, c, plan)) {
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
 * Динамическое программирование для поиска маршрута с минимальным числом
 * вершин, состоящего только из горизонтальных и вертикальных сегментов.
 * Между двумя сохранёнными вершинами допускается либо прямой отрезок,
 * либо L-образный излом (один промежуточный угол).
 */
function orthogonalDPSimplify(route: Vector2[], plan: NavigablePlan): Vector2[] {
  const n = route.length
  if (n < 2) return route.map((p) => p.clone())

  const dp = new Array(n).fill(Infinity)
  const parent = new Array(n).fill(-1)
  const corner: (Vector2 | null)[] = new Array(n).fill(null)
  const pathLength = new Array(n).fill(Infinity)

  dp[0] = 1
  pathLength[0] = 0

  for (let i = 0; i < n; i++) {
    if (dp[i] === Infinity) continue

    for (let j = i + 1; j < n; j++) {
      const a = route[i]
      const b = route[j]

      let bestCorner: Vector2 | null = null
      let feasible = false
      let segLen = 0

      const axisAligned = Math.abs(a.x - b.x) < 1e-3 || Math.abs(a.y - b.y) < 1e-3
      if (axisAligned && segmentIsAllowed(a, b, plan)) {
        feasible = true
        segLen = a.distanceTo(b)
      } else {
        const candidates = [new Vector2(a.x, b.y), new Vector2(b.x, a.y)]
        for (const c of candidates) {
          if (segmentIsAllowed(a, c, plan) && segmentIsAllowed(c, b, plan)) {
            bestCorner = c
            feasible = true
            segLen = a.distanceTo(c) + c.distanceTo(b)
            break
          }
        }
      }

      if (!feasible) continue

      const added = bestCorner ? 2 : 1
      const totalLen = pathLength[i] + segLen
      if (dp[i] + added < dp[j] || (dp[i] + added === dp[j] && totalLen < pathLength[j])) {
        dp[j] = dp[i] + added
        parent[j] = i
        corner[j] = bestCorner
        pathLength[j] = totalLen
      }
    }
  }

  if (dp[n - 1] === Infinity) {
    // Если DP не нашло допустимого упрощения, возвращаем исходный маршрут
    return route.map((p) => p.clone())
  }

  // Восстановление маршрута
  const result: Vector2[] = []
  let idx = n - 1
  while (idx !== -1) {
    result.push(route[idx].clone())
    const c = corner[idx]
    if (c) result.push(c.clone())
    idx = parent[idx]
  }
  result.reverse()
  return deduplicateRoute(result)
}

/**
 * Добавляет в маршрут вспомогательные точки — центры проёмов.
 * Это помогает DP строить короткие маршруты через дверные/оконные проёмы,
 * даже если A* не прошёл точно через центр проёма.
 */
function insertOpeningWaypoints(route: Vector2[], plan: NavigablePlan): Vector2[] {
  if (route.length < 2) return route.map((p) => p.clone())

  const start = route[0]
  const end = route[route.length - 1]
  const dir = end.sub(start)
  const lenSq = dir.dot(dir)

  const existing = route.map((p) => ({
    p,
    t: lenSq > 0 ? p.sub(start).dot(dir) / lenSq : 0,
  }))

  const extras: { p: Vector2; t: number }[] = []
  for (const wall of plan.walls) {
    if (wallHasArc(wall)) continue
    const wallDir = wall.b.sub(wall.a)
    if (wallDir.length() < 1e-9) continue

    for (const opening of wall.openings) {
      // Проходить разрешаем только через дверные проёмы, окна — как стена.
      if (opening.type !== 'door') continue
      const center = openingCenterOnWall(wall, opening)
      const t = paramAlongRoute(center, start, end)
      // Не добавляем точки за пределами маршрута — они нарушат порядок
      if (t > 1e-6 && t < 1 - 1e-6) {
        extras.push({ p: center, t })
      }
    }
  }

  extras.sort((a, b) => a.t - b.t)

  const result: Vector2[] = []
  let i = 0
  const eps = 1e-6
  for (const extra of extras) {
    while (i < route.length && existing[i].t < extra.t - eps) {
      result.push(route[i].clone())
      i++
    }
    if (result.length === 0 || result[result.length - 1].distanceTo(extra.p) > eps) {
      result.push(extra.p.clone())
    }
  }
  while (i < route.length) {
    result.push(route[i].clone())
    i++
  }

  return result
}

function paramAlongRoute(p: Vector2, start: Vector2, end: Vector2): number {
  const dir = end.sub(start)
  const lenSq = dir.dot(dir)
  return lenSq > 0 ? p.sub(start).dot(dir) / lenSq : 0
}

/**
 * Центр проёма на осевой линии стены.
 */
function openingCenterOnWall(wall: Wall, opening: Opening): Vector2 {
  const len = wallLength(wall)
  if (len < 1e-9) return wall.a.clone()
  const dir = wall.b.sub(wall.a).scale(1 / len)
  return wall.a.add(dir.scale(opening.t * len))
}

/**
 * Если отрезок [a,b] пересекает стену через проём, возвращает информацию
 * о пересечении и точке, привязанной к центральной линии проёма.
 */
function findWallOpeningCrossing(
  a: Vector2,
  b: Vector2,
  wall: Wall,
): { opening: Opening; crossing: Vector2; snapped: Vector2 } | null {
  const poly = wallPolyline(wall)
  const wallLen = wallLength(wall)

  for (let i = 0; i < poly.length - 1; i++) {
    const wa = poly[i]
    const wb = poly[i + 1]
    const p = segmentsIntersection(a, b, wa, wb)
    if (!p) continue

    const v = wb.sub(wa)
    const lenSq = v.dot(v)
    if (lenSq < 1e-9) continue

    const t = Math.max(0, Math.min(1, p.sub(wa).dot(v) / lenSq))
    const along = t * Math.sqrt(lenSq)

    for (const opening of wall.openings) {
      // Только дверные проёмы считаются проходимыми.
      if (opening.type !== 'door') continue
      const centerDist = opening.t * wallLen
      const half = Math.max(0, opening.width / 2 - DOORWAY_MARGIN)
      if (along >= centerDist - half - 1e-3 && along <= centerDist + half + 1e-3) {
        const snapped = snapCrossingToOpening(a, b, wall, opening)
        return { opening, crossing: p, snapped }
      }
    }
  }

  return null
}

/**
 * Возвращает true, если отрезок [a,b] пересекает хотя бы одну стену
 * вне дверного/оконного проёма.
 */
export function segmentCrossesWallOutsideOpening(
  a: Vector2,
  b: Vector2,
  plan: NavigablePlan,
): boolean {
  for (const wall of plan.walls) {
    const crossing = findWallOpeningCrossing(a, b, wall)
    if (crossing) continue
    if (segmentIntersectsWall(a, b, wall)) return true
  }
  return false
}

/**
 * Привязывает точку пересечения со стеной к центральной линии проёма.
 */
export function snapCrossingToOpening(
  a: Vector2,
  b: Vector2,
  wall: Wall,
  opening: Opening,
): Vector2 {
  // Центр проёма на оси стены — целевая точка пересечения
  return openingCenterOnWall(wall, opening)
}

/**
 * Проверяет, что отрезок [a,b] или L-образная ломаная между ними
 * может быть частью упрощённого маршрута.
 */
function segmentIsAllowed(a: Vector2, b: Vector2, plan: NavigablePlan): boolean {
  if (a.distanceTo(b) < 1e-3) return false

  const axisAligned = Math.abs(a.x - b.x) < 1e-3 || Math.abs(a.y - b.y) < 1e-3
  if (axisAligned) {
    return straightSegmentIsAllowed(a, b, plan)
  }

  // Пробуем два варианта L-образного пути
  const c1 = new Vector2(a.x, b.y)
  if (straightSegmentIsAllowed(a, c1, plan) && straightSegmentIsAllowed(c1, b, plan)) {
    return true
  }
  const c2 = new Vector2(b.x, a.y)
  return straightSegmentIsAllowed(a, c2, plan) && straightSegmentIsAllowed(c2, b, plan)
}

/**
 * Проверяет, что прямой горизонтальный/вертикальный отрезок [a,b]
 * не пересекает стены вне проёмов и сохраняет зазор от ПОВЕРХНОСТИ стены.
 * Для connector-сегментов (первые/последние устройства) допускается меньший зазор.
 */
export function straightSegmentIsAllowed(
  a: Vector2,
  b: Vector2,
  plan: NavigablePlan,
  requiredClearance = WALL_CLEARANCE,
): boolean {
  if (a.distanceTo(b) < 1e-3) return false

  // Упрощённый маршрут состоит только из горизонтальных/вертикальных отрезков
  if (Math.abs(a.x - b.x) >= 1e-3 && Math.abs(a.y - b.y) >= 1e-3) return false

  for (const wall of plan.walls) {
    const crossing = findWallOpeningCrossing(a, b, wall)
    if (crossing) {
      // Пересечение только через проём — допустимо
      continue
    }

    if (segmentIntersectsWall(a, b, wall)) return false

    // Если оба конца отрезка лежат внутри дверного коридора,
    // применяем пониженный зазор (коридор уже прорезан в запретной зоне).
    if (segmentInDoorwayCorridor(a, b, wall)) {
      if (segmentClearanceToWall(a, b, wall) < wall.thickness / 2 - 1e-6) return false
      continue
    }

    // Зазор от осевой линии минус половина толщины = зазор от поверхности
    const clearance = segmentClearanceToWall(a, b, wall) - wall.thickness / 2
    if (clearance < requiredClearance - 1e-6) return false
  }

  return true
}

/**
 * Проверяет, что оба конца отрезка лежат внутри коридора хотя бы одного
 * дверного проёма. Коридор прорезает запретную зону 400 мм и имеет
 * ширину doorway - 2×DOORWAY_MARGIN вдоль стены.
 */
function segmentInDoorwayCorridor(a: Vector2, b: Vector2, wall: Wall): boolean {
  const wallLen = wallLength(wall)
  if (wallLen < 1e-9) return false
  const dir = wallDirection(wall)
  const n = dir.perpendicular()

  for (const opening of wall.openings) {
    if (opening.type !== 'door') continue
    const center = wall.a.add(dir.scale(opening.t * wallLen))
    const halfAlong = Math.max(0, opening.width / 2 - DOORWAY_MARGIN)
    const halfAcross = wall.thickness / 2 + WALL_CLEARANCE

    const localA = new Vector2(a.sub(center).dot(dir), a.sub(center).dot(n))
    const localB = new Vector2(b.sub(center).dot(dir), b.sub(center).dot(n))

    const inA = Math.abs(localA.x) <= halfAlong + 1e-3 && Math.abs(localA.y) <= halfAcross + 1e-3
    const inB = Math.abs(localB.x) <= halfAlong + 1e-3 && Math.abs(localB.y) <= halfAcross + 1e-3
    if (inA && inB) return true
  }

  return false
}

function segmentIntersectsWall(a: Vector2, b: Vector2, wall: Wall): boolean {
  const poly = wallPolyline(wall)
  for (let i = 0; i < poly.length - 1; i++) {
    if (segmentsIntersect(a, b, poly[i], poly[i + 1])) return true
  }
  return false
}

/**
 * Минимальный зазор от отрезка [a,b] до осевой линии стены.
 * Зазор измеряется от осевой линии (как и сетка проходимости A*).
 */
function segmentClearanceToWall(a: Vector2, b: Vector2, wall: Wall): number {
  const poly = wallPolyline(wall)
  let minDist = Infinity
  for (let i = 0; i < poly.length - 1; i++) {
    const wa = poly[i]
    const wb = poly[i + 1]
    minDist = Math.min(minDist, segmentToSegmentDistance(a, b, wa, wb))
  }
  return minDist
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
 * Снимает внутренние точки пересечения со стенами через проёмы
 * к центральной линии проёма, сдвигая весь пересекающий сегмент.
 * Сегменты, примыкающие к началу/концу маршрута, не сдвигаем,
 * чтобы не отрывать кабель от точек подключения.
 */
function snapCrossingsToOpenings(route: Vector2[], plan: NavigablePlan): Vector2[] {
  if (route.length < 2) return route.map((p) => p.clone())

  const list = route.map((p) => p.clone())
  const eps = 1e-3

  for (let i = 0; i < list.length - 1; i++) {
    // Не сдвигаем сегменты, которые начинаются/заканчиваются в точках подключения
    if (i === 0 || i + 1 === list.length - 1) continue

    const a = list[i]
    const b = list[i + 1]

    let snapped: Vector2 | null = null
    for (const wall of plan.walls) {
      const crossing = findWallOpeningCrossing(a, b, wall)
      if (crossing) {
        snapped = crossing.snapped
        break
      }
    }
    if (!snapped) continue

    if (Math.abs(a.y - b.y) < eps) {
      // Горизонтальный отрезок пересекает вертикальную стену
      const y = snapped.y
      a.y = y
      b.y = y
    } else if (Math.abs(a.x - b.x) < eps) {
      // Вертикальный отрезок пересекает горизонтальную стену
      const x = snapped.x
      a.x = x
      b.x = x
    }
  }

  return deduplicateRoute(list)
}

function deduplicateRoute(route: Vector2[]): Vector2[] {
  const eps = 1e-3
  const result: Vector2[] = []
  for (const p of route) {
    if (result.length === 0 || p.distanceTo(result[result.length - 1]) > eps) {
      result.push(p.clone())
    }
  }
  return result
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
