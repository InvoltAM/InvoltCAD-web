import { Vector2 } from './Vector2';
import { Wall, wallDirection, wallLength, wallPolyline } from '../model/Wall';
import { Quadtree } from './Quadtree';
import { projectPointToSegment } from './Geometry';

const EPS = 0.01;
const MIN_ROOM_AREA = 50_000; // 0.05 м²

export interface Room {
  polygon: Vector2[];
  area: number; // мм² (полезная площадь с вычтенными вырезами)
  grossArea: number; // мм² (площадь без вычета вырезов)
  holes: Vector2[][]; // внутренние вырезы (колонны, ниши, дворики)
}

/**
 * Находит замкнутые комнаты в плане стен.
 *
 * Алгоритм:
 * 1. Строим планарный граф из осевых линий стен.
 * 2. Обходом по направлению находим все грани (циклы).
 * 3. Внешний контур — цикл с наибольшей площадью, содержащий остальные.
 * 4. Комнаты — циклы с противоположной ориентацией.
 * 5. Для каждой комнаты строим внутренний контур с учётом толщины стен.
 */
export function detectRooms(walls: Wall[]): Room[] {
  if (walls.length < 3) return [];

  // Дуговые стены аппроксимируем отрезками перед построением графа.
  const segments: Array<[Vector2, Vector2]> = [];
  for (const wall of walls) {
    const pts = wallPolyline(wall, 100);
    for (let i = 0; i < pts.length - 1; i++) {
      segments.push([pts[i].clone(), pts[i + 1].clone()]);
    }
  }

  const splitSegments = splitSegmentsAtIntersections(segments);
  const graph = buildGraph(splitSegments);
  const faces = findFaces(graph);

  if (faces.length < 2) return [];

  const faceData = faces.map(polygon => ({
    polygon,
    signedArea: polygonArea(polygon),
  }));

  // Внешний контур — обычно самый большой по модулю площади и содержит остальные
  const outerIndex = findOuterFace(faceData);
  const outerSign = Math.sign(faceData[outerIndex].signedArea);

  // Разделяем комнаты и дыры
  const roomFaces: Array<{ polygon: Vector2[]; signedArea: number }> = [];
  const holeFaces: Array<{ polygon: Vector2[]; signedArea: number }> = [];
  for (let i = 0; i < faceData.length; i++) {
    if (i === outerIndex) continue;
    const face = faceData[i];
    if (Math.sign(face.signedArea) === outerSign) {
      holeFaces.push(face);
    } else {
      roomFaces.push(face);
    }
  }

  // Исключаем "комнаты" внутри дыр (например, внутренняя полость колонны).
  // Проверяем по bbox: если bbox комнаты полностью внутри bbox дыры — это полость.
  const validRoomFaces = roomFaces.filter(roomFace => {
    const rMinX = Math.min(...roomFace.polygon.map(p => p.x));
    const rMinY = Math.min(...roomFace.polygon.map(p => p.y));
    const rMaxX = Math.max(...roomFace.polygon.map(p => p.x));
    const rMaxY = Math.max(...roomFace.polygon.map(p => p.y));
    return !holeFaces.some(holeFace => {
      const hMinX = Math.min(...holeFace.polygon.map(p => p.x));
      const hMinY = Math.min(...holeFace.polygon.map(p => p.y));
      const hMaxX = Math.max(...holeFace.polygon.map(p => p.x));
      const hMaxY = Math.max(...holeFace.polygon.map(p => p.y));
      return (
        rMinX >= hMinX - EPS &&
        rMinY >= hMinY - EPS &&
        rMaxX <= hMaxX + EPS &&
        rMaxY <= hMaxY + EPS
      );
    });
  });

  // Привязываем дыры к комнатам
  const holeAssignments = new Map<number, number[]>(); // roomIndex -> hole face indices
  for (let h = 0; h < holeFaces.length; h++) {
    const holePoly = holeFaces[h].polygon;
    const centroid = polygonCentroid(holePoly);
    for (let r = 0; r < validRoomFaces.length; r++) {
      if (pointInPolygon(centroid, validRoomFaces[r].polygon)) {
        if (!holeAssignments.has(r)) holeAssignments.set(r, []);
        holeAssignments.get(r)!.push(h);
        break;
      }
    }
  }

  const rooms: Room[] = [];
  for (let r = 0; r < validRoomFaces.length; r++) {
    const { polygon } = validRoomFaces[r];
    const offsetPoly = buildInnerOffset(polygon, walls);
    const grossArea = Math.abs(polygonArea(offsetPoly));
    if (grossArea < MIN_ROOM_AREA) continue;

    const holes: Vector2[][] = [];
    let holesArea = 0;
    const assignedHoleIndices = holeAssignments.get(r) ?? [];
    for (const h of assignedHoleIndices) {
      const holePoly = holeFaces[h].polygon;
      // Внешний offset для дыры: расширяем контур на половину толщины наружу,
      // чтобы вырез включал тело стен колонны/ниши.
      const offsetHole = buildInnerOffset(holePoly, walls, false);
      if (offsetHole.length >= 3) {
        // offsetHole сохраняет ориентацию исходной дыры (как внешний контур),
        // что подходит для Canvas compound path (вырез из комнаты).
        holes.push(offsetHole);
        holesArea += Math.abs(polygonArea(offsetHole));
      }
    }

    const area = Math.max(0, grossArea - holesArea);
    rooms.push({ polygon: offsetPoly, area, grossArea, holes });
  }

  return rooms;
}

