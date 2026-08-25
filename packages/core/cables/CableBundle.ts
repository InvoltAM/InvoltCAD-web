import { Vector2 } from '../geometry/Vector2';
import { Cable, CableBundleMode } from '../model/Cable';
import { Plan } from '../model/Plan';

export interface BundleTrunk {
  groupId: string;
  trunkSegments: Array<{ start: Vector2; end: Vector2 }>;
  branches: Array<{
    cableId: string;
    branchPoint: Vector2;
    branchSegments: Array<{ start: Vector2; end: Vector2 }>;
  }>;
}

/**
 * Смещает маршрут на заданный вектор.
 * Используется для параллельной прокладки нескольких кабелей.
 */
export function offsetRoute(route: Vector2[], offset: Vector2): Vector2[] {
  return route.map((p) => p.add(offset));
}

/**
 * Рассчитывает поперечные смещения для N параллельных кабелей.
 * Центрирует пучок относительно базовой линии.
 */
export function calculateParallelOffsets(count: number, spacing: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const total = (count - 1) * spacing;
  const start = -total / 2;
  const offsets: number[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push(start + i * spacing);
  }
  return offsets;
}

/**
 * Преобразует набор кабелей в параллельную прокладку вдоль общего базового маршрута.
 * Каждый кабель получает смещённую копию маршрута и режим bundleMode='parallel'.
 */
export function createParallelBundle(
  cables: Cable[],
  baseRoute: Vector2[],
  spacing = 50, // мм между центрами
): void {
  const offsets = calculateParallelOffsets(cables.length, spacing);
  const groupId = crypto.randomUUID();
  const perpendicular = computeRoutePerpendicular(baseRoute);
  for (let i = 0; i < cables.length; i++) {
    const cable = cables[i];
    cable.route = offsetRoute(baseRoute, perpendicular.scale(offsets[i]));
    cable.bundleMode = 'parallel';
    cable.bundleGroup = groupId;
  }
}

/**
 * Строит пучок (trunk): общий trunk-участок + ответвления к каждому кабелю.
 * trunkRoute — общий маршрут до точки разветвления.
 * branches — маршруты от trunkPoint до конечных точек кабелей.
 */
export function createTrunkGroup(
  cables: Cable[],
  trunkRoute: Vector2[],
  trunkPoint: Vector2,
): BundleTrunk {
  const groupId = crypto.randomUUID();
  const branches: BundleTrunk['branches'] = [];

  for (const cable of cables) {
    const end = cable.route[cable.route.length - 1];
    const branchSegments = trunkSegmentsFromRoute([trunkPoint, end]);
    cable.bundleMode = 'trunk';
    cable.bundleGroup = groupId;
    cable.trunkPoint = { x: trunkPoint.x, y: trunkPoint.y };
    branches.push({
      cableId: cable.id,
      branchPoint: trunkPoint.clone(),
      branchSegments,
    });
  }

  return {
    groupId,
    trunkSegments: trunkSegmentsFromRoute(trunkRoute),
    branches,
  };
}

/**
 * Пересчитывает маршруты пучка при изменении trunk-точки или конечных точек.
 */
export function recalcTrunkBranches(plan: Plan, groupId: string): void {
  const cables = plan.cables.filter((c) => c.bundleGroup === groupId && c.bundleMode === 'trunk');
  if (cables.length === 0) return;

  const trunkPoint = cables[0].trunkPoint ? new Vector2(cables[0].trunkPoint.x, cables[0].trunkPoint.y) : null;
  if (!trunkPoint) return;

  for (const cable of cables) {
    const end = cable.route[cable.route.length - 1];
    cable.route = [trunkPoint.clone(), end.clone()];
  }
}

function trunkSegmentsFromRoute(route: Vector2[]): Array<{ start: Vector2; end: Vector2 }> {
  const segments: Array<{ start: Vector2; end: Vector2 }> = [];
  for (let i = 1; i < route.length; i++) {
    segments.push({ start: route[i - 1].clone(), end: route[i].clone() });
  }
  return segments;
}

/**
 * Возвращает усреднённую нормаль к маршруту для поперечного смещения.
 * Для простоты используем перпендикуляр к первому сегменту.
 */
function computeRoutePerpendicular(route: Vector2[]): Vector2 {
  if (route.length < 2) return new Vector2(0, 1);
  const d = route[1].sub(route[0]);
  if (d.length() < 1e-9) return new Vector2(0, 1);
  return d.perpendicular().normalized();
}
