/**
 * Метаданные проекта (плана) для списка проектов.
 */
export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number; // timestamp ms
}

/**
 * Генерирует стандартное имя для нового проекта.
 */
export function generateProjectName(index: number): string {
  return `Новый проект ${index}`;
}

/**
 * Находит первый свободный индекс для имени "Новый проект N".
 */
export function findFreeProjectIndex(existingNames: string[]): number {
  const used = new Set<number>();
  const regex = /^Новый проект (\d+)$/;
  for (const name of existingNames) {
    const match = regex.exec(name);
    if (match) {
      used.add(parseInt(match[1], 10));
    }
  }
  let i = 1;
  while (used.has(i)) i++;
  return i;
}