function findOuterFace(faceData: Array<{ polygon: Vector2[]; signedArea: number }>): number {
  // Внешний контур — это цикл, внутри которого лежат все остальные циклы.
  let outerIdx = -1;
  let maxArea = 0;
  for (let i = 0; i < faceData.length; i++) {
    let containsAll = true;
    for (let j = 0; j < faceData.length; j++) {
      if (i === j) continue;
      for (const p of faceData[j].polygon) {
        if (!pointInPolygon(p, faceData[i].polygon)) {
          containsAll = false;
          break;
        }
      }
      if (!containsAll) break;
    }
    if (containsAll) {
      const a = Math.abs(faceData[i].signedArea);
      if (a > maxArea) {
        maxArea = a;
        outerIdx = i;
      }
    }
  }
  if (outerIdx !== -1) return outerIdx;

  // Fallback: самый большой по модулю площади
  let maxIdx = 0;
  maxArea = Math.abs(faceData[0].signedArea);
  for (let i = 1; i < faceData.length; i++) {
    const a = Math.abs(faceData[i].signedArea);
    if (a > maxArea) {
      maxArea = a;
      maxIdx = i;
    }
  }
  return maxIdx;
}

/**
 * Строит внутренний контур комнаты, смещая осевые линии стен
 * на половину толщины в сторону центра комнаты.
 *
 * Особая обработка Т-образных "шипов": если в грани висячее ребро
 * проходит вперёд и сразу назад (base -> tip -> base), попарное
 * пересечение его смещённых рёбер дало бы параллельные прямые и
 * потерю вырезки. Для таких пар вставляем "квадратный колпачок".
 */
