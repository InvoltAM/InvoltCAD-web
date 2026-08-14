import { describe, it, expect } from 'vitest'
import { Plan } from '../model/Plan'
import { Vector2 } from '../geometry/Vector2'
import { Camera } from '../engine/Camera'
import { ThemeManager } from '../editor/ThemeManager'
import { TableRenderer } from './TableRenderer'

describe('TableRenderer', () => {
  function createRenderer(printScale = 100) {
    const plan = new Plan()
    plan.activeSheet.printScale = printScale
    const table = plan.addSheetTable('spec', new Vector2(1000, 2000))
    const camera = new Camera(1000, 800)
    camera.scale = 1
    const theme = new ThemeManager()
    return { plan, table, renderer: new TableRenderer(plan, camera, theme) }
  }

  it('computes bounds in world coordinates proportional to printScale', () => {
    const { table, renderer } = createRenderer(100)
    const bounds = renderer.getTableBounds(table)
    expect(bounds.min.x).toBe(1000)
    expect(bounds.min.y).toBe(2000)
    // Ширина таблицы 120 мм * printScale
    expect(bounds.max.x - bounds.min.x).toBe(120 * 100)
  })

  it('doubles width when printScale doubles', () => {
    const { table: t1, renderer: r1 } = createRenderer(100)
    const { table: t2, renderer: r2 } = createRenderer(200)
    const b1 = r1.getTableBounds(t1)
    const b2 = r2.getTableBounds(t2)
    expect(b2.max.x - b2.min.x).toBe((b1.max.x - b1.min.x) * 2)
  })

  it('doubles width and height when table scale doubles', () => {
    const { table, renderer } = createRenderer(100)
    table.scale = 2
    const bounds = renderer.getTableBounds(table)
    expect(bounds.max.x - bounds.min.x).toBe(120 * 100 * 2)
  })

  it('renders in world coordinates without resetting transform', () => {
    const { table, renderer } = createRenderer(100)
    const calls: Array<{ method: string; args: unknown[] }> = []
    const ctx = {
      save: () => calls.push({ method: 'save', args: [] }),
      restore: () => calls.push({ method: 'restore', args: [] }),
      fillRect: (...args: number[]) => calls.push({ method: 'fillRect', args }),
      strokeRect: (...args: number[]) => calls.push({ method: 'strokeRect', args }),
      setTransform: (...args: number[]) => calls.push({ method: 'setTransform', args }),
      fillText: (...args: unknown[]) => calls.push({ method: 'fillText', args }),
      measureText: (text: string) => ({ width: text.length * 10 }),
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      setLineDash: () => {},
    } as unknown as CanvasRenderingContext2D

    renderer.render(ctx)

    expect(calls.some((c) => c.method === 'setTransform')).toBe(false)
    const firstFillRect = calls.find((c) => c.method === 'fillRect')
    expect(firstFillRect?.args[0]).toBe(table.position.x)
    expect(firstFillRect?.args[1]).toBe(table.position.y)
    expect(firstFillRect?.args[2]).toBe(120 * 100)
  })

  it('screen bounds scale with camera zoom', () => {
    const { table, renderer } = createRenderer(100)
    const screenBounds = renderer.getTableScreenBounds(table)
    // camera.scale=1, viewport/2=500, table at x=1000 -> (1000-0)*1+500=1500
    expect(screenBounds.min.x).toBe(1500)
    // width 120*100=12000 px on screen at scale=1
    expect(screenBounds.max.x - screenBounds.min.x).toBe(12000)
  })
})
