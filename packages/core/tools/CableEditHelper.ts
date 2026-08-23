import { Vector2 } from '../geometry/Vector2'
import { Plan } from '../model/Plan'
import { segmentCrossesWallOutsideOpening, routeCableWithVia } from '../cables/cableRouting'

const ORTHO_EPS = 1e-3

/**
 * Определяет, горизонтален ли отрезок [a,b] (|dx| >= |dy|).
 */
export function segmentIsHorizontal(a: Vector2, b: Vector2): boolean {
  return Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)
}

/**
 * Определяет, вертикален ли отрезок [a,b] (|dy| > |dx|).
 */
export function segmentIsVertical(a: Vector2, b: Vector2): boolean {
  return Math.abs(b.y - a.y) > Math.abs(b.x - a.x)
}

/**
 * Возвращает единичный вектор, перпендикулярный отрезку [a,b].
 * Для горизонтального отрезка — (0,1), для вертикального — (1,0).
 */
function edgeNormal(a: Vector2, b: Vector2): Vector2 {
  if (segmentIsHorizontal(a, b)) {
    return new Vector2(0, 1)
  }
  return new Vector2(1, 0)
}

/**
 * Перемещает грань кабеля ортогонально её направлению.
 * Редактируемые концы грани смещаются на одинаковую величину по нормали.
 * Крайние anchor-точки (начало/конец кабеля) остаются неподвижными.
 */
export function moveCableEdgeOrthogonal(
  route: Vector2[],
  edgeIndex: number,
  startWorld: Vector2,
  currentWorld: Vector2,
): Vector2[] {
  if (edgeIndex < 0 || edgeIndex >= route.length - 1) {
    return route.map((p) => p.clone())
  }

  const a = route[edgeIndex]
  const b = route[edgeIndex + 1]
  const delta = currentWorld.sub(startWorld)
  const n = edgeNormal(a, b)
  const offset = n.scale(delta.dot(n))

  const result = route.map((p) => p.clone())
  // Левый конец грани редактируем, если это не первая anchor-точка.
  if (edgeIndex > 0) {
    result[edgeIndex] = a.add(offset)
  }
  // Правый конец грани редактируем, если это не последняя anchor-точка.
  if (edgeIndex + 1 < route.length - 1) {
    result[edgeIndex + 1] = b.add(offset)
  }

  return result
}

/**
 * Перемещает вершину кабеля, сохраняя ортогональность смежных сегментов.
 * Соседние редактируемые точки сдвигаются каскадно, пока сегменты остаются
 * горизонтальными/вертикальными. Anchor-концы неподвижны.
 */
export function moveCableVertexOrthogonal(
  route: Vector2[],
  vertexIndex: number,
  startWorld: Vector2,
  currentWorld: Vector2,
): Vector2[] {
  if (vertexIndex <= 0 || vertexIndex >= route.length - 1) {
    return route.map((p) => p.clone())
  }

  const original = route.map((p) => p.clone())
  const delta = currentWorld.sub(startWorld)

  const result = original.map((p) => p.clone())
  result[vertexIndex] = original[vertexIndex].add(delta)

  // Распространяем смещение влево, сохраняя ортогональность сегментов.
  let dx = delta.x
  let dy = delta.y
  for (let i = vertexIndex - 1; i > 0; i--) {
    const a = original[i]
    const b = original[i + 1]
    if (segmentIsHorizontal(a, b)) {
      result[i] = new Vector2(original[i].x, original[i].y + dy)
      dy = result[i].y - original[i].y
    } else if (segmentIsVertical(a, b)) {
      result[i] = new Vector2(original[i].x + dx, original[i].y)
      dx = result[i].x - original[i].x
    } else {
      break
    }
  }

  // Распространяем смещение вправо.
  dx = delta.x
  dy = delta.y
  for (let i = vertexIndex + 1; i < route.length - 1; i++) {
    const a = original[i - 1]
    const b = original[i]
    if (segmentIsHorizontal(a, b)) {
      result[i] = new Vector2(original[i].x, original[i].y + dy)
      dy = result[i].y - original[i].y
    } else if (segmentIsVertical(a, b)) {
      result[i] = new Vector2(original[i].x + dx, original[i].y)
      dx = result[i].x - original[i].x
    } else {
      break
    }
  }

  return result
}

