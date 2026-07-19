import { Vector2 } from '../geometry/Vector2'
import { Plan } from '../model/Plan'
import { Wall, wallPolyline } from '../model/Wall'

export interface NavGridCell {
  x: number
  y: number
  walkable: boolean
  cost: number
  cableCount: number
}

/**
 * Сетка проходимости для автотрассировки кабелей.
 * Стены — препятствия, проёмы — проходимы, кабели — увеличивают стоимость.
 */
export class NavGrid {
  cellSize: number
  width: number
  height: number
  cells: NavGridCell[][]

  constructor(
    public minX: number,
    public minY: number,
    public maxX: number,
    public maxY: number,
    cellSize = 50
  ) {
    this.cellSize = cellSize
    this.width = Math.ceil((maxX - minX) / cellSize)
    this.height = Math.ceil((maxY - minY) / cellSize)

    // Инициализация сетки
    this.cells = []
    for (let y = 0; y < this.height; y++) {
      const row: NavGridCell[] = []
      for (let x = 0; x < this.width; x++) {
        row.push({
          x,
          y,
          walkable: true,
          cost: 10,
          cableCount: 0,
        })
      }
      this.cells.push(row)
    }
  }

  /**
   * Преобразует мировые координаты в координаты сетки.
   */
  worldToGrid(pos: Vector2): { x: number; y: number } {
    return {
      x: Math.floor((pos.x - this.minX) / this.cellSize),
      y: Math.floor((pos.y - this.minY) / this.cellSize),
    }
  }

  /**
   * Преобразует координаты сетки в мировые координаты (центр ячейки).
   */
  gridToWorld(x: number, y: number): Vector2 {
    return new Vector2(
      this.minX + x * this.cellSize + this.cellSize / 2,
      this.minY + y * this.cellSize + this.cellSize / 2
    )
  }

  /**
   * Проверяет, находится ли точка внутри сетки.
   */
  isValid(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height
  }

  /**
   * Получает ячейку по координатам сетки.
   */
  getCell(x: number, y: number): NavGridCell | null {
    if (!this.isValid(x, y)) return null
    return this.cells[y][x]
  }

  /**
   * Отмечает ячейку как непроходимую (стена).
   */
  markWall(x: number, y: number): void {
    const cell = this.getCell(x, y)
    if (cell) {
      cell.walkable = false
      cell.cost = Infinity
    }
  }

  /**
   * Отмечает ячейку как проходимую с пониженной стоимостью (проём).
   */
  markOpening(x: number, y: number): void {
    const cell = this.getCell(x, y)
    if (cell) {
      cell.walkable = true
      cell.cost = 5
    }
  }

  /**
   * Увеличивает стоимость ячейки из-за кабеля.
   */
  markCable(x: number, y: number): void {
    const cell = this.getCell(x, y)
    if (cell) {
      cell.cableCount++
      cell.cost += 15
    }
  }

  /**
   * Строит сетку проходимости из плана.
   */
  static fromPlan(plan: Plan, cellSize = 50, margin = 200): NavGrid {
    const bounds = plan.getBounds(margin)
    const grid = new NavGrid(
      bounds.min.x,
      bounds.min.y,
      bounds.max.x,
      bounds.max.y,
      cellSize
    )

    // Отмечаем стены как препятствия
    for (const wall of plan.walls) {
      const polyline = wallPolyline(wall, cellSize / 2)
      for (let i = 0; i < polyline.length - 1; i++) {
        const a = polyline[i]
        const b = polyline[i + 1]
        const steps = Math.max(1, Math.ceil(a.distanceTo(b) / cellSize))
        for (let j = 0; j <= steps; j++) {
          const t = j / steps
          const x = a.x + (b.x - a.x) * t
          const y = a.y + (b.y - a.y) * t
          const gridPos = grid.worldToGrid(new Vector2(x, y))
          grid.markWall(gridPos.x, gridPos.y)
        }
      }

      // Отмечаем проёмы как проходимые
      for (const opening of wall.openings) {
        const wallLen = wall.a.distanceTo(wall.b)
        const dir = wall.b.sub(wall.a).normalized()
        const center = wall.a.add(dir.scale(opening.t * wallLen))
        const gridPos = grid.worldToGrid(center)
        grid.markOpening(gridPos.x, gridPos.y)
      }
    }

    // Отмечаем существующие кабели
    for (const cable of plan.cables) {
      for (const point of cable.route) {
        const gridPos = grid.worldToGrid(point)
        grid.markCable(gridPos.x, gridPos.y)
      }
    }

    return grid
  }
}
