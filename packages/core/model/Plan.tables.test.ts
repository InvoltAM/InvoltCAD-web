import { describe, it, expect } from 'vitest'
import { Plan } from './Plan'
import { Vector2 } from '../geometry/Vector2'

function addRectRoom(plan: Plan, width: number, height: number, center: Vector2): void {
  const halfW = width / 2
  const halfH = height / 2
  const cx = center.x
  const cy = center.y
  plan.addWall(new Vector2(cx - halfW, cy - halfH), new Vector2(cx + halfW, cy - halfH))
  plan.addWall(new Vector2(cx + halfW, cy - halfH), new Vector2(cx + halfW, cy + halfH))
  plan.addWall(new Vector2(cx + halfW, cy + halfH), new Vector2(cx - halfW, cy + halfH))
  plan.addWall(new Vector2(cx - halfW, cy + halfH), new Vector2(cx - halfW, cy - halfH))
}

describe('Plan sheet tables', () => {
  it('adds a sheet table', () => {
    const plan = new Plan()
    const table = plan.addSheetTable('roomNumbers', new Vector2(100, 200))
    expect(table.type).toBe('roomNumbers')
    expect(table.position.x).toBe(100)
    expect(table.position.y).toBe(200)
    expect(plan.tables.length).toBe(1)
  })

  it('removes a sheet table', () => {
    const plan = new Plan()
    const table = plan.addSheetTable('spec', new Vector2(0, 0))
    plan.removeSheetTable(table.id)
    expect(plan.tables.length).toBe(0)
  })

  it('moves a sheet table', () => {
    const plan = new Plan()
    const table = plan.addSheetTable('cables', new Vector2(0, 0))
    plan.moveSheetTable(table.id, new Vector2(500, 600))
    expect(table.position.x).toBe(500)
    expect(table.position.y).toBe(600)
  })

  it('resizes a sheet table', () => {
    const plan = new Plan()
    const table = plan.addSheetTable('cables', new Vector2(0, 0), 300, 200, 1)
    plan.resizeSheetTable(table.id, 2, new Vector2(100, 100))
    expect(table.scale).toBe(2)
    expect(table.position.x).toBe(100)
    expect(table.position.y).toBe(100)
  })

  it('preserves table scale through serialization', () => {
    const plan = new Plan()
    addRectRoom(plan, 4000, 3000, new Vector2(0, 0))
    const table = plan.addSheetTable('roomNumbers', new Vector2(100, 200), 300, 200, 1.5)

    const json = plan.toJSON()
    const restored = Plan.fromJSON(json)

    expect(restored.tables[0].scale).toBe(1.5)
  })

  it('serializes and restores tables', () => {
    const plan = new Plan()
    addRectRoom(plan, 4000, 3000, new Vector2(0, 0))
    plan.addSheetTable('roomNumbers', new Vector2(100, 200))
    plan.addSheetTable('spec', new Vector2(300, 400))

    const json = plan.toJSON()
    const restored = Plan.fromJSON(json)

    expect(restored.tables.length).toBe(2)
    expect(restored.tables[0].type).toBe('roomNumbers')
    expect(restored.tables[0].position.x).toBe(100)
    expect(restored.tables[1].type).toBe('spec')
  })
})