/**
 * Если отрезок [route[i], route[i+1]] пересекает стены вне дверных проёмов,
 * заменяет его на автотрассированный подмаршрут обхода.
 * Возвращает новый маршрут (копию исходного, если пересечений нет).
 */
export function rerouteCableEdgeAroundObstacles(
  plan: Plan,
  route: Vector2[],
  edgeIndex: number,
  cellSize = 50,
): Vector2[] {
  if (edgeIndex < 0 || edgeIndex >= route.length - 1) {
    return route.map((p) => p.clone())
  }

  const a = route[edgeIndex]
  const b = route[edgeIndex + 1]
  if (!segmentCrossesWallOutsideOpening(a, b, plan)) {
    return route.map((p) => p.clone())
  }

  const detour = routeCableWithVia(plan, [a.clone(), b.clone()], cellSize)
  if (!detour || detour.length < 2) {
    return route.map((p) => p.clone())
  }

  const result: Vector2[] = []
  for (let j = 0; j <= edgeIndex; j++) {
    result.push(route[j].clone())
  }
  // detour[0] === a, detour[last] === b — их не дублируем
  for (let j = 1; j < detour.length - 1; j++) {
    result.push(detour[j].clone())
  }
  for (let j = edgeIndex + 1; j < route.length; j++) {
    result.push(route[j].clone())
  }

  // Удалим возможные дубликаты, возникшие из-за совпадения точек.
  const deduped: Vector2[] = []
  const eps = 1
  for (const p of result) {
    if (deduped.length === 0 || deduped[deduped.length - 1].distanceTo(p) > eps) {
      deduped.push(p)
    }
  }

  return deduped
}

/**
 * Проверяет, есть ли в маршруте отрезки, пересекающие стены вне дверных проёмов.
 */
export function cableRouteHasWallCrossing(plan: Plan, route: Vector2[]): boolean {
  for (let i = 0; i < route.length - 1; i++) {
    if (segmentCrossesWallOutsideOpening(route[i], route[i + 1], plan)) {
      return true
    }
  }
  return false
}

/**
 * Чинит маршрут, заменяя все отрезки, пересекающие стены вне дверных проёмов,
 * на автотрассированные обходы.
 * Возвращает `{ route, repaired }`; если какой-то участок починить не удалось,
 * `repaired === false`.
 */
export function repairCableRoute(
  plan: Plan,
  route: Vector2[],
  cellSize = 50,
): { route: Vector2[]; repaired: boolean } {
  if (route.length < 2) {
    return { route: route.map((p) => p.clone()), repaired: true }
  }

  const result: Vector2[] = [route[0].clone()]
  let repaired = true

  for (let i = 0; i < route.length - 1; i++) {
    const a = result[result.length - 1]
    const b = route[i + 1].clone()

    if (segmentCrossesWallOutsideOpening(a, b, plan)) {
      const detour = routeCableWithVia(plan, [a.clone(), b.clone()], cellSize)
      if (detour && detour.length >= 2) {
        // detour[0] совпадает с a, последняя точка — с b
        for (let j = 1; j < detour.length; j++) {
          result.push(detour[j].clone())
        }
      } else {
        result.push(b)
        repaired = false
      }
    } else {
      result.push(b)
    }
  }

  return { route: deduplicateRoute(result), repaired }
}

/**
 * Обрезает маршрут, удаляя подряд идущие дублирующиеся точки.
 */
export function deduplicateRoute(route: Vector2[], eps = 1): Vector2[] {
  const result: Vector2[] = []
  for (const p of route) {
    if (result.length === 0 || result[result.length - 1].distanceTo(p) > eps) {
      result.push(p.clone())
    }
  }
  return result
}
