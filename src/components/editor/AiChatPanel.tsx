'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'
import { serializePlanForAi } from '@/lib/ai/planSerializer'
import { AddCableCommand, AddDeviceCommand, AddFreeDeviceCommand, AiAutoDesignCommand } from '@core/editor/CommandManager'
import { Vector2 } from '@core/geometry/Vector2'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: unknown[]
  error?: boolean
}

const QUICK_PROMPTS = [
  'Авторасстановка',
  'Проверь план',
  'Покажи нагрузку',
  'Добавь розетку у двери',
]

const ANALYZE_TYPES = [
  { type: 'devices', label: 'Устройства' },
  { type: 'norms', label: 'Нормы' },
  { type: 'loads', label: 'Нагрузка' },
] as const

export default function AiChatPanel() {
  const { engineRef } = useEditor()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Привет! Я AI-ассистент. Задайте вопрос по плану или попросите автоматически расставить устройства.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return

      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setLoading(true)

      const engine = engineRef.current
      const planSnapshot = engine ? serializePlanForAi(engine.plan) : undefined

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messages
              .filter((m) => m.id !== 'welcome')
              .map((m) => ({ role: m.role, content: m.content }))
              .concat({ role: 'user', content: text }),
            planSnapshot,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: data.error || 'Ошибка при обращении к AI',
              error: true,
            },
          ])
          return
        }

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.message,
            actions: data.actions,
          },
        ])
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Не удалось связаться с AI. Проверьте настройки провайдера.',
            error: true,
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [engineRef, loading, messages]
  )

  const handleAnalyze = useCallback(
    async (type: 'devices' | 'norms' | 'loads') => {
      const engine = engineRef.current
      if (!engine) return

      const planSnapshot = serializePlanForAi(engine.plan)
      setLoading(true)

      try {
        const response = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planSnapshot, type }),
        })

        const data = await response.json()

        if (!response.ok) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: data.error || 'Ошибка анализа',
              error: true,
            },
          ])
          return
        }

        const issuesText = (data.issues as Array<{ message: string }>)
          .map((issue) => `• ${issue.message}`)
          .join('\n')

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `${data.summary}\n\n${issuesText}`,
          },
        ])
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Не удалось выполнить анализ.',
            error: true,
          },
        ])
      } finally {
        setLoading(false)
      }
    },
    [engineRef]
  )

  const applyActions = useCallback(
    (actions: unknown[]) => {
      const engine = engineRef.current
      if (!engine) return

      let applied = 0

      for (const action of actions as Array<{ type: string; [key: string]: unknown }>) {
        try {
          if (action.type === 'addDevice') {
            const cmd = new AddDeviceCommand(
              engine.plan,
              action.wallId as string,
              action.deviceType as import('@core/model/Device').DeviceType,
              action.t as number,
              (action.offset as number) ?? 300,
              ((action.side as number) ?? 1) as 1 | -1
            )
            engine.commandManager.execute(cmd)
            applied++
          } else if (action.type === 'addFreeDevice') {
            const cmd = new AddFreeDeviceCommand(
              engine.plan,
              action.deviceType as import('@core/model/Device').DeviceType,
              new Vector2(action.x as number, action.y as number)
            )
            engine.commandManager.execute(cmd)
            applied++
          } else if (action.type === 'addCable') {
            const cmd = new AddCableCommand(
              engine.plan,
              action.fromDeviceId as string,
              action.toDeviceId as string,
              action.cableType as import('@core/model/Cable').CableType,
              (action.crossSection as number) ?? 2.5
            )
            engine.commandManager.execute(cmd)
            applied++
          } else if (action.type === 'autoDesign') {
            const cmd = new AiAutoDesignCommand(engine.plan)
            engine.commandManager.execute(cmd)
            applied = engine.plan.devices.length
          }
        } catch (err) {
          console.error('Failed to apply AI action:', action, err)
        }
      }

      engine.notifyChanged()
      engine.requestRender()

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Применено действий: ${applied}`,
        },
      ])
    },
    [engineRef]
  )

  return (
    <div className="flex h-full flex-col text-sm">
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto p-3"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[90%] rounded-lg px-3 py-2 ${
              msg.role === 'user'
                ? 'ml-auto bg-blue-600 text-white'
                : msg.error
                  ? 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200'
                  : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
            }`}
          >
            <div className="whitespace-pre-wrap">{msg.content}</div>
            {msg.actions && msg.actions.length > 0 && (
              <button
                onClick={() => applyActions(msg.actions!)}
                className="mt-2 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
              >
                Применить ({msg.actions.length})
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div className="rounded-lg bg-gray-100 px-3 py-2 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            AI думает…
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-2 dark:border-gray-700">
        <div className="mb-2 flex flex-wrap gap-1">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              {prompt}
            </button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap gap-1 border-t border-gray-200 pt-2 dark:border-gray-700">
          {ANALYZE_TYPES.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => handleAnalyze(type)}
              disabled={loading}
              className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-800 hover:bg-purple-200 disabled:opacity-50 dark:bg-purple-900/30 dark:text-purple-200 dark:hover:bg-purple-900/50"
            >
              Анализ: {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend(input)
            }}
            placeholder="Спросите AI…"
            className="flex-1 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={loading || !input.trim()}
            className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  )
}
