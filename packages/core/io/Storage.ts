import { Plan } from '../model/Plan';
import { PlanSerializer } from './PlanSerializer';
import { ProjectMeta, generateProjectName, findFreeProjectIndex } from '../model/Project';
import { CABLE_TYPES } from '../model/Cable';
import { DEFAULT_DEVICE_NAMES } from '../model/Device';
import { wallLength } from '../model/Wall';
import { ThemeName } from '../editor/ThemeManager';

const DB_NAME = 'InvoltCAD';
const DB_VERSION = 2;
const STORE_NAME = 'plans';

const PROJECTS_META_KEY = '__projects_meta__';
const CURRENT_PROJECT_KEY = '__current_project__';
const PROJECT_PREFIX = 'project:';
const THEME_KEY = '__theme__';

const AUTOSAVE_DELAY_MS = 1000;

const FALLBACK_PROJECTS_KEY = 'involtcad-projects-v1';
const FALLBACK_LEGACY_PLAN_KEY = 'involtcad-plan-v1';
const FALLBACK_THEME_KEY = 'involtcad-theme-v1';

interface ProjectsFallback {
  meta: ProjectMeta[];
  current: string | null;
}

/**
 * Хранилище проектов на IndexedDB с fallback на localStorage.
 * Управляет несколькими планами: создание, загрузка, сохранение,
 * переименование, дублирование, удаление, импорт/экспорт JSON.
 */
export class Storage {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private db: IDBDatabase | null = null;
  private currentProjectId: string | null = null;