function buildInnerOffset(polygon: Vector2[], walls: Wall[], inward = true): Vector2[] {
  // Убираем замыкающую дублирующую вершину, если есть
  if (polygon.length > 1 && polygon[0].equals(polygon[polygon.length - 1])) {
    polygon = polygon.slice(0, -1);
  }
  const n = polygon.length;
  if (n < 3) return polygon;

  const sign = polygonArea(polygon) >= 0 ? 1 : -1;

  const offsetEdges: Array<[Vector2, Vector2]> = [];
  const normals: Vector2[] = [];
  const halfThicknesses: number[] = [];

  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    const dir = b.sub(a);
    const len = dir.length();
    if (len === 0) {
      offsetEdges.push([a.clone(), a.clone()]);
      normals.push(new Vector2(0, 0));
      halfThicknesses.push(0);
      continue;
    }

    // Находим толщину стены, соответствующей этому ребру
    const thickness = findMatchingWallThickness(a, b, walls);
    const h = thickness / 2;

    // Внутренняя нормаль. Для положительной площади perpendicular влево
    // от направления движения — внутрь комнаты. Для отрицательной — наоборот.
    const nVec = dir.perpendicular().normalized().scale(inward ? sign : -sign);
    offsetEdges.push([a.add(nVec.scale(h)), b.add(nVec.scale(h))]);
    normals.push(nVec);
    halfThicknesses.push(h);
  }

  // Определяем "шипы": ребро i идёт base -> tip, а ребро i+1 — tip -> base.
  const isSpike: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const tip = polygon[(i + 1) % n];
    const c = polygon[(i + 2) % n];
    isSpike[i] = a.distanceTo(c) < EPS && tip.distanceTo(a) > EPS;
  }

  const result: Vector2[] = [];
  let i = 0;
  while (i < n) {
    if (isSpike[i]) {
      // Вставляем два торцевых угла вырезки на расстоянии h от конца шипа.
      const tip = polygon[(i + 1) % n];
      const h = halfThicknesses[i];
      const nVec = normals[i];
      const p1 = tip.add(nVec.scale(h));
      const p2 = tip.sub(nVec.scale(h));
      result.push(p1, p2);

      // Левый (второй) угол у основания шипа: смещение обратного ребра
      // пересекается со смещением следующего за шипом ребра.
      const eRev = offsetEdges[(i + 1) % n];
      const eNext = offsetEdges[(i + 2) % n];
      const leftBase = lineIntersection(eRev[0], eRev[1], eNext[0], eNext[1]);
      if (leftBase) {
        result.push(leftBase);
      }

      i += 2;
    } else {
      const e1 = offsetEdges[i];
      const e2 = offsetEdges[(i + 1) % n];
      const inter = lineIntersection(e1[0], e1[1], e2[0], e2[1]);
      if (inter) {
        result.push(inter);
      }
      i += 1;
    }
  }

  // Удаляем дублирующиеся и близкие вершины
  const cleaned: Vector2[] = [];
  for (const p of result) {
    if (cleaned.length === 0 || p.distanceTo(cleaned[cleaned.length - 1]) > EPS) {
      cleaned.push(p);
    }
  }
  if (cleaned.length > 1 && cleaned[0].distanceTo(cleaned[cleaned.length - 1]) < EPS) {
    cleaned.pop();
  }

  return cleaned.length >= 3 ? cleaned : polygon;
}

function findMatchingWallThickness(a: Vector2, b: Vector2, walls: Wall[]): number {
  // Сначала пытаемся сопоставить ребро по проекции его точек на стену.
  // Это нужно для корректной работы с Т-стыками, где стена расколота
  // на под-отрезки, концы которых не совпадают с концами исходной стены.
  const mid = a.add(b).scale(0.5);
  let best = 200;
  let bestScore = Infinity;

  for (const wall of walls) {
    const pa = projectPointToSegment(a, wall.a, wall.b);
    const pb = projectPointToSegment(b, wall.a, wall.b);
    const pm = projectPointToSegment(mid, wall.a, wall.b);

    const onSegment =
      pa.t >= -0.01 && pa.t <= 1.01 &&
      pb.t >= -0.01 && pb.t <= 1.01 &&
      pm.t >= -0.01 && pm.t <= 1.01;

    if (onSegment) {
      const score = pa.dist + pb.dist + pm.dist;
      if (score < bestScore) {
        bestScore = score;
        best = wall.thickness;
      }
    }
  }

  if (bestScore !== Infinity && bestScore < 10) {
    return best;
  }

  // Fallback на сопоставление по концам стены.
  let bestDist = Infinity;
  for (const wall of walls) {
    const d1 = a.distanceTo(wall.a) + b.distanceTo(wall.b);
    const d2 = a.distanceTo(wall.b) + b.distanceTo(wall.a);
    const d = Math.min(d1, d2);
    if (d < bestDist && d < 10) {
      bestDist = d;
      best = wall.thickness;
    }
  }
  return best;
}

