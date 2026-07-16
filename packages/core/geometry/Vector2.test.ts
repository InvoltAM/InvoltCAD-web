import { describe, it, expect } from 'vitest'
import { Vector2 } from '@core/geometry/Vector2'

describe('Vector2', () => {
  it('создаёт вектор с координатами', () => {
    const v = new Vector2(3, 4)
    expect(v.x).toBe(3)
    expect(v.y).toBe(4)
  })

  it('вычисляет длину', () => {
    const v = new Vector2(3, 4)
    expect(v.length()).toBe(5)
  })

  it('складывает векторы', () => {
    const a = new Vector2(1, 2)
    const b = new Vector2(3, 4)
    const c = a.add(b)
    expect(c.x).toBe(4)
    expect(c.y).toBe(6)
  })

  it('вычитает векторы', () => {
    const a = new Vector2(5, 7)
    const b = new Vector2(2, 3)
    const c = a.sub(b)
    expect(c.x).toBe(3)
    expect(c.y).toBe(4)
  })

  it('умножает на скаляр', () => {
    const v = new Vector2(2, 3)
    const c = v.scale(2)
    expect(c.x).toBe(4)
    expect(c.y).toBe(6)
  })

  it('вычисляет расстояние между точками', () => {
    const a = new Vector2(0, 0)
    const b = new Vector2(3, 4)
    expect(a.distanceTo(b)).toBe(5)
  })
})
