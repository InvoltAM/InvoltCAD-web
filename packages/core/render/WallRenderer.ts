import { Camera } from '../engine/Camera';
import { Vector2 } from '../geometry/Vector2';
import { Plan } from '../model/Plan';
import { Wall, wallDirection, wallHasArc, wallPolyline } from '../model/Wall';
import {
  segmentIntersectsRect,
  projectPointToSegment,
  segmentsIntersection,
  lineIntersection,
  convexHull,
} from '../geometry/Geometry';
import { EditorState, WallJoinStyle } from '../editor/EditorState';
import { ThemeManager } from '../editor/ThemeManager';

const SHADOW_OFFSET = new Vector2(4, 4);

interface Joint {
  point: Vector2;
  radius: number;
  walls: Wall[];
}

/**
 * Отрисовка стен как заполненных quad'ов + настраиваемых соединений.
 * Поддерживаемые стили соединений: square, round, miter, bevel, none.
 */
export class WallRenderer {
  private selectedWallId: string | null = null;

  constructor(
    private plan: Plan,
    private camera: Camera,
    private editorState: EditorState,
    private themeManager: ThemeManager,
  ) {}

  setSelectedWall(id: string | null): void {
    this.selectedWallId = id;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const rect = this.camera.visibleRect(0.1);
    const joinStyle = this.editorState.get('wallJoinStyle');

    // Culling: отрисовываем только видимые стены
    const visibleWalls = this.plan.walls.filter(w => {
      if (wallHasArc(w)) {
        const pts = wallPolyline(w, 200);
        for (let i = 0; i < pts.length - 1; i++) {
          if (segmentIntersectsRect(pts[i], pts[i + 1], { min: rect.min, max: rect.max })) {
            return true;
          }
        }
        return false;
      }
      return segmentIntersectsRect(w.a, w.b, { min: rect.min, max: rect.max });
    });

    if (joinStyle === 'square') {
      this.renderSquareStyle(ctx, visibleWalls);
      return;
    }

    const joints = this.buildJoints(visibleWalls);

    // 1. Тени стен
    this.renderShadows(ctx, visibleWalls, joints, joinStyle);

    // 2. Тела стен
    ctx.fillStyle = this.themeManager.getColor('wall');
    ctx.strokeStyle = this.themeManager.getColor('wallStroke');
    ctx.lineWidth = 1 / this.camera.scale;

    for (const wall of visibleWalls) {
      this.drawWallBody(ctx, wall);
    }

    // 3. Соединения
    for (const joint of joints) {
      this.drawJoint(ctx, joint, joinStyle);
    }

    // 4. Подсветка выделенной стены
    if (this.selectedWallId) {
      const wall = this.plan.findWall(this.selectedWallId);
      if (wall && visibleWalls.includes(wall)) {
        ctx.fillStyle = this.themeManager.getColor('selectionFill');
        this.drawWallBodyPath(ctx, wall);
        ctx.fill();

        ctx.strokeStyle = this.themeManager.getColor('selected');
        ctx.lineWidth = 2 / this.camera.scale;
        this.drawWallBodyPath(ctx, wall);
        ctx.stroke();
      }
    }
  }

  /**
   * Рендеринг "Прямых" соединений.
   */
  private renderSquareStyle(ctx: CanvasRenderingContext2D, walls: Wall[]): void {
    const joints = this.buildJoints(this.plan.walls);

    const baseSegments: Array<{ wall: Wall; a: Vector2; b: Vector2 }> = [];
    for (const wall of walls) {
      const pts = wallPolyline(wall, 50);
      for (let i = 0; i < pts.length - 1; i++) {
        baseSegments.push({ wall, a: pts[i], b: pts[i + 1] });
      }
    }

    const segments = this.splitSegmentsAtJoints(baseSegments, joints);
    const offset = SHADOW_OFFSET;

    // 1. Тени
    ctx.fillStyle = this.themeManager.getColor('wallShadow');
    ctx.beginPath();
    for (const seg of segments) {
      this.addSegmentPath(ctx, seg.a, seg.b, seg.wall.thickness, offset.x, offset.y);
    }
    ctx.fill();
    ctx.beginPath();
    for (const joint of joints) {
      this.addJointUnionPath(ctx, joint, offset.x, offset.y);
    }
    ctx.fill();
    ctx.beginPath();
    for (const joint of joints) {
      const size = joint.radius * 2;
      this.addAxisAlignedSquarePath(ctx, joint.point, size, offset.x, offset.y);
    }
    ctx.fill();

    // 2. Тела
    ctx.fillStyle = this.themeManager.getColor('wall');
    ctx.beginPath();
    for (const seg of segments) {
      this.addSegmentPath(ctx, seg.a, seg.b, seg.wall.thickness, 0, 0);
    }
    ctx.fill();
    ctx.beginPath();
    for (const joint of joints) {
      this.addJointUnionPath(ctx, joint, 0, 0);
    }
    ctx.fill();
    ctx.beginPath();
    for (const joint of joints) {
      const size = joint.radius * 2;
      this.addAxisAlignedSquarePath(ctx, joint.point, size, 0, 0);
    }
    ctx.fill();

    // 3. Подсветка выделенной стены
    if (this.selectedWallId) {
      const wall = this.plan.findWall(this.selectedWallId);
      if (wall && walls.includes(wall)) {
        ctx.beginPath();
        const pts = wallPolyline(wall, 50);
        for (let i = 0; i < pts.length - 1; i++) {
          this.addSegmentPath(ctx, pts[i], pts[i + 1], wall.thickness + 8 / this.camera.scale, 0, 0);
        }
        ctx.fillStyle = this.themeManager.getColor('selectionFill');
        ctx.fill();

        ctx.strokeStyle = this.themeManager.getColor('selected');
        ctx.lineWidth = 2 / this.camera.scale;
        ctx.stroke();
      }
    }
  }

