import { Vector2 } from '../geometry/Vector2'
import { Plan } from '../model/Plan'
import { NavGrid } from './navGrid'
import { findPath } from './astar'

/**
 * Автотрассировка кабеля между двумя точками с учётом стен и существующих кабелей.
 */
export function routeCable(
  plan: Plan,
  from: Vector2,
  to: Vector2,
  cellSize = 50
): Vector2[] | null {
  // Строим NavGrid из плана
  const grid = NavGrid.fromPlan(plan, cellSize)

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