  constructor() {}

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }

  private async getItem<T>(key: string): Promise<T | undefined> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      return new Promise<T | undefined>((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('IndexedDB get failed:', e);
      return this.fallbackGetItem(key) as T | undefined;
    }
  }

  private async setItem(key: string, value: unknown): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      await new Promise<void>((resolve, reject) => {
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('IndexedDB set failed:', e);
      this.fallbackSetItem(key, value);
    }
  }

  private async removeItem(key: string): Promise<void> {
    try {
      const db = await this.openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      await new Promise<void>((resolve, reject) => {
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error('IndexedDB delete failed:', e);
      this.fallbackRemoveItem(key);
    }
  }

  /** Запросить автосохранение текущего плана с debounce. */
  scheduleSave(plan: Plan): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(plan), AUTOSAVE_DELAY_MS);
  }

  async save(plan: Plan): Promise<void> {
    if (!this.currentProjectId) {
      const id = await this.createProject(generateProjectName(await this.nextProjectIndex()));
      this.currentProjectId = id;
      await this.setItem(CURRENT_PROJECT_KEY, id);
    }
    await this.saveProject(this.currentProjectId, plan);
  }

  /** Загрузить текущий проект или создать новый. */
  async load(): Promise<Plan> {
    let currentId = await this.getCurrentProjectId();

    // Миграция старого единичного плана в первый проект
    if (!currentId) {
      const legacyPlan = this.fallbackLoadLegacyPlan();
      if (legacyPlan) {
        const name = generateProjectName(1);
        const id = await this.createProject(name);
        await this.saveProject(id, legacyPlan, name);
        currentId = id;
        await this.setItem(CURRENT_PROJECT_KEY, id);
      }
    }

    if (!currentId) {
      const id = await this.createProject(generateProjectName(await this.nextProjectIndex()));
      currentId = id;
      await this.setItem(CURRENT_PROJECT_KEY, id);
    }

    this.currentProjectId = currentId;
    return this.loadProject(currentId);
  }

  /** Список метаданных проектов, отсортированных по updatedAt (сначала новые). */
  async listProjects(): Promise<ProjectMeta[]> {
    const meta = (await this.getItem<ProjectMeta[]>(PROJECTS_META_KEY)) ?? [];
    return meta.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getCurrentProjectId(): Promise<string | null> {
    const id = await this.getItem<string>(CURRENT_PROJECT_KEY);
    if (id) return id;
    const fallback = this.fallbackLoadProjects();
    return fallback.current;
  }

  async setCurrentProjectId(id: string): Promise<void> {
    this.currentProjectId = id;
    await this.setItem(CURRENT_PROJECT_KEY, id);
  }

  async getCurrentProjectName(): Promise<string | null> {
    const id = await this.getCurrentProjectId();
    if (!id) return null;
    const meta = await this.getProjectsMeta();
    return meta.find(m => m.id === id)?.name ?? null;
  }

  async loadTheme(): Promise<ThemeName> {
    const value = await this.getItem<ThemeName>(THEME_KEY);
    if (value === 'light' || value === 'dark') return value;
    try {
      const fallback = localStorage.getItem(FALLBACK_THEME_KEY);
      if (fallback === 'light' || fallback === 'dark') return fallback;
    } catch (e) {
      console.error('Fallback load theme failed:', e);
    }
    return 'light';
  }

  async saveTheme(name: ThemeName): Promise<void> {
    await this.setItem(THEME_KEY, name);
    try {
      localStorage.setItem(FALLBACK_THEME_KEY, name);
    } catch (e) {
      console.error('Fallback save theme failed:', e);
    }
  }

  async createProject(name: string): Promise<string> {
    const id = crypto.randomUUID();
    const meta = await this.getProjectsMeta();
    meta.push({ id, name, updatedAt: Date.now() });
    await this.setItem(PROJECTS_META_KEY, meta);
    await this.setItem(PROJECT_PREFIX + id, PlanSerializer.serialize(new Plan()));
    return id;
  }

  async loadProject(id: string): Promise<Plan> {
    const json = await this.getItem<string>(PROJECT_PREFIX + id);
    if (json) return PlanSerializer.deserialize(json);
    return new Plan();
  }

  async saveProject(id: string, plan: Plan, name?: string): Promise<void> {
    const meta = await this.getProjectsMeta();
    const item = meta.find(m => m.id === id);
    if (!item) {
      console.warn('Проект не найден при сохранении:', id);
      return;
    }
    item.updatedAt = Date.now();
    if (name !== undefined) item.name = name;
    await this.setItem(PROJECTS_META_KEY, meta);
    await this.setItem(PROJECT_PREFIX + id, PlanSerializer.serialize(plan));
  }

  async renameProject(id: string, name: string): Promise<void> {
    await this.saveProject(id, await this.loadProject(id), name);
  }

  async duplicateProject(id: string): Promise<string> {
    const plan = await this.loadProject(id);
    const meta = await this.getProjectsMeta();
    const source = meta.find(m => m.id === id);
    const newName = `Копия ${source?.name ?? generateProjectName(1)}`;
    const newId = await this.createProject(newName);
    await this.saveProject(newId, plan, newName);
    return newId;
  }

  async deleteProject(id: string): Promise<void> {
    const meta = await this.getProjectsMeta();
    const newMeta = meta.filter(m => m.id !== id);
    await this.setItem(PROJECTS_META_KEY, newMeta);
    await this.removeItem(PROJECT_PREFIX + id);
    if (this.currentProjectId === id) {
      this.currentProjectId = null;
      await this.removeItem(CURRENT_PROJECT_KEY);
    }
  }

  async importProjectFromFile(file: File, name?: string): Promise<string> {
    const plan = await this.importPlanFromFile(file);
    const projectName = name ?? this.fileNameToProjectName(file.name);
    const id = await this.createProject(projectName);
    await this.saveProject(id, plan, projectName);
    return id;
  }

  /** Экспорт плана в файл JSON. */
  exportToFile(plan: Plan, filename = 'involtcad-plan.json'): void {
    const json = PlanSerializer.serialize(plan);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** Импорт плана из файла JSON. */
  importPlanFromFile(file: File): Promise<Plan> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const json = String(reader.result);
        const plan = PlanSerializer.deserialize(json);
        resolve(plan);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  /** Экспорт детальной спецификации в CSV. */
  exportSpecToCSV(plan: Plan, filename = 'involtcad-spec.csv'): void {
    const rows: string[][] = [];

    // Сводка
    rows.push(['СВОДКА']);
    rows.push(['Параметр', 'Значение']);
    const wallCount = plan.walls.length;
    const totalWallLength = plan.walls.reduce((sum, w) => sum + wallLength(w), 0);
    const wallArea = plan.walls.reduce((sum, w) => {
      const length = wallLength(w);
      const openingArea = w.openings.reduce((a, o) => a + o.width * w.thickness, 0);
      return sum + length * w.thickness - openingArea;
    }, 0);
    const doors = plan.walls.reduce((sum, w) => sum + w.openings.filter(o => o.type === 'door').length, 0);
    const windows = plan.walls.reduce((sum, w) => sum + w.openings.filter(o => o.type === 'window').length, 0);
    const rooms = plan.getRooms();
    const totalArea = rooms.reduce((sum, r) => sum + r.area, 0);
    const totalCableLength = plan.cables.reduce((sum, c) => sum + c.length, 0);
    const totalCableWithSpare = plan.cables.reduce((sum, c) => sum + (c.totalLength ?? c.length), 0);

    rows.push(['Стены, шт', String(wallCount)]);
    rows.push(['Общая длина стен, мм', String(Math.round(totalWallLength))]);
    rows.push(['Площадь стен, м²', (wallArea / 1_000_000).toFixed(2)]);
    rows.push(['Двери, шт', String(doors)]);
    rows.push(['Окна, шт', String(windows)]);
    rows.push(['Устройств, шт', String(plan.devices.length)]);
    rows.push(['Кабель (геометр.), м', (totalCableLength / 1000).toFixed(2)]);
    rows.push(['Кабель с запасом, м', (totalCableWithSpare / 1000).toFixed(2)]);
    rows.push(['Комнат, шт', String(rooms.length)]);
    rows.push(['Общая площадь комнат, м²', (totalArea / 1_000_000).toFixed(2)]);
    rows.push([]);

    // Стены поштучно
    if (plan.walls.length > 0) {
      rows.push(['СТЕНЫ']);
      rows.push(['№', 'Длина, мм', 'Толщина, мм', 'Площадь, м²', 'Площадь проёмов, м²']);
      plan.walls.forEach((w, i) => {
        const length = wallLength(w);
        const openingArea = w.openings.reduce((a, o) => a + o.width * w.thickness, 0);
        const area = length * w.thickness - openingArea;
        rows.push([
          String(i + 1),
          String(Math.round(length)),
          String(w.thickness),
          (area / 1_000_000).toFixed(2),
          (openingArea / 1_000_000).toFixed(2),
        ]);
      });
      rows.push([]);
    }

    // Проёмы поштучно
    const allOpenings = plan.walls.flatMap(w => w.openings.map(o => ({ ...o, wallIndex: w })));
    if (allOpenings.length > 0) {
      rows.push(['ПРОЁМЫ']);
      rows.push(['№', 'Тип', 'Ширина, мм', 'Высота, мм', 'Площадь, м²']);
      allOpenings.forEach((o, i) => {
        const height = openingHeight(o.type);
        rows.push([
          String(i + 1),
          o.type === 'door' ? 'Дверь' : 'Окно',
          String(o.width),
          String(height),
          ((o.width * height) / 1_000_000).toFixed(2),
        ]);
      });
      rows.push([]);
    }

    // Оборудование поштучно
    if (plan.devices.length > 0) {
      rows.push(['ОБОРУДОВАНИЕ']);
      rows.push(['№', 'Тип', 'Имя', 'Высота, мм']);
      plan.devices.forEach((d, i) => {
        const name = DEFAULT_DEVICE_NAMES[d.type] ?? d.type;
        rows.push([String(i + 1), name, d.name || name, String(d.height ?? '')]);
      });
      rows.push([]);
    }

    // Кабели по типам и сечениям
    if (plan.cables.length > 0) {
      rows.push(['КАБЕЛИ']);
      rows.push(['Тип / сечение', 'Количество, шт', 'Длина, м', 'Длина с запасом, м', 'Запас, м']);
      const cableGroups = new Map<string, { count: number; length: number; totalLength: number; spare: number }>();
      for (const cable of plan.cables) {
        const key = `${CABLE_TYPES[cable.type]} ${cable.crossSection} мм²`;
        const total = cable.totalLength ?? cable.length;
        const spare = cable.spareLength ?? (total - cable.length);
        const existing = cableGroups.get(key) ?? { count: 0, length: 0, totalLength: 0, spare: 0 };
        existing.count++;
        existing.length += cable.length;
        existing.totalLength += total;
        existing.spare += spare;
        cableGroups.set(key, existing);
      }
      for (const [key, val] of cableGroups) {
        rows.push([
          key,
          String(val.count),
          (val.length / 1000).toFixed(2),
          (val.totalLength / 1000).toFixed(2),
          (val.spare / 1000).toFixed(2),
        ]);
      }
      rows.push([]);
    }

    // Комнаты
    if (rooms.length > 0) {
      rows.push(['КОМНАТЫ']);
      rows.push(['№', 'Площадь, м²']);
      rooms.forEach((r, i) => {
        rows.push([`Комната ${i + 1}`, (r.area / 1_000_000).toFixed(2)]);
      });
      rows.push(['Итого', (totalArea / 1_000_000).toFixed(2)]);
      rows.push([]);
    }

    // Проверка плана
    const validation = plan.validate();
    if (validation.issues.length > 0) {
      rows.push(['ПРОВЕРКА']);
      rows.push(['Уровень', 'Количество']);
      rows.push(['Ошибки', String(validation.errors)]);
      rows.push(['Предупреждения', String(validation.warnings)]);
      rows.push(['Замечания', String(validation.infos)]);
    }

    const csv = rows.map(r => r.map(escapeCSV).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private async getProjectsMeta(): Promise<ProjectMeta[]> {
    return (await this.getItem<ProjectMeta[]>(PROJECTS_META_KEY)) ?? [];
  }

  private async nextProjectIndex(): Promise<number> {
    const meta = await this.getProjectsMeta();
    return findFreeProjectIndex(meta.map(m => m.name));
  }

  private fileNameToProjectName(fileName: string): string {
    const base = fileName.replace(/\.json$/i, '').replace(/[_-]/g, ' ').trim();
    return base || generateProjectName(1);
  }

  // --- Fallback localStorage ---

  private fallbackGetItem(key: string): unknown {
    if (key === PROJECTS_META_KEY || key === CURRENT_PROJECT_KEY) {
      const data = localStorage.getItem(FALLBACK_PROJECTS_KEY);
      if (!data) return undefined;
      try {
        const parsed = JSON.parse(data) as ProjectsFallback;
        if (key === PROJECTS_META_KEY) return parsed.meta;
        return parsed.current;
      } catch {
        return undefined;
      }
    }
    if (key.startsWith(PROJECT_PREFIX)) {
      return localStorage.getItem(FALLBACK_PROJECTS_KEY.replace('-projects-', '-project-') + key.slice(PROJECT_PREFIX.length));
    }
    return undefined;
  }

  private fallbackSetItem(key: string, value: unknown): void {
    try {
      if (key === PROJECTS_META_KEY || key === CURRENT_PROJECT_KEY) {
        const existing = this.fallbackLoadProjects();
        if (key === PROJECTS_META_KEY) existing.meta = value as ProjectMeta[];
        else existing.current = value as string | null;
        localStorage.setItem(FALLBACK_PROJECTS_KEY, JSON.stringify(existing));
        return;
      }
      if (key.startsWith(PROJECT_PREFIX)) {
        localStorage.setItem(FALLBACK_PROJECTS_KEY.replace('-projects-', '-project-') + key.slice(PROJECT_PREFIX.length), String(value));
        return;
      }
      localStorage.setItem(FALLBACK_PROJECTS_KEY + ':' + key, JSON.stringify(value));
    } catch (e) {
      console.error('Fallback set failed:', e);
    }
  }

  private fallbackRemoveItem(key: string): void {
    try {
      if (key === PROJECTS_META_KEY || key === CURRENT_PROJECT_KEY) {
        const existing = this.fallbackLoadProjects();
        if (key === PROJECTS_META_KEY) existing.meta = [];
        else existing.current = null;
        localStorage.setItem(FALLBACK_PROJECTS_KEY, JSON.stringify(existing));
        return;
      }
      if (key.startsWith(PROJECT_PREFIX)) {
        localStorage.removeItem(FALLBACK_PROJECTS_KEY.replace('-projects-', '-project-') + key.slice(PROJECT_PREFIX.length));
      }
    } catch (e) {
      console.error('Fallback remove failed:', e);
    }
  }

  private fallbackLoadProjects(): ProjectsFallback {
    try {
      const data = localStorage.getItem(FALLBACK_PROJECTS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return { meta: parsed.meta ?? [], current: parsed.current ?? null };
      }
    } catch (e) {
      console.error('Fallback load projects failed:', e);
    }
    return { meta: [], current: null };
  }

  private fallbackLoadLegacyPlan(): Plan | null {
    try {
      const json = localStorage.getItem(FALLBACK_LEGACY_PLAN_KEY);
      if (json) return PlanSerializer.deserialize(json);
    } catch (e) {
      console.error('Fallback load legacy plan failed:', e);
    }
    return null;
  }
}

function escapeCSV(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function openingHeight(type: import('../model/Opening.js').OpeningType): number {
  return type === 'door' ? 2100 : 1500;
}
