import { Vector2 } from '../geometry/Vector2';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export type ValidationIssueType =
  | 'device'
  | 'cable'
  | 'wall'
  | 'opening'
  | 'room'
  | 'plan';

export interface ValidationIssue {
  id: string;
  type: ValidationIssueType;
  severity: ValidationSeverity;
  message: string;
  objectId?: string;
  roomIndex?: number;
  relatedIds?: string[];
  /** Опциональная мировая позиция для навигации камеры. */
  position?: Vector2;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  errors: number;
  warnings: number;
  infos: number;
}

export function emptyValidationResult(): ValidationResult {
  return { issues: [], errors: 0, warnings: 0, infos: 0 };
}

export function addIssue(
  result: ValidationResult,
  issue: ValidationIssue,
): ValidationResult {
  result.issues.push(issue);
  if (issue.severity === 'error') result.errors++;
  else if (issue.severity === 'warning') result.warnings++;
  else result.infos++;
  return result;
}

let issueCounter = 0;

export function nextIssueId(): string {
  return `issue-${++issueCounter}`;
}