/** Находит пары сегментов, чьи ограничивающие прямоугольники пересекаются (кандидаты на пересечение). */
function findCandidatePairs(segments: Array<[Vector2, Vector2]>): Array<[number, number]> {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [a, b] of segments) {
    minX = Math.min(minX, a.x, b.x);
    minY = Math.min(minY, a.y, b.y);
    maxX = Math.max(maxX, a.x, b.x);
    maxY = Math.max(maxY, a.y, b.y);
  }
  if (!isFinite(minX)) return [];

  const padding = Math.max(maxX - minX, maxY - minY) * 0.1 + 100;
  const tree = new Quadtree<number>({
    min: new Vector2(minX - padding, minY - padding),
    max: new Vector2(maxX + padding, maxY + padding),
  });

  for (let i = 0; i < segments.length; i++) {
    const [a, b] = segments[i];
    tree.insert(i, {
      min: new Vector2(Math.min(a.x, b.x), Math.min(a.y, b.y)),
      max: new Vector2(Math.max(a.x, b.x), Math.max(a.y, b.y)),
    });
  }

  const pairSet = new Set<string>();
  for (let i = 0; i < segments.length; i++) {
    const [a, b] = segments[i];
    const candidates = tree.query({
      min: new Vector2(Math.min(a.x, b.x), Math.min(a.y, b.y)),
      max: new Vector2(Math.max(a.x, b.x), Math.max(a.y, b.y)),
    });
    for (const j of candidates) {
      if (j > i) pairSet.add(`${i},${j}`);
    }
  }

  const pairs: Array<[number, number]> = [];
  for (const key of pairSet) {
    const [i, j] = key.split(',').map(Number);
    pairs.push([i, j]);
  }
  return pairs;
}

export function splitSegmentsAtIntersections(segments: Array<[Vector2, Vector2]>): Array<[Vector2, Vector2]> {
  const pointsOnSegment: Array<Vector2[]> = segments.map(([a, b]) => [a.clone(), b.clone()]);

  // Для большого числа сегментов используем quadtree, чтобы не проверять все пары
  const pairs = findCandidatePairs(segments);
  for (const [i, j] of pairs) {
    const inter = segmentIntersection(segments[i][0], segments[i][1], segments[j][0], segments[j][1]);
    if (inter) {
      addPointIfOnSegment(pointsOnSegment[i], inter, segments[i][0], segments[i][1]);
      addPointIfOnSegment(pointsOnSegment[j], inter, segments[j][0], segments[j][1]);
    }
  }

  const result: Array<[Vector2, Vector2]> = [];
  for (let i = 0; i < segments.length; i++) {
    const [a, b] = segments[i];
    const pts = pointsOnSegment[i];
    const dir = b.sub(a);
    const lenSq = dir.dot(dir);
    pts.sort((p1, p2) => {
      const t1 = lenSq > 0 ? p1.sub(a).dot(dir) / lenSq : 0;
      const t2 = lenSq > 0 ? p2.sub(a).dot(dir) / lenSq : 0;
      return t1 - t2;
    });
    for (let k = 0; k < pts.length - 1; k++) {
      result.push([pts[k].clone(), pts[k + 1].clone()]);
    }
  }
  return result;
}

function segmentIntersection(a1: Vector2, a2: Vector2, b1: Vector2, b2: Vector2): Vector2 | null {
  const r = a2.sub(a1);
  const s = b2.sub(b1);
  const rxs = r.cross(s);
  const qp = b1.sub(a1);
  if (Math.abs(rxs) < EPS) return null;
  const t = qp.cross(s) / rxs;
  const u = qp.cross(r) / rxs;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return a1.add(r.scale(t));
}