  private splitSegmentsAtJoints(
    baseSegments: Array<{ wall: Wall; a: Vector2; b: Vector2 }>,
    joints: Joint[],
  ): Array<{ wall: Wall; a: Vector2; b: Vector2 }> {
    const pointsBySegment: Map<number, Vector2[]> = new Map();
    for (let i = 0; i < baseSegments.length; i++) {
      const seg = baseSegments[i];
      pointsBySegment.set(i, [seg.a, seg.b]);
    }

    for (const joint of joints) {
      for (const wall of joint.walls) {
        for (let i = 0; i < baseSegments.length; i++) {
          const seg = baseSegments[i];
          if (seg.wall.id !== wall.id) continue;

          if (wallHasArc(wall)) {
            const nearA = joint.point.distanceTo(seg.a) < 1;
            const nearB = joint.point.distanceTo(seg.b) < 1;
            if (!nearA && !nearB) continue;
          }

          const list = pointsBySegment.get(i);
          if (!list) continue;
          const proj = projectPointToSegment(joint.point, seg.a, seg.b);
          if (proj.dist < 1) {
            list.push(proj.point);
          }
        }
      }
    }

    const segments: Array<{ wall: Wall; a: Vector2; b: Vector2 }> = [];
    for (let i = 0; i < baseSegments.length; i++) {
      const seg = baseSegments[i];
      const pts = pointsBySegment.get(i);
      if (!pts || pts.length < 2) continue;

      const dir = seg.b.sub(seg.a);
      const lenSq = dir.dot(dir);
      const sorted = pts
        .map(p => ({ p, t: lenSq > 1e-12 ? p.sub(seg.a).dot(dir) / lenSq : 0 }))
        .sort((x, y) => x.t - y.t);

      const uniq: { p: Vector2; t: number }[] = [sorted[0]];
      for (let j = 1; j < sorted.length; j++) {
        if (sorted[j].t - uniq[uniq.length - 1].t > 1e-4) {
          uniq.push(sorted[j]);
        }
      }

      for (let j = 0; j < uniq.length - 1; j++) {
        segments.push({ wall: seg.wall, a: uniq[j].p, b: uniq[j + 1].p });
      }
    }

    return segments;
  }

  private addSegmentPath(
    ctx: CanvasRenderingContext2D,
    a: Vector2,
    b: Vector2,
    thickness: number,
    offsetX: number,
    offsetY: number,
  ): void {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;

    const u = new Vector2(dx / len, dy / len);
    const n = u.perpendicular();
    const h = thickness / 2;

    let pts = [
      a.add(n.scale(h)),
      b.add(n.scale(h)),
      b.sub(n.scale(h)),
      a.sub(n.scale(h)),
    ];

    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      area += p1.x * p2.y - p2.x * p1.y;
    }
    if (area < 0) {
      pts = [pts[0], pts[3], pts[2], pts[1]];
    }

