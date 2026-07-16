import { Vector2 } from './Vector2';

export interface Rect {
  min: Vector2;
  max: Vector2;
}

interface QuadtreeItem<T> {
  item: T;
  bbox: Rect;
}

/**
 * Простая реализация Quadtree для пространственного индексирования.
 * Хранит элементы с осями-вырожденными bbox и позволяет быстро искать
 * элементы, пересекающие заданный регион.
 */
export class Quadtree<T> {
  private items: QuadtreeItem<T>[] = [];
  private children: Quadtree<T>[] | null = null;
  private readonly maxItems = 8;
  private readonly maxDepth = 8;

  constructor(
    private bounds: Rect,
    private depth = 0,
  ) {}

  /** Очистить дерево. */
  clear(): void {
    this.items = [];
    this.children = null;
  }

  /** Полностью перестроить дерево из набора элементов. */
  rebuild(items: Array<{ item: T; bbox: Rect }>): void {
    this.clear();
    for (const { item, bbox } of items) {
      this.insert(item, bbox);
    }
  }

  /** Вставить элемент с указанным bbox. */
  insert(item: T, bbox: Rect): void {
    if (!this.intersectsBounds(bbox)) return;

    if (this.children) {
      for (const child of this.children) {
        child.insert(item, bbox);
      }
      return;
    }

    this.items.push({ item, bbox });

    if (this.items.length > this.maxItems && this.depth < this.maxDepth) {
      this.split();
      // Перераспределяем элементы по дочерним узлам
      const currentItems = this.items;
      this.items = [];
      for (const { item, bbox } of currentItems) {
        for (const child of this.children!) {
          child.insert(item, bbox);
        }
      }
    }
  }

  /** Найти все элементы, пересекающие заданный регион. */
  query(region: Rect): T[] {
    const result = new Set<T>();
    this.queryRecursive(region, result);
    return Array.from(result);
  }

  private queryRecursive(region: Rect, result: Set<T>): void {
    if (!this.intersectsBounds(region)) return;

    for (const { item, bbox } of this.items) {
      if (this.intersects(bbox, region)) {
        result.add(item);
      }
    }

    if (this.children) {
      for (const child of this.children) {
        child.queryRecursive(region, result);
      }
    }
  }

  private split(): void {
    const midX = (this.bounds.min.x + this.bounds.max.x) / 2;
    const midY = (this.bounds.min.y + this.bounds.max.y) / 2;

    this.children = [
      new Quadtree<T>({ min: new Vector2(this.bounds.min.x, this.bounds.min.y), max: new Vector2(midX, midY) }, this.depth + 1),
      new Quadtree<T>({ min: new Vector2(midX, this.bounds.min.y), max: new Vector2(this.bounds.max.x, midY) }, this.depth + 1),
      new Quadtree<T>({ min: new Vector2(this.bounds.min.x, midY), max: new Vector2(midX, this.bounds.max.y) }, this.depth + 1),
      new Quadtree<T>({ min: new Vector2(midX, midY), max: new Vector2(this.bounds.max.x, this.bounds.max.y) }, this.depth + 1),
    ];
  }

  private intersectsBounds(bbox: Rect): boolean {
    return !(bbox.max.x < this.bounds.min.x || bbox.min.x > this.bounds.max.x ||
             bbox.max.y < this.bounds.min.y || bbox.min.y > this.bounds.max.y);
  }

  private intersects(a: Rect, b: Rect): boolean {
    return !(a.max.x < b.min.x || a.min.x > b.max.x ||
             a.max.y < b.min.y || a.min.y > b.max.y);
  }
}

/** Построить Quadtree для массива стен. */
export function buildWallQuadtree<W extends { a: Vector2; b: Vector2 }>(walls: W[]): Quadtree<W> {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const wall of walls) {
    minX = Math.min(minX, wall.a.x, wall.b.x);
    minY = Math.min(minY, wall.a.y, wall.b.y);
    maxX = Math.max(maxX, wall.a.x, wall.b.x);
    maxY = Math.max(maxY, wall.a.y, wall.b.y);
  }

  // Небольшой запас на случай пустого плана
  if (!isFinite(minX)) {
    minX = -1000; minY = -1000; maxX = 1000; maxY = 1000;
  }

  const padding = Math.max(maxX - minX, maxY - minY) * 0.1 + 100;
  const tree = new Quadtree<W>({
    min: new Vector2(minX - padding, minY - padding),
    max: new Vector2(maxX + padding, maxY + padding),
  });

  for (const wall of walls) {
    tree.insert(wall, {
      min: new Vector2(Math.min(wall.a.x, wall.b.x), Math.min(wall.a.y, wall.b.y)),
      max: new Vector2(Math.max(wall.a.x, wall.b.x), Math.max(wall.a.y, wall.b.y)),
    });
  }

  return tree;
}
