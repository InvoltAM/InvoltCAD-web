import { Plan } from '../model/Plan';
import { Wall } from '../model/Wall';
import { Vector2 } from '../geometry/Vector2';
import { projectPointToSegment } from '../geometry/Geometry';
import {
  ValidationResult,
  addIssue,
  nextIssueId,
} from './ValidationTypes';

const MIN_WALL_LENGTH = 100; // мм
const MIN_DOOR_WIDTH = 600; // мм
const MIN_WINDOW_WIDTH = 400; // мм

/** Проверяет, лежат ли две прямые стены на одной прямой (коллинеарны). */
function areWallsCollinear(w1: Wall, w2: Wall): boolean {
  const d1 = w1.b.sub(w1.a);
  const d2 = w2.b.sub(w2.a);
  const cross = Math.abs(d1.x * d2.y - d1.y * d2.x);
  const lenProduct = d1.length() * d2.length();
  if (lenProduct < 1e-9) return false; // одна из стен вырождена
  return cross < 1e-6 * lenProduct;
}

/** Проверяет, перекрываются ли две коллинеарные стены (более чем в одной точке). */
function collinearWallsOverlap(w1: Wall, w2: Wall): boolean {
  const d1 = w1.b.sub(w1.a);
  const len1 = d1.length();
  if (len1 < 1e-9) return false;

  // Проекции концов w2 на ось w1
  const tA = projectPointToSegment(w2.a, w1.a, w1.b).t;
  const tB = projectPointToSegment(w2.b, w1.a, w1.b).t;
  const minT = Math.min(tA, tB);
  const maxT = Math.max(tA, tB);

  // Есть перекрытие, если интервалы t пересекаются на положительной длине
  const overlapStart = Math.max(minT, 0);
  const overlapEnd = Math.min(maxT, 1);
  return overlapEnd - overlapStart > 1e-6;
}

/**
 * Проверяет геометрию плана:
 * - Замкнутость контуров.
 * - Коллинеарные перекрытия стен.
 * - Минимальные ширины проёмов.
 * - Слишком короткие стены.
 */
export function validatePlanGeometry(plan: Plan): ValidationResult {
  const result: ValidationResult = { issues: [], errors: 0, warnings: 0, infos: 0 };

  // Замкнутость контуров
  const rooms = plan.getRooms();
  if (plan.walls.length > 0 && rooms.length === 0) {
    addIssue(result, {
      id: nextIssueId(),
      type: 'plan',
      severity: 'error',
      message: 'План не содержит замкнутых комнат. Проверьте, что стены образуют замкнутые контуры.',
    });
  }

  // Слишком короткие стены
  for (const wall of plan.walls) {
    const len = wall.a.distanceTo(wall.b);
    if (len < MIN_WALL_LENGTH) {
      addIssue(result, {
        id: nextIssueId(),
        type: 'wall',
        severity: 'warning',
        message: `Стена слишком короткая (${Math.round(len)} мм)`,
        objectId: wall.id,
        position: wall.a.add(wall.b).scale(0.5),
      });
    }
  }

  // Коллинеарные перекрытия стен
  for (let i = 0; i < plan.walls.length; i++) {
    for (let j = i + 1; j < plan.walls.length; j++) {
      const w1 = plan.walls[i];
      const w2 = plan.walls[j];
      if (areWallsCollinear(w1, w2) && collinearWallsOverlap(w1, w2)) {
        addIssue(result, {
          id: nextIssueId(),
          type: 'wall',
          severity: 'warning',
          message: 'Стены накладываются друг на друга (коллинеарное пересечение)',
          objectId: w1.id,
          relatedIds: [w2.id],
          position: w1.a.add(w1.b).scale(0.5),
        });
      }
    }
  }

  // Минимальные ширины проёмов
  for (const wall of plan.walls) {
    for (const opening of wall.openings) {
      if (opening.type === 'door' && opening.width < MIN_DOOR_WIDTH) {
        addIssue(result, {
          id: nextIssueId(),
          type: 'opening',
          severity: 'warning',
          message: `Дверь слишком узкая (${opening.width} мм, рекомендуется ≥ ${MIN_DOOR_WIDTH} мм)`,
          objectId: opening.id,
          relatedIds: [wall.id],
          position: wallCenterAtT(wall, opening.t),
        });
      }
      if (opening.type === 'window' && opening.width < MIN_WINDOW_WIDTH) {
        addIssue(result, {
          id: nextIssueId(),
          type: 'opening',
          severity: 'warning',
          message: `Окно слишком узкое (${opening.width} мм, рекомендуется ≥ ${MIN_WINDOW_WIDTH} мм)`,
          objectId: opening.id,
          relatedIds: [wall.id],
          position: wallCenterAtT(wall, opening.t),
        });
      }
    }
  }

  return result;
}

function wallCenterAtT(wall: Wall, t: number): Vector2 {
  const dir = wall.b.sub(wall.a);
  const len = dir.length();
  return wall.a.add(dir.scale(len > 0 ? t : 0));
}

export { wallCenterAtT };
