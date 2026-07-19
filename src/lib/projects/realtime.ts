import { Plan } from '@core/model/Plan'
import { deserializePlan } from './serializer'

const POLL_INTERVAL_MS = 5000 // 5 секунд

export interface RealtimeSyncOptions {
  projectId: string
  onUpdate: (plan: Plan) => void
  onError?: (error: Error) => void
}

export class RealtimeSync {
  private timer: ReturnType<typeof setInterval> | null = null
  private lastUpdatedAt: string | null = null
  private isPolling = false

  /**
   * Начинает polling проекта для получения обновлений.
   */
  start(options: RealtimeSyncOptions): void {
    this.stop()

    this.isPolling = true
    this.timer = setInterval(async () => {
      await this.poll(options)
    }, POLL_INTERVAL_MS)
  }

  /**
   * Останавливает polling.
   */
  stop(): void {
    this.isPolling = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /**
   * Выполняет один опрос сервера.
   */
  private async poll(options: RealtimeSyncOptions): Promise<void> {
    if (!this.isPolling) return

    try {
      const res = await fetch(`/api/projects/${options.projectId}`)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()

      // Проверяем, изменился ли проект
      if (this.lastUpdatedAt === data.updatedAt) {
        return
      }

      this.lastUpdatedAt = data.updatedAt

      // Десериализуем план и вызываем callback
      const plan = deserializePlan(data.plan)
      options.onUpdate(plan)
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * Проверяет, активен ли polling.
   */
  isActive(): boolean {
    return this.isPolling
  }
}

export const realtimeSync = new RealtimeSync()
