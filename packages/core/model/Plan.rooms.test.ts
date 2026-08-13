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

describe('Plan room numbers and names', () => {
  it('assigns number 1 to a single detected room', () => {
    const plan = new Plan()
    addRectRoom(plan, 4000, 3000, new Vector2(0, 0))

    const rooms = plan.getRooms()
    expect(rooms.length).toBe(1)
    expect(rooms[0].number).toBe(1)
    expect(rooms[0].name).toBe('')
    expect(rooms[0].area).toBeGreaterThan(10_000_000)
  })

  it('assigns unique numbers to multiple rooms', () => {
    const plan = new Plan()
    // Outer rectangle 8000x3000 with internal wall at x=0
    addRectRoom(plan, 8000, 3000, new Vector2(0, 0))
    plan.addWall(new Vector2(0, -1500), new Vector2(0, 1500))

    const rooms = plan.getRooms()
    expect(rooms.length).toBe(2)
    const numbers = rooms.map((r) => r.number).sort((a, b) => a - b)
    expect(numbers).toEqual([1, 2])
  })

  it('preserves room name through serialization', () => {
    const plan = new Plan()
    addRectRoom(plan, 4000, 3000, new Vector2(0, 0))

    const room = plan.getRooms()[0]
    plan.updateRoomName(room.id, 'Гостиная')

    const json = plan.toJSON()
    const restored = Plan.fromJSON(json)
    const restoredRoom = restored.getRooms()[0]

    expect(restoredRoom.number).toBe(1)
    expect(restoredRoom.name).toBe('Гостиная')
  })

  it('matches existing room after small translation', () => {
    const plan = new Plan()
    addRectRoom(plan, 4000, 3000, new Vector2(0, 0))

    const room = plan.getRooms()[0]
    plan.updateRoomName(room.id, 'Кухня')

    // Slightly translate all walls (keeping closure)
    for (const wall of plan.walls) {
      wall.a.x += 10
      wall.a.y += 10
      wall.b.x += 10
      wall.b.y += 10
    }
    plan.invalidateRooms()

    const rooms = plan.getRooms()
    expect(rooms.length).toBe(1)
    expect(rooms[0].id).toBe(room.id)
    expect(rooms[0].number).toBe(1)
    expect(rooms[0].name).toBe('Кухня')
  })
})
