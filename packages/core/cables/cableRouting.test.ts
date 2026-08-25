import { describe, it, expect } from 'vitest'
import { Plan } from '../model/Plan'
import { Vector2 } from '../geometry/Vector2'
import { routeCable, routeCableWithVia, simplifyRoute } from './cableRouting'

describe('cableRouting', () => {
  it('строит прямой маршрут без препятствий', () => {
    const plan = new Plan()
    const from = new Vector2(-500, 0)
    const to = new Vector2(500, 0)
    const route = routeCable(plan, from, to, 50)
    expect(route).toBeTruthy()
    expect(route!.length).toBeGreaterThanOrEqual(2)
    expect(route![0].distanceTo(from)).toBeLessThan(100)
    expect(route![route!.length - 1].distanceTo(to)).toBeLessThan(100)
  })

  it('обходит вертикальную стену', () => {
    const plan = new Plan()
    plan.addWall(new Vector2(0, -1000), new Vector2(0, 1000))
    const from = new Vector2(-500, 0)
    const to = new Vector2(500, 0)
    const route = routeCable(plan, from, to, 50)
    expect(route).toBeTruthy()
    expect(route!.length).toBeGreaterThanOrEqual(3)
    // Маршрут не должен проходить через стену (x ≈ 0)
    for (const p of route!) {
      expect(Math.abs(p.x)).not.toBeCloseTo(0, 0)
    }
  })

  it('обходит длинную вертикальную стену', () => {
    const plan = new Plan()
    plan.addWall(new Vector2(0, -3700), new Vector2(0, 3700))
    const from = new Vector2(-100, 0)
    const to = new Vector2(1000, 0)
    const route = routeCable(plan, from, to, 50)
    expect(route).toBeTruthy()
    expect(route!.length).toBeGreaterThanOrEqual(3)
  })

  it('обходит вертикальную перегородку внутри комнаты', () => {
    const plan = new Plan()
    plan.addWall(new Vector2(-2000, -1500), new Vector2(2000, -1500))
    plan.addWall(new Vector2(2000, -1500), new Vector2(2000, 1500))
    plan.addWall(new Vector2(2000, 1500), new Vector2(-2000, 1500))
    plan.addWall(new Vector2(-2000, 1500), new Vector2(-2000, -1500))
    plan.addWall(new Vector2(0, -1500), new Vector2(0, 0))
    const from = new Vector2(-1000, 0)
    const to = new Vector2(1000, 0)
    const route = routeCable(plan, from, to, 50)
    expect(route).toBeTruthy()
    expect(route!.length).toBeGreaterThanOrEqual(3)
  })

  it('проходит через дверной проём', () => {
    const plan = new Plan()
    const wall = plan.addWall(new Vector2(-1000, 0), new Vector2(1000, 0))
    const opening = plan.addOpening(wall.id, 'door', 0.5, 600)!
    const from = new Vector2(-200, -200)
    const to = new Vector2(200, 200)
    const route = routeCable(plan, from, to, 50)
    expect(route).toBeTruthy()
    expect(route!.length).toBeGreaterThanOrEqual(2)
    // Маршрут должен пересекать линию стены в пределах проёма
    // (с учётом размера ячейки сетки).
    const halfWidth = opening.width / 2 + 50
    let crossesOpening = false
    for (let i = 1; i < route!.length; i++) {
      const a = route![i - 1]
      const b = route![i]
      if ((a.y < 0 && b.y > 0) || (a.y > 0 && b.y < 0)) {
        const t = a.y === b.y ? 0 : a.x + (b.x - a.x) * (-a.y / (b.y - a.y))
        if (Math.abs(t) <= halfWidth) {
          crossesOpening = true
        }
      }
    }
    expect(crossesOpening).toBe(true)
  })

  it('не проходит через оконный проём', () => {
    const plan = new Plan()
    plan.addWall(new Vector2(-1000, -1000), new Vector2(-1000, 1000))
    plan.addWall(new Vector2(-1000, 1000), new Vector2(1000, 1000))
    plan.addWall(new Vector2(1000, 1000), new Vector2(1000, -1000))
    plan.addWall(new Vector2(1000, -1000), new Vector2(-1000, -1000))
    const wall = plan.addWall(new Vector2(0, -1000), new Vector2(0, 1000))
    plan.addOpening(wall.id, 'window', 0.5, 600)
    const from = new Vector2(-500, 0)
    const to = new Vector2(500, 0)
    const route = routeCable(plan, from, to, 50)
    // Оконный проём не проходим, перегородка полностью разделяет комнату,
    // поэтому маршрута быть не должно.
    expect(route).toBeFalsy()
  })

  it('обходит вертикальную перегородку между устройствами на одной стене', () => {
    const plan = new Plan()
    plan.addWall(new Vector2(1000, 1000), new Vector2(7000, 1000))
    plan.addWall(new Vector2(7000, 1000), new Vector2(7000, 5000))
    plan.addWall(new Vector2(7000, 5000), new Vector2(1000, 5000))
    plan.addWall(new Vector2(1000, 5000), new Vector2(1000, 1000))
    const partition = plan.addWall(new Vector2(4000, 1000), new Vector2(4000, 5000))
    plan.addOpening(partition.id, 'door', 0.5, 1200)
    const from = plan.deviceCableRoutingPoint(plan.addDevice(plan.walls[2].id, 'socket', 0.3, 0, 1)!)
    const to = plan.deviceCableRoutingPoint(plan.addDevice(plan.walls[2].id, 'socket', 0.7, 0, 1)!)
    const route = routeCable(plan, from, to, 50)
    expect(route).toBeTruthy()
    expect(route!.length).toBeGreaterThanOrEqual(3)
    // Маршрут должен пройти через проём в перегородке (y ≈ 3000 ± 700)
    let crossesOpening = false
    for (let i = 1; i < route!.length; i++) {
      const a = route![i - 1]
      const b = route![i]
      if ((a.x < 4000 && b.x > 4000) || (a.x > 4000 && b.x < 4000)) {
        const t = a.x === b.x ? 0 : (4000 - a.x) / (b.x - a.x)
        const y = a.y + (b.y - a.y) * t
        if (Math.abs(y - 3000) <= 700) crossesOpening = true
      }
    }
    expect(crossesOpening).toBe(true)
  })

  it('typical socket layouts produce compact Visio-like routes', () => {
    const plan = new Plan()
    plan.addWall(new Vector2(1000, 1000), new Vector2(7000, 1000))
    plan.addWall(new Vector2(7000, 1000), new Vector2(7000, 5000))
    plan.addWall(new Vector2(7000, 5000), new Vector2(1000, 5000))
    plan.addWall(new Vector2(1000, 5000), new Vector2(1000, 1000))
    const partition = plan.addWall(new Vector2(4000, 1000), new Vector2(4000, 5000))
    plan.addOpening(partition.id, 'door', 0.5, 1200)
    const bottom1 = plan.deviceCableRoutingPoint(plan.addDevice(plan.walls[2].id, 'socket', 0.2, 0, 1)!)
    const bottom2 = plan.deviceCableRoutingPoint(plan.addDevice(plan.walls[2].id, 'socket', 0.8, 0, 1)!)
    const left = plan.deviceCableRoutingPoint(plan.addDevice(plan.walls[3].id, 'socket', 0.5, 0, 1)!)
    const right = plan.deviceCableRoutingPoint(plan.addDevice(plan.walls[1].id, 'socket', 0.5, 0, 1)!)

    const r1 = routeCable(plan, bottom1, bottom2, 50)
    const r5 = routeCable(plan, left, right, 50)

    expect(r1).toBeTruthy()
    expect(r1!.length).toBeLessThanOrEqual(5)
    expect(r5).toBeTruthy()
    expect(r5!.length).toBeLessThanOrEqual(4)

    // Маршрут по одной стене должен пересекать перегородку через проём
    let crossesOpening = false
    for (let i = 1; i < r1!.length; i++) {
      const a = r1![i - 1]
      const b = r1![i]
      if ((a.x < 4000 && b.x > 4000) || (a.x > 4000 && b.x < 4000)) {
        const t = a.x === b.x ? 0 : (4000 - a.x) / (b.x - a.x)
        const y = a.y + (b.y - a.y) * t
        if (Math.abs(y - 3000) <= 700) crossesOpening = true
      }
    }
    expect(crossesOpening).toBe(true)
  })

  it('склеивает сегменты через промежуточные точки', () => {
    const plan = new Plan()
    plan.addWall(new Vector2(0, -1000), new Vector2(0, 1000))
    const points = [new Vector2(-500, 0), new Vector2(-500, 500), new Vector2(500, 500)]
    const route = routeCableWithVia(plan, points, 50)
    expect(route).toBeTruthy()
    expect(route!.length).toBeGreaterThanOrEqual(3)
  })

  it('не зависает на большом плане с перегородкой и проёмом', () => {
    const plan = new Plan()
    // Комната 20×15 м с центральной перегородкой и дверным проёмом
    plan.addWall(new Vector2(-10000, -7500), new Vector2(10000, -7500))
    plan.addWall(new Vector2(10000, -7500), new Vector2(10000, 7500))
    plan.addWall(new Vector2(10000, 7500), new Vector2(-10000, 7500))
    plan.addWall(new Vector2(-10000, 7500), new Vector2(-10000, -7500))
    const partition = plan.addWall(new Vector2(0, -7500), new Vector2(0, 7500))
    plan.addOpening(partition.id, 'door', 0.5, 1200)
    const from = new Vector2(-5000, 0)
    const to = new Vector2(5000, 0)
    const start = performance.now()
    const route = routeCable(plan, from, to, 50)
    const elapsed = performance.now() - start
    expect(route).toBeTruthy()
    expect(elapsed).toBeLessThan(1000)
  })

  it('упрощает маршрут, удаляя точки на одной прямой', () => {
    const route = [
      new Vector2(0, 0),
      new Vector2(100, 0),
      new Vector2(200, 0),
      new Vector2(200, 100),
    ]
    const simplified = simplifyRoute(route)
    expect(simplified.length).toBe(3)
    expect(simplified[0].x).toBe(0)
    expect(simplified[1].x).toBe(200)
    expect(simplified[2].x).toBe(200)
    expect(simplified[2].y).toBe(100)
  })
})
