import { describe, it, expect } from 'vitest'
import { Plan } from '@core/model/Plan'
import { Vector2 } from '@core/geometry/Vector2'
import { serializePlanForAi } from './planSerializer'

describe('serializePlanForAi', () => {
  it('serializes an empty plan', () => {
    const plan = new Plan()
    const snapshot = serializePlanForAi(plan)

    expect(snapshot.rooms).toEqual([])
    expect(snapshot.walls).toEqual([])
    expect(snapshot.openings).toEqual([])
    expect(snapshot.devices).toEqual([])
    expect(snapshot.cables).toEqual([])
    expect(snapshot.electrical.consumersCount).toBe(0)
  })

  it('serializes walls and rooms', () => {
    const plan = new Plan()
    plan.addWall(new Vector2(0, 0), new Vector2(5000, 0))
    plan.addWall(new Vector2(5000, 0), new Vector2(5000, 5000))
    plan.addWall(new Vector2(5000, 5000), new Vector2(0, 5000))
    plan.addWall(new Vector2(0, 5000), new Vector2(0, 0))

    const snapshot = serializePlanForAi(plan)

    expect(snapshot.walls).toHaveLength(4)
    expect(snapshot.rooms).toHaveLength(1)
    expect(snapshot.rooms[0].areaM2).toBeGreaterThan(20)
    expect(snapshot.rooms[0].centroid.x).toBeCloseTo(2500, 1)
    expect(snapshot.rooms[0].centroid.y).toBeCloseTo(2500, 1)
  })
})

