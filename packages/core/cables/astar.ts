import { NavGrid } from './navGrid'

export interface AStarNode {
  x: number
  y: number
  g: number // стоимость пути от старта
  h: number // эвристика до цели
  f: number // g + h
  parent: AStarNode | null
}

/**
 * Алгоритм A* для поиска пути на NavGrid.
 */
export function findPath(
  grid: NavGrid,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Array<{ x: number; y: number }> | null {
  const openSet: AStarNode[] = []
  const closedSet = new Set<string>()

  const startNode: AStarNode = {
    x: startX,
    y: startY,
    g: 0,
    h: heuristic(startX, startY, endX, endY),
    f: 0,
    parent: null,
  }
  startNode.f = startNode.g + startNode.h

  openSet.push(startNode)

  const directions = [
    { dx: 0, dy: -1, cost: 1 }, // up
    { dx: 1, dy: 0, cost: 1 },  // right
    { dx: 0, dy: 1, cost: 1 },  // down
    { dx: -1, dy: 0, cost: 1 }, // left
    { dx: 1, dy: -1, cost: 1.414 }, // up-right
    { dx: 1, dy: 1, cost: 1.414 },  // down-right
    { dx: -1, dy: 1, cost: 1.414 }, // down-left
    { dx: -1, dy: -1, cost: 1.414 }, // up-left
  ]

  while (openSet.length > 0) {
    // Находим узел с минимальным f
    openSet.sort((a, b) => a.f - b.f)
    const current = openSet.shift()!

    // Достигли цели
    if (current.x === endX && current.y === endY) {
      return reconstructPath(current)
    }

    closedSet.add(`${current.x},${current.y}`)

    // Проверяем соседей
    for (const dir of directions) {
      const nx = current.x + dir.dx
      const ny = current.y + dir.dy

      if (!grid.isValid(nx, ny)) continue
      if (closedSet.has(`${nx},${ny}`)) continue

      const cell = grid.getCell(nx, ny)
      if (!cell || !cell.walkable) continue

      const g = current.g + dir.cost * cell.cost
      const h = heuristic(nx, ny, endX, endY)
      const f = g + h

      const existing = openSet.find((n) => n.x === nx && n.y === ny)
      if (existing) {
        if (g < existing.g) {
          existing.g = g
          existing.f = g + existing.h
          existing.parent = current
        }
      } else {
        openSet.push({
          x: nx,
          y: ny,
          g,
          h,
          f,
          parent: current,
        })
      }
    }
  }

  return null
}

/**
 * Эвристика (манхэттенское расстояние).
 */
function heuristic(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1)
}

/**
 * Восстанавливает путь из конечного узла.
 */
function reconstructPath(node: AStarNode): Array<{ x: number; y: number }> {
  const path: Array<{ x: number; y: number }> = []
  let current: AStarNode | null = node

  while (current) {
    path.unshift({ x: current.x, y: current.y })
    current = current.parent
  }

  return path
}