    ctx.moveTo(pts[0].x + offsetX, pts[0].y + offsetY);
    ctx.lineTo(pts[1].x + offsetX, pts[1].y + offsetY);
    ctx.lineTo(pts[2].x + offsetX, pts[2].y + offsetY);
    ctx.lineTo(pts[3].x + offsetX, pts[3].y + offsetY);
    ctx.closePath();
  }

  private addAxisAlignedSquarePath(
    ctx: CanvasRenderingContext2D,
    center: Vector2,
    size: number,
    offsetX: number,
    offsetY: number,
  ): void {
    if (size <= 0) return;
    const h = size / 2;
    const x = center.x + offsetX;
    const y = center.y + offsetY;
    ctx.moveTo(x - h, y - h);
    ctx.lineTo(x + h, y - h);
    ctx.lineTo(x + h, y + h);
    ctx.lineTo(x - h, y + h);
    ctx.closePath();
  }

  private addJointUnionPath(
    ctx: CanvasRenderingContext2D,
    joint: Joint,
    offsetX: number,
    offsetY: number,
  ): void {
    const terminalWalls = joint.walls.filter(
      w => joint.point.distanceTo(w.a) < 1 || joint.point.distanceTo(w.b) < 1,
    );
    const addCap = terminalWalls.length === 1;

    interface Dir {
      d: Vector2;
      half: number;
      capRho: number;
    }
    const dirs: Dir[] = [];
    for (const wall of joint.walls) {
      const isA = joint.point.distanceTo(wall.a) < 1;
      const isB = joint.point.distanceTo(wall.b) < 1;
      const d = isA ? wall.b.sub(wall.a).normalized() : wall.a.sub(wall.b).normalized();
      dirs.push({ d, half: wall.thickness / 2, capRho: Infinity });
      if (!isA && !isB) {
        dirs.push({ d: d.scale(-1), half: wall.thickness / 2, capRho: Infinity });
      } else if (addCap && terminalWalls.includes(wall)) {
        dirs.push({ d: d.scale(-1), half: wall.thickness / 2, capRho: wall.thickness / 2 });
      }
    }

    if (dirs.length === 0) return;

    let maxHalf = 0;
    let maxMiter = 0;
    for (const { half } of dirs) {
      maxHalf = Math.max(maxHalf, half);
    }
    for (let i = 0; i < dirs.length; i++) {
      for (let j = i + 1; j < dirs.length; j++) {
        const dot = dirs[i].d.dot(dirs[j].d);
        const alpha = Math.acos(Math.max(-1, Math.min(1, dot)));
        if (alpha < 1e-6 || alpha > Math.PI - 1e-6) continue;
        const miter = Math.max(dirs[i].half, dirs[j].half) / Math.sin(alpha / 2);
        if (miter > maxMiter) maxMiter = miter;
      }
    }
    const bodyCapRho = Math.max(maxMiter * 1.5, maxHalf, 100);

    const angles: number[] = [];
    const baseSamples = 256;
    for (let i = 0; i < baseSamples; i++) {
      angles.push((i / baseSamples) * Math.PI * 2);
    }
    for (const { d, half, capRho } of dirs) {
      const phi = Math.atan2(d.y, d.x);
      const r = capRho === Infinity ? bodyCapRho : capRho;
      const capAngle = Math.atan2(half, r);
      angles.push(
        phi - Math.PI / 2,
        phi - capAngle,
        phi,
        phi + capAngle,
        phi + Math.PI / 2,
      );
    }
    for (let i = 0; i < dirs.length; i++) {
      const phi1 = Math.atan2(dirs[i].d.y, dirs[i].d.x);
      for (let j = i + 1; j < dirs.length; j++) {
        const phi2 = Math.atan2(dirs[j].d.y, dirs[j].d.x);
        const avg = (phi1 + phi2) / 2;
        angles.push(avg, avg + Math.PI);
      }
    }

    const center = joint.point;
    const points: Vector2[] = [];
    for (const theta of angles) {
      const r = new Vector2(Math.cos(theta), Math.sin(theta));
      let bestRho = 0;
      for (const { d, half, capRho } of dirs) {
        const delta = theta - Math.atan2(d.y, d.x);
        const cosDelta = Math.cos(delta);
        if (cosDelta < -1e-9) continue;
        const sinDelta = Math.abs(Math.sin(delta));
        const sideRho = sinDelta < 1e-9 ? Infinity : half / sinDelta;
        const dirCapRho = capRho === Infinity ? bodyCapRho : capRho;
        const actualCapRho = cosDelta < 1e-9 ? Infinity : dirCapRho / cosDelta;
        const rho = Math.min(sideRho, actualCapRho);
        if (rho > bestRho) bestRho = rho;
      }
      points.push(center.add(r.scale(bestRho)));
    }

    const sortedPoints = points
      .map(p => ({ p, a: Math.atan2(p.y - center.y, p.x - center.x) }))
      .sort((x, y) => x.a - y.a)
      .map(x => x.p);

    if (sortedPoints.length === 0) return;
    ctx.moveTo(sortedPoints[0].x + offsetX, sortedPoints[0].y + offsetY);
    for (let i = 1; i < sortedPoints.length; i++) {
      ctx.lineTo(sortedPoints[i].x + offsetX, sortedPoints[i].y + offsetY);
    }
    ctx.closePath();
  }

  private renderShadows(
    ctx: CanvasRenderingContext2D,
    walls: Wall[],
    joints: Joint[],
    joinStyle: WallJoinStyle,
  ): void {
    ctx.fillStyle = this.themeManager.getColor('wallShadow');
    const offset = SHADOW_OFFSET;

    for (const wall of walls) {
      ctx.save();
      ctx.translate(offset.x, offset.y);
      this.drawWallBodyPath(ctx, wall);
      ctx.fill();
      ctx.restore();
    }

    for (const joint of joints) {
      ctx.save();
      ctx.translate(offset.x, offset.y);
      this.drawJoint(ctx, joint, joinStyle);
      ctx.restore();
    }
  }

  private drawWallBody(ctx: CanvasRenderingContext2D, wall: Wall): void {
    this.drawWallBodyPath(ctx, wall);
    ctx.fill();
    ctx.stroke();
  }

  private drawWallBodyPath(ctx: CanvasRenderingContext2D, wall: Wall): void {
    const pts = wallPolyline(wall, 50);
    for (let i = 0; i < pts.length - 1; i++) {
      this.addSegmentPath(ctx, pts[i], pts[i + 1], wall.thickness, 0, 0);
    }
  }

  private drawJoint(ctx: CanvasRenderingContext2D, joint: Joint, style: WallJoinStyle): void {
    if (style === 'none' || joint.walls.length === 0) return;

    if (style === 'round') {
      ctx.beginPath();
      ctx.arc(joint.point.x, joint.point.y, joint.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      return;
    }

    const edgePoints: Vector2[] = [];
    for (const wall of joint.walls) {
      const dir = wall.b.sub(wall.a).normalized();
      const isA = joint.point.distanceTo(wall.a) < 1;
      const d = isA ? dir : dir.scale(-1);
      const n = d.perpendicular();
      const h = wall.thickness / 2;
      edgePoints.push(joint.point.add(n.scale(h)));
      edgePoints.push(joint.point.sub(n.scale(h)));
    }

    if (style === 'bevel') {
      this.drawJointBevel(ctx, joint, edgePoints);
      return;
    }

    if (style === 'miter') {
      if (joint.walls.length === 2) {
        const w1 = joint.walls[0];
        const w2 = joint.walls[1];
        const d1 = w1.b.sub(w1.a).normalized();
        const d2 = w2.b.sub(w2.a).normalized();
        const h1 = w1.thickness / 2;
        const h2 = w2.thickness / 2;
        const miter = this.computeMiterPoint(joint.point, d1, h1, d2, h2);
        if (miter) {
          ctx.beginPath();
          ctx.moveTo(edgePoints[0].x, edgePoints[0].y);
          ctx.lineTo(miter.x, miter.y);
          ctx.lineTo(edgePoints[2].x, edgePoints[2].y);
          ctx.lineTo(edgePoints[3].x, edgePoints[3].y);
          ctx.lineTo(joint.point.x, joint.point.y);
          ctx.lineTo(edgePoints[1].x, edgePoints[1].y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          return;
        }
      }
      this.drawJointBevel(ctx, joint, edgePoints);
    }
  }


  private drawJointBevel(ctx: CanvasRenderingContext2D, joint: Joint, edgePoints?: Vector2[]): void {
    const points = edgePoints ?? this.buildEdgePoints(joint);
    const hull = convexHull(points);
    if (hull.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(hull[0].x, hull[0].y);
      for (let i = 1; i < hull.length; i++) {
        ctx.lineTo(hull[i].x, hull[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  private buildEdgePoints(joint: Joint): Vector2[] {
    const edgePoints: Vector2[] = [];
    for (const wall of joint.walls) {
      const dir = wall.b.sub(wall.a).normalized();
      const isA = joint.point.distanceTo(wall.a) < 1;
      const d = isA ? dir : dir.scale(-1);
      const n = d.perpendicular();
      const h = wall.thickness / 2;
      edgePoints.push(joint.point.add(n.scale(h)));
      edgePoints.push(joint.point.sub(n.scale(h)));
    }
    return edgePoints;
  }

  private computeMiterPoint(
    p: Vector2,
    d1: Vector2,
    h1: number,
    d2: Vector2,
    h2: number,
  ): Vector2 | null {
    let best: Vector2 | null = null;
    let bestDist = 0;

    for (const s1 of [-1, 1]) {
      const n1 = d1.perpendicular().scale(s1);
      for (const s2 of [-1, 1]) {
        const n2 = d2.perpendicular().scale(s2);
        const a1 = p.add(n1.scale(h1));
        const a2 = a1.add(d1);
        const b1 = p.add(n2.scale(h2));
        const b2 = b1.add(d2);
        const inter = lineIntersection(a1, a2, b1, b2);
        if (inter) {
          const dist = inter.distanceTo(p);
          if (dist > Math.max(h1, h2) * 0.8 && dist > bestDist) {
            bestDist = dist;
            best = inter;
          }
        }
      }
    }

    return best;
  }

  private buildJoints(visibleWalls: Wall[]): Joint[] {
    const eps = 1;
    const groups: Array<{ x: number; y: number; radius: number; walls: Wall[] }> = [];

    const addPoint = (p: Vector2, thickness: number, wall: Wall) => {
      for (const g of groups) {
        if (Math.abs(g.x - p.x) < eps && Math.abs(g.y - p.y) < eps) {
          g.radius = Math.max(g.radius, thickness / 2);
          if (!g.walls.includes(wall)) g.walls.push(wall);
          return;
        }
      }
      groups.push({ x: p.x, y: p.y, radius: thickness / 2, walls: [wall] });
    };

    for (const wall of visibleWalls) {
      addPoint(wall.a, wall.thickness, wall);
      addPoint(wall.b, wall.thickness, wall);
    }

    for (let i = 0; i < visibleWalls.length; i++) {
      const wall = visibleWalls[i];
      for (let j = i + 1; j < visibleWalls.length; j++) {
        const other = visibleWalls[j];

        for (const end of [other.a, other.b]) {
          const proj = projectPointToSegment(end, wall.a, wall.b);
          if (proj.t > 0 && proj.t < 1 && proj.dist < eps) {
            const g = groups.find(g => Math.abs(g.x - proj.point.x) < eps && Math.abs(g.y - proj.point.y) < eps);
            if (g) {
              g.radius = Math.max(g.radius, Math.max(wall.thickness, other.thickness) / 2);
              if (!g.walls.includes(wall)) g.walls.push(wall);
              if (!g.walls.includes(other)) g.walls.push(other);
            } else {
              groups.push({ x: proj.point.x, y: proj.point.y, radius: Math.max(wall.thickness, other.thickness) / 2, walls: [wall, other] });
            }
          }
        }

        for (const end of [wall.a, wall.b]) {
          const proj = projectPointToSegment(end, other.a, other.b);
          if (proj.t > 0 && proj.t < 1 && proj.dist < eps) {
            const g = groups.find(g => Math.abs(g.x - proj.point.x) < eps && Math.abs(g.y - proj.point.y) < eps);
            if (g) {
              g.radius = Math.max(g.radius, Math.max(wall.thickness, other.thickness) / 2);
              if (!g.walls.includes(wall)) g.walls.push(wall);
              if (!g.walls.includes(other)) g.walls.push(other);
            } else {
              groups.push({ x: proj.point.x, y: proj.point.y, radius: Math.max(wall.thickness, other.thickness) / 2, walls: [wall, other] });
            }
          }
        }

        const inter = segmentsIntersection(wall.a, wall.b, other.a, other.b);
        if (inter) {
          const t1 = projectPointToSegment(inter, wall.a, wall.b).t;
          const t2 = projectPointToSegment(inter, other.a, other.b).t;
          if (t1 > 0 && t1 < 1 && t2 > 0 && t2 < 1) {
            const g = groups.find(g => Math.abs(g.x - inter.x) < eps && Math.abs(g.y - inter.y) < eps);
            if (g) {
              g.radius = Math.max(g.radius, Math.max(wall.thickness, other.thickness) / 2);
              if (!g.walls.includes(wall)) g.walls.push(wall);
              if (!g.walls.includes(other)) g.walls.push(other);
            } else {
              groups.push({ x: inter.x, y: inter.y, radius: Math.max(wall.thickness, other.thickness) / 2, walls: [wall, other] });
            }
          }
        }
      }
    }

    return groups.map(g => ({ point: new Vector2(g.x, g.y), radius: g.radius, walls: g.walls }));
  }
}
