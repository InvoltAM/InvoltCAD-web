import { Plan } from '../model/Plan'
import { Vector2 } from '../geometry/Vector2'

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  category: 'apartment' | 'house' | 'office' | 'other'
  isBuiltin: boolean
  data: unknown
}

/**
 * Генерация шаблона однокомнатной квартиры.
 */
export function generateOneRoomApartment(): Plan {
  const plan = new Plan()

  // Комната 4x3 м
  const w1 = plan.addWall(new Vector2(0, 0), new Vector2(4000, 0), 200)
  const w2 = plan.addWall(new Vector2(4000, 0), new Vector2(4000, 3000), 200)
  const w3 = plan.addWall(new Vector2(4000, 3000), new Vector2(0, 3000), 200)
  const w4 = plan.addWall(new Vector2(0, 3000), new Vector2(0, 0), 200)

  // Дверь
  w1.openings.push({
    id: crypto.randomUUID(),
    type: 'door',
    wallId: w1.id,
    t: 0.5,
    width: 900,
    swingSide: 'left',
    openDir: 1,
  })

  // Окно
  w3.openings.push({
    id: crypto.randomUUID(),
    type: 'window',
    wallId: w3.id,
    t: 0.5,
    width: 1500,
  })

  // Розетки
  plan.addDevice(w1.id, 'socket', 0.2, 300, 1)
  plan.addDevice(w2.id, 'socket', 0.3, 300, 1)
  plan.addDevice(w3.id, 'socket', 0.3, 300, 1)
  plan.addDevice(w4.id, 'socket', 0.3, 300, 1)

  // Светильник
  plan.addDevice(w1.id, 'light', 0.5, 2500, 1)

  // Выключатель
  plan.addDevice(w1.id, 'switch', 0.8, 900, 1)

  // Кабели
  plan.addCable('socket', 'light', 'power', 2.5)
  plan.addCable('switch', 'light', 'power', 1.5)

  return plan
}

/**
 * Генерация шаблона двухкомнатной квартиры.
 */
export function generateTwoRoomApartment(): Plan {
  const plan = new Plan()

  // Комната 1: 4x3 м
  plan.addWall(new Vector2(0, 0), new Vector2(4000, 0), 200)
  plan.addWall(new Vector2(4000, 0), new Vector2(4000, 3000), 200)
  plan.addWall(new Vector2(4000, 3000), new Vector2(0, 3000), 200)
  plan.addWall(new Vector2(0, 3000), new Vector2(0, 0), 200)

  // Комната 2: 3x3 м
  plan.addWall(new Vector2(4000, 0), new Vector2(7000, 0), 200)
  plan.addWall(new Vector2(7000, 0), new Vector2(7000, 3000), 200)
  plan.addWall(new Vector2(7000, 3000), new Vector2(4000, 3000), 200)

  // Кухня: 3x2.5 м
  plan.addWall(new Vector2(0, 3000), new Vector2(3000, 3000), 200)
  plan.addWall(new Vector2(3000, 3000), new Vector2(3000, 5500), 200)
  plan.addWall(new Vector2(3000, 5500), new Vector2(0, 5500), 200)

  return plan
}

/**
 * Системные шаблоны проектов.
 */
export const BUILTIN_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'one-room-apartment',
    name: '1-комнатная квартира',
    description: 'Стандартная однокомнатная квартира 4x3 м',
    category: 'apartment',
    isBuiltin: true,
    data: null, // Генерируется через generateOneRoomApartment
  },
  {
    id: 'two-room-apartment',
    name: '2-комнатная квартира',
    description: 'Двухкомнатная квартира с кухней',
    category: 'apartment',
    isBuiltin: true,
    data: null, // Генерируется через generateTwoRoomApartment
  },
]

/**
 * Применение шаблона проекта.
 */
export function applyTemplate(templateId: string): Plan | null {
  switch (templateId) {
    case 'one-room-apartment':
      return generateOneRoomApartment()
    case 'two-room-apartment':
      return generateTwoRoomApartment()
    default:
      return null
  }
}
