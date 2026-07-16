import { Plan } from '../model/Plan';
import { Cable, CableType } from '../model/Cable';
import { Vector2 } from '../geometry/Vector2';
import {
  ValidationIssue,
  ValidationResult,
  addIssue,
  nextIssueId,
} from './ValidationTypes';

const MIN_CABLE_CROSS_SECTION: Record<CableType, number> = {
  power: 2.5,
  lighting: 1.5,
  'low-current': 0.5,
};

function cableMidpoint(cable: Cable): Vector2 {
  if (cable.route.length === 0) return new Vector2(0, 0);
  let x = 0;
  let y = 0;
  for (const p of cable.route) {
    x += p.x;
    y += p.y;
  }
  return new Vector2(x / cable.route.length, y / cable.route.length);
}

/**
 * Проверяет кабели:
 * - Минимальное сечение для типа кабеля.
 * - Длина с запасом (уже вычисляется в Plan).
 */
export function validateCables(plan: Plan): ValidationResult {
  const result: ValidationResult = { issues: [], errors: 0, warnings: 0, infos: 0 };

  for (const cable of plan.cables) {
    const minSection = MIN_CABLE_CROSS_SECTION[cable.type];
    if (cable.crossSection < minSection) {
      addIssue(result, {
        id: nextIssueId(),
        type: 'cable',
        severity: 'warning',
        message: `Кабель ${cable.type === 'power' ? 'силовой' : cable.type === 'lighting' ? 'освещения' : 'слаботочный'} сечением ${cable.crossSection} мм²: рекомендуется минимум ${minSection} мм²`,
        objectId: cable.id,
        position: cableMidpoint(cable),
      });
    }

    if (cable.length <= 0) {
      addIssue(result, {
        id: nextIssueId(),
        type: 'cable',
        severity: 'error',
        message: 'Кабель имеет нулевую или отрицательную длину',
        objectId: cable.id,
        position: cableMidpoint(cable),
      });
    }
  }

  return result;
}

export { cableMidpoint };
