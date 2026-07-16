import { Plan } from '@core/model/Plan'
import { serializePlan, deserializePlan, SerializedPlan } from './serializer'

const DB_NAME = 'InvoltCAD-Web'
const DB_VERSION = 1
const STORE_NAME = 'projects'
const AUTOSAVE_DELAY_MS = 2000

interface CachedProject {
  id: string
  name: string
  plan: SerializedPlan
  updatedAt: number
  syncedAt?: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

async function getCachedProject(id: string): Promise<CachedProject | undefined> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  return new Promise((resolve, reject) => {
    const req = store.get(id)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function setCachedProject(project: CachedProject): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  return new Promise((resolve, reject) => {
    const req = store.put(project)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function deleteCachedProject(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  return new Promise((resolve, reject) => {
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export interface ProjectMeta {
  id: string
  name: string
  updatedAt: string
  role: string
}

export class ProjectSync {
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private currentProjectId: string | null = null

  /**
   * Загружает список проектов пользователя с сервера.
   */
  async listProjects(): Promise<ProjectMeta[]> {
    const res = await fetch('/api/projects')
    if (!res.ok) {
      throw new Error('Ошибка загрузки проектов')
    }
    return res.json()
  }

  /**
   * Загружает проект по ID. Сначала пытается с сервера, потом из кэша.
   */
  async loadProject(id: string): Promise<{ plan: Plan; name: string; fromCache: boolean }> {
    this.currentProjectId = id

    // Пытаемся загрузить с сервера
    try {
      const res = await fetch(`/api/projects/${id}`)
      if (res.ok) {
        const data = await res.json()
        const plan = deserializePlan(data.plan)
        // Сохраняем в кэш
        await setCachedProject({
          id,
          name: data.name,
          plan: data.plan,
          updatedAt: Date.now(),
          syncedAt: Date.now(),
        })
        return { plan, name: data.name, fromCache: false }
      }
    } catch (error) {
      console.warn('Не удалось загрузить проект с сервера, пробуем кэш:', error)
    }

    // Загружаем из кэша
    const cached = await getCachedProject(id)
    if (cached) {
      const plan = deserializePlan(cached.plan)
      return { plan, name: cached.name, fromCache: true }
    }

    throw new Error('Проект не найден')
  }

  /**
   * Сохраняет проект на сервер и в кэш (с debounce).
   */
  scheduleSave(plan: Plan, name?: string): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }

    this.saveTimer = setTimeout(async () => {
      await this.saveProject(plan, name)
    }, AUTOSAVE_DELAY_MS)
  }

  /**
   * Немедленно сохраняет проект.
   */
  async saveProject(plan: Plan, name?: string): Promise<void> {
    if (!this.currentProjectId) {
      // Создаём новый проект
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name ?? 'Новый проект' }),
      })
      if (!res.ok) {
        throw new Error('Ошибка создания проекта')
      }
      const project = await res.json()
      this.currentProjectId = project.id
    }

    const projectId = this.currentProjectId
    if (!projectId) {
      throw new Error('Не удалось определить ID проекта')
    }

    const serialized = serializePlan(plan)

    // Сохраняем в кэш
    await setCachedProject({
      id: projectId,
      name: name ?? 'Проект',
      plan: serialized,
      updatedAt: Date.now(),
    })

    // Сохраняем на сервер
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name ?? undefined,
          plan: serialized,
        }),
      })
      if (!res.ok) {
        throw new Error('Ошибка сохранения на сервер')
      }
      // Обновляем метку синхронизации
      const cached = await getCachedProject(projectId)
      if (cached) {
        await setCachedProject({ ...cached, syncedAt: Date.now() })
      }
    } catch (error) {
      console.warn('Не удалось сохранить проект на сервер, остался в кэше:', error)
    }
  }

  /**
   * Создаёт новый проект.
   */
  async createProject(name: string): Promise<string> {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) {
      throw new Error('Ошибка создания проекта')
    }
    const project = await res.json()
    this.currentProjectId = project.id
    return project.id
  }

  /**
   * Удаляет проект.
   */
  async deleteProject(id: string): Promise<void> {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    await deleteCachedProject(id)
    if (this.currentProjectId === id) {
      this.currentProjectId = null
    }
  }

  /**
   * Дублирует проект.
   */
  async duplicateProject(id: string): Promise<string> {
    const res = await fetch(`/api/projects/${id}/duplicate`, { method: 'POST' })
    if (!res.ok) {
      throw new Error('Ошибка дублирования')
    }
    const project = await res.json()
    return project.id
  }

  getCurrentProjectId(): string | null {
    return this.currentProjectId
  }

  setCurrentProjectId(id: string | null): void {
    this.currentProjectId = id
  }
}

export const projectSync = new ProjectSync()
