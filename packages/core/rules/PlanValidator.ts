import { Plan } from '../model/Plan';
import {
  ValidationResult,
  emptyValidationResult,
  addIssue,
} from './ValidationTypes';
import { validateDevices } from './DeviceRules';
import { validateCables } from './CableRules';
import { validatePlanGeometry } from './PlanRules';

/**
 * Запускает все правила валидации и возвращает объединённый результат.
 */
export function validatePlan(plan: Plan): ValidationResult {
  const result = emptyValidationResult();

  const rooms = plan.getRooms();

  const deviceResult = validateDevices(plan, rooms);
  for (const issue of deviceResult.issues) addIssue(result, issue);

  const cableResult = validateCables(plan);
  for (const issue of cableResult.issues) addIssue(result, issue);

  const planResult = validatePlanGeometry(plan);
  for (const issue of planResult.issues) addIssue(result, issue);

  return result;
}

export { validateDevices, validateCables, validatePlanGeometry };
export type { ValidationResult };
