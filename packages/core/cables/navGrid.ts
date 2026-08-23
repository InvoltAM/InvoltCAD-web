import { Vector2 } from '../geometry/Vector2'
import { Wall, wallPolyline } from '../model/Wall'
import { Cable } from '../model/Cable'

/** Минимальный план, необходимый для построения сетки проходимости. */
export interface NavigablePlan {
  walls: Wall[]
  cables: Cable[]
  getBounds(margin?: number): { min: Vector2; max: Vector2 }
}

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
          cost: 50,
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
   * Если задан радиус, отмечает квадратную область вокруг ячейки,
   * чтобы учитывать толщину стены.
   */
  markWall(x: number, y: number, radius = 0): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cell = this.getCell(x + dx, y + dy)
        if (cell) {
          cell.walkable = false
          cell.cost = Infinity
        }
      }
    }
  }

  /**
   * Отмечает ячейку как проходимую с пониженной стоимостью (проём).
   */
  markOpening(x: number, y: number): void {
    const cell = this.getCell(x, y)
    if (cell) {
      cell.walkable = true
      cell.cost = 1
    }
  }

  /**
   * Отмечает проходимыми ячейки вдоль проёма, чтобы кабель мог проходить
   * через дверные/оконные проёмы. Коридор ширины `radius` вокруг оси проёма
   * очищается от стены и получает пониженную стоимость.
   */
  markOpeningSegment(x: number, y: number, radius = 1): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cell = this.getCell(x + dx, y + dy)
        if (cell) {
          cell.walkable = true
          if (cell.cost > 5) {
            cell.cost = 5
          }
        }
      }
    }
  }

  /**
   * Увеличивает стоимость ячейки из-за кабеля.
   */
  markCable(x: number, y: number): void {
    const cell = this.getCell(x, y)
    if (cell) {
      cell.cableCount++
      // Небольшой штраф за пересечение с другими кабелями, но не запрещаем
      cell.cost += 4
    }
  }

  /**
   * Отмечает прямоугольную область как проходимую (проём).
   * В отличие от markOpeningSegment с радиусом, не выходит за границы проёма,
   * поэтому кабель не может "обойти" стену по краю проёма.
   */
  markOpeningRect(minX: number, minY: number, maxX: number, maxY: number): void {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cell = this.getCell(x, y)
        if (cell) {
          cell.walkable = true
          cell.cost = 1
        }
      }
    }
  }

  /**
   * Понижает стоимость проходимых ячеек вблизи стены,
   * чтобы кабель предпочитал трассировку вдоль стен с отступом.
   * Радиус 1 → cost 5, радиус 2 → cost 7.
   */
  markWallPreference(x: number, y: number, radius = 2): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cell = this.getCell(x + dx, y + dy)
        if (!cell || !cell.walkable) continue
        const ring = Math.max(Math.abs(dx), Math.abs(dy))
        if (ring === 0) continue
        // Чем ближе к стене, тем дешевле проход — кабель тянется вдоль стены с отступом
        const preferredCost = ring === 1 ? 1 : 4
        if (cell.cost > preferredCost) {
          cell.cost = preferredCost
        }
      }
    }
  }

  /**
   * Строит сетку проходимости из плана.
   * Опционально расширяет границы дополнительными точками (например,
   * началом/концом трассируемого кабеля), чтобы они точно попали в сетку.
   */
  static fromPlan(plan: NavigablePlan, cellSize = 50, margin = 200, extraPoints: Vector2[] = []): NavGrid {
    const bounds = plan.getBounds(margin)
    for (const p of extraPoints) {
      bounds.min.x = Math.min(bounds.min.x, p.x)
      bounds.min.y = Math.min(bounds.min.y, p.y)
      bounds.max.x = Math.max(bounds.max.x, p.x)
      bounds.max.y = Math.max(bounds.max.y, p.y)
    }
    // Небольшой запас, чтобы старт/финиш точно влезали
    bounds.min.x -= cellSize + margin
    bounds.min.y -= cellSize + margin
    bounds.max.x += cellSize + margin
    bounds.max.y += cellSize + margin
    const grid = new NavGrid(
      bounds.min.x,
      bounds.min.y,
      bounds.max.x,
      bounds.max.y,
      cellSize
    )

    // Отмечаем стены как препятствия (с учётом половины толщины стены)
    const wallGridPositions: { x: number; y: number }[] = []
    for (const wall of plan.walls) {
      const polyline = wallPolyline(wall, cellSize / 2)
      const wallRadius = Math.max(0, Math.ceil((wall.thickness / 2) / cellSize))
      for (let i = 0; i < polyline.length - 1; i++) {
        const a = polyline[i]
        const b = polyline[i + 1]
        const steps = Math.max(1, Math.ceil(a.distanceTo(b) / cellSize))
        for (let j = 0; j <= steps; j++) {
          const t = j / steps
          const x = a.x + (b.x - a.x) * t
          const y = a.y + (b.y - a.y) * t
          const gridPos = grid.worldToGrid(new Vector2(x, y))
          wallGridPositions.push(gridPos)
          grid.markWall(gridPos.x, gridPos.y, wallRadius)
        }
      }

      // Отмечаем дверные проёмы как проходимые прямоугольником вдоль стены.
      // Оконные проёмы остаются непроходимыми.
      for (const opening of wall.openings) {
        if (opening.type !== 'door') continue
        const wallLen = wall.a.distanceTo(wall.b)
        const dir = wall.b.sub(wall.a).normalized()
        const n = dir.perpendicular()
        const center = wall.a.add(dir.scale(opening.t * wallLen))
        const halfWidth = opening.width / 2
        const halfThick = wall.thickness / 2
        const start = center.sub(dir.scale(halfWidth))
        const end = center.add(dir.scale(halfWidth))
        const a = start.add(n.scale(-halfThick))
        const b = start.add(n.scale(halfThick))
        const c = end.add(n.scale(halfThick))
        const d = end.add(n.scale(-halfThick))
        const min = grid.worldToGrid(new Vector2(
          Math.min(a.x, b.x, c.x, d.x),
          Math.min(a.y, b.y, c.y, d.y),
        ))
        const max = grid.worldToGrid(new Vector2(
          Math.max(a.x, b.x, c.x, d.x),
          Math.max(a.y, b.y, c.y, d.y),
        ))
        grid.markOpeningRect(min.x, min.y, max.x, max.y)
      }
    }

    // Понижаем стоимость ячеек рядом со стенами — кабель идёт вдоль стен с отступом
    for (const gridPos of wallGridPositions) {
      grid.markWallPreference(gridPos.x, gridPos.y, 2)
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
