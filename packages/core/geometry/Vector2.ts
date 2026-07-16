/**
 * Двумерный вектор / точка.
 * Все координаты плана хранятся в миллиметрах.
 */
export class Vector2 {
  constructor(public x: number, public y: number) {}

  add(v: Vector2): Vector2 {
    return new Vector2(this.x + v.x, this.y + v.y);
  }

  sub(v: Vector2): Vector2 {
    return new Vector2(this.x - v.x, this.y - v.y);
  }

  scale(s: number): Vector2 {
    return new Vector2(this.x * s, this.y * s);
  }

  dot(v: Vector2): number {
    return this.x * v.x + this.y * v.y;
  }

  cross(v: Vector2): number {
    return this.x * v.y - this.y * v.x;
  }

  length(): number {
    return Math.hypot(this.x, this.y);
  }

  normalized(): Vector2 {
    const len = this.length();
    if (len === 0) return new Vector2(0, 0);
    return new Vector2(this.x / len, this.y / len);
  }

  /**
   * Вектор, перпендикулярный данному, повернутый на 90° против часовой стрелки.
   * Для оси Y, направленной вниз, это левая нормаль.
   */
  perpendicular(): Vector2 {
    return new Vector2(-this.y, this.x);
  }

  distanceTo(v: Vector2): number {
    return Math.hypot(this.x - v.x, this.y - v.y);
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  equals(v: Vector2, eps = 1e-6): boolean {
    return Math.abs(this.x - v.x) < eps && Math.abs(this.y - v.y) < eps;
  }
}