function addPointIfOnSegment(list: Vector2[], p: Vector2, a: Vector2, b: Vector2): void {
  const dir = b.sub(a);
  const lenSq = dir.dot(dir);
  if (lenSq === 0) {
    if (!list.some(pt => pt.distanceTo(p) < EPS)) list.push(p.clone());
    return;
  }
  const t = p.sub(a).dot(dir) / lenSq;
  if (t < -EPS || t > 1 + EPS) return;
  const proj = a.add(dir.scale(Math.max(0, Math.min(1, t))));
  if (!list.some(pt => pt.distanceTo(proj) < EPS)) {
    list.push(proj.clone());
  }
}

function lineIntersection(a1: Vector2, a2: Vector2, b1: Vector2, b2: Vector2): Vector2 | null {
  const r = a2.sub(a1);
  const s = b2.sub(b1);
  const rxs = r.cross(s);
  if (Math.abs(rxs) < EPS) return null;
  const t = b1.sub(a1).cross(s) / rxs;
  return a1.add(r.scale(t));
}

function polygonCentroid(poly: Vector2[]): Vector2 {
  let cx = 0;
  let cy = 0;
  for (const p of poly) {
    cx += p.x;
    cy += p.y;
  }
  return new Vector2(cx / poly.length, cy / poly.length);
}

function pointInPolygon(p: Vector2, poly: Vector2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < (xj - xi) * (p.y - yi) / (yj - yi + EPS) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface Graph {
  vertices: Vector2[];
  neighbors: number[][];
}

export function buildGraph(segments: Array<[Vector2, Vector2]>): Graph {
  const vertices: Vector2[] = [];
  const indexMap = new Map<string, number>();

  function getIndex(p: Vector2): number {
    const key = `${Math.round(p.x / EPS)},${Math.round(p.y / EPS)}`;
    const existing = indexMap.get(key);
    if (existing !== undefined) return existing;
    const idx = vertices.length;
    vertices.push(p.clone());
    indexMap.set(key, idx);
    return idx;
  }

  const neighbors: number[][] = [];
  for (const [a, b] of segments) {
    const i = getIndex(a);
    const j = getIndex(b);
    if (i === j) continue;
    if (!neighbors[i]) neighbors[i] = [];
    if (!neighbors[j]) neighbors[j] = [];
    if (!neighbors[i].includes(j)) neighbors[i].push(j);
    if (!neighbors[j].includes(i)) neighbors[j].push(i);
  }

  return { vertices, neighbors };
}

export function findFaces(graph: Graph): Vector2[][] {
  const { vertices, neighbors } = graph;
  const n = vertices.length;
  if (n === 0) return [];

  const sortedNeighbors: number[][] = [];
  for (let i = 0; i < n; i++) {
    const v = vertices[i];
    const ns = (neighbors[i] || []).slice();
    ns.sort((a, b) => {
      const angA = Math.atan2(vertices[a].y - v.y, vertices[a].x - v.x);
      const angB = Math.atan2(vertices[b].y - v.y, vertices[b].x - v.x);
      return angA - angB;
    });
    sortedNeighbors[i] = ns;
  }

  const visited = new Set<string>();
  const faces: Vector2[][] = [];

  for (let u = 0; u < n; u++) {
    for (const v of sortedNeighbors[u]) {
      const key = `${u},${v}`;
      if (visited.has(key)) continue;

      const face: number[] = [];
      let currU = u;
      let currV = v;
      let safety = 0;
      while (safety++ < 10000) {
        const k = `${currU},${currV}`;
        if (visited.has(k)) break;
        visited.add(k);
        face.push(currU);

        // Стандартный обход граней: в вершине currV ищем ребро currV->currU
        // в отсортированном списке и берём следующее по часовой стрелке.
        const ns = sortedNeighbors[currV];
        const idx = ns.indexOf(currU);
        if (idx === -1) break;
        const bestW = ns[(idx + 1) % ns.length];
        if (bestW === currV) break;
        currU = currV;
        currV = bestW;
        if (currU === u && currV === v) {
          face.push(currU);
          break;
        }
      }

      if (face.length >= 3) {
        faces.push(face.map(idx => vertices[idx]));
      }
    }
  }

  return faces;
}

function polygonArea(poly: Vector2[]): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    area += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
  }
  return area / 2;
}
