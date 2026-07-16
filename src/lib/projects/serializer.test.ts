import { describe, it, expect } from 'vitest'
import { serializePlan, deserializePlan } from '@/lib/projects/serializer'
import { Plan } from '@core/model/Plan'
import { Wall } from '@core/model/Wall'
import { Opening } from '@core/model/Opening'
import { Device } from '@core/model/Device'
import { Cable } from '@core/model/Cable'
import { Dimension } from '@core/model/Dimension'
import { Vector2 } from '@core/geometry/Vector2'

describe('Сериализатор Plan', () => {
  it('сериализует и десериализует пустой план', () => {
    const plan = new Plan()
    const serialized = serializePlan(plan)
    expect(serialized.walls).toHaveLength(0)
    expect(serialized.devices).toHaveLength(0)

    const restored = deserializePlan(serialized)
    expect(restored.walls).toHaveLength(0)
    expect(restored.devices).toHaveLength(0)
  })

  it('сериализует и десериализует стену', () => {
    const plan = new Plan()
    const wall: Wall = {
      id: 'wall-1',
      a: new Vector2(0, 0),
      b: new Vector2(1000, 0),
      thickness: 200,
      openings: [],
    }
    plan.walls.push(wall)

    const serialized = serializePlan(plan)
    expect(serialized.walls).toHaveLength(1)
    expect(serialized.walls[0].id).toBe('wall-1')
    expect(serialized.walls[0].startX).toBe(0)
    expect(serialized.walls[0].endX).toBe(1000)

    const restored = deserializePlan(serialized)
    expect(restored.walls).toHaveLength(1)
    expect(restored.walls[0].id).toBe('wall-1')
    expect(restored.walls[0].a.x).toBe(0)
    expect(restored.walls[0].b.x).toBe(1000)
  })

  it('сериализует и десериализует проём', () => {
    const plan = new Plan()
    const wall: Wall = {
      id: 'wall-1',
      a: new Vector2(0, 0),
      b: new Vector2(1000, 0),
      thickness: 200,
      openings: [],
    }
    const opening: Opening = {
      id: 'opening-1',
      type: 'door',
      wallId: 'wall-1',
      t: 0.5,
      width: 900,
      swingSide: 'left',
      openDir: 1,
    }
    wall.openings.push(opening)
    plan.walls.push(wall)

    const serialized = serializePlan(plan)
    expect(serialized.openings).toHaveLength(1)
    expect(serialized.openings[0].id).toBe('opening-1')

    const restored = deserializePlan(serialized)
    expect(restored.walls[0].openings).toHaveLength(1)
    expect(restored.walls[0].openings[0].id).toBe('opening-1')
  })

  it('сериализует и десериализует устройство', () => {
    const plan = new Plan()
    const device: Device = {
      id: 'device-1',
      type: 'socket',
      name: 'Розетка',
      wallId: 'wall-1',
      t: 0.3,
      side: 1,
      offset: 0,
      rotation: 0,
      height: 300,
    }
    plan.devices.push(device)

    const serialized = serializePlan(plan)
    expect(serialized.devices).toHaveLength(1)
    expect(serialized.devices[0].id).toBe('device-1')

    const restored = deserializePlan(serialized)
    expect(restored.devices).toHaveLength(1)
    expect(restored.devices[0].id).toBe('device-1')
  })

  it('сериализует и десериализует кабель', () => {
    const plan = new Plan()
    const cable: Cable = {
      id: 'cable-1',
      fromDeviceId: 'device-1',
      toDeviceId: 'device-2',
      type: 'power',
      crossSection: 2.5,
      length: 5000,
      route: [new Vector2(0, 0), new Vector2(5000, 0)],
    }
    plan.cables.push(cable)

    const serialized = serializePlan(plan)
    expect(serialized.cables).toHaveLength(1)
    expect(serialized.cables[0].id).toBe('cable-1')

    const restored = deserializePlan(serialized)
    expect(restored.cables).toHaveLength(1)
    expect(restored.cables[0].id).toBe('cable-1')
  })

  it('сериализует и десериализует размер', () => {
    const plan = new Plan()
    const dimension: Dimension = {
      id: 'dim-1',
      a: new Vector2(0, 0),
      b: new Vector2(1000, 0),
      length: 1000,
      text: '1 м',
    }
    plan.dimensions.push(dimension)

    const serialized = serializePlan(plan)
    expect(serialized.dimensions).toHaveLength(1)
    expect(serialized.dimensions[0].id).toBe('dim-1')

    const restored = deserializePlan(serialized)
    expect(restored.dimensions).toHaveLength(1)
    expect(restored.dimensions[0].id).toBe('dim-1')
  })
})
