/* eslint-disable react-hooks/immutability -- редактор работает через мутации плана по дизайну */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useEditor } from './EditorContext'
import { buildRoomData, RoomData } from '@core/electrical/RoomConsumerEngine'
import { AddSheetTableCommand } from '@core/editor/CommandManager'
import { Vector2 } from '@core/geometry/Vector2'

export default function RoomNumbersPanel() {
  const { engineRef } = useEditor()
  const plan = engineRef.current?.plan
  const [tick, setTick] = useState(0)
  const [editing, setEditing] = useState<Record<string, string>>({})

  // Обновляем список комнат периодически, чтобы реагировать на изменения плана.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250)
    return () => clearInterval(id)
  }, [])

  const rooms = useMemo<RoomData[]>(() => {
    if (!plan) return []
    return buildRoomData(plan, (plan.electrical.consumers ?? []) as any[])
  }, [plan, tick])

  const refresh = () => {
    setTick((t) => t + 1)
    engineRef.current?.notifyChanged()
    engineRef.current?.requestRender()
  }

  const handleChange = (id: string, value: string) => {
    setEditing((prev) => ({ ...prev, [id]: value }))
  }

  const commit = (id: string) => {
    if (!plan) return
    const value = editing[id] ?? ''
    plan.updateRoomName(id, value.trim())
    setEditing((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    refresh()
  }

  const handleAddToSheet = () => {
    const engine = engineRef.current
    if (!engine || !plan) return
    const width = 200
    const height = 80
    const pos = new Vector2(engine.camera.x - width / 2, engine.camera.y - height / 2)
    engine.commandManager.execute(new AddSheetTableCommand(plan, 'roomNumbers', pos, width, height))
    engine.notifyChanged()
    engine.requestRender()
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-auto">
      {rooms.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">Нет комнат. Нарисуйте стены.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-2 py-1 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">№</th>
              <th className="px-2 py-1 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Наименование</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-b border-gray-100 dark:border-gray-700">
                <td className="px-2 py-1 text-gray-900 dark:text-white">{room.number}</td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    value={editing[room.id] ?? room.name}
                    onChange={(e) => handleChange(room.id, e.target.value)}
                    onBlur={() => commit(room.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commit(room.id)
                    }}
                    placeholder={`Комната ${room.number}`}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rooms.length > 0 && (
        <button
          onClick={handleAddToSheet}
          className="rounded border border-[var(--accent)] bg-[var(--accent)]/10 px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/20"
        >
          Добавить на лист
        </button>
      )}
    </div>
  )
}
