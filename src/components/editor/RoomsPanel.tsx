/* eslint-disable react-hooks/immutability -- редактор работает через мутации плана по дизайну */
'use client'

import { useMemo, useState } from 'react'
import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'
import {
  buildRoomData,
  deviceToConsumer,
  ConsumerCategory,
  ConsumerData,
  CircuitData,
  groupConsumersToCircuits,
  estimateCircuitLength,
  RoomData,
} from '@core/electrical/RoomConsumerEngine'

const CATEGORIES: { value: ConsumerCategory; label: string }[] = [
  { value: 'socket', label: 'Розетка' },
  { value: 'switch', label: 'Выключатель' },
  { value: 'light', label: 'Освещение' },
  { value: 'appliance', label: 'Техника' },
  { value: 'heating', label: 'Теплый пол' },
  { value: 'lowcurrent', label: 'Слаботочка' },
]

export default function RoomsPanel() {
  const open = useCadStore((s) => s.roomsOpen)
  const setOpen = useCadStore((s) => s.setRoomsOpen)
  const { engineRef } = useEditor()
  const [, forceUpdate] = useState(0)
  const plan = engineRef.current?.plan

  const rooms = useMemo(() => {
    if (!plan) return []
    const consumers = (plan.electrical.consumers as ConsumerData[]) || []
    const data = buildRoomData(plan, consumers)
    return data
  }, [plan, forceUpdate])

  const circuits = (plan?.electrical.circuits as CircuitData[]) || []

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0]

  const refresh = () => {
    forceUpdate((n) => n + 1)
    engineRef.current?.notifyChanged()
    engineRef.current?.requestRender()
  }

  const handleAddFreeConsumer = (roomId: string) => {
    if (!plan) return
    const consumer: ConsumerData = {
      id: crypto.randomUUID(),
      name: 'Новый потребитель',
      category: 'socket',
      type: 'socket',
      powerW: 2200,
      voltage: 230,
      count: 1,
      demandRatio: 1,
      roomId,
      phase: 'L1',
    }
    plan.electrical.consumers = [...(plan.electrical.consumers as ConsumerData[]), consumer]
    refresh()
  }

  const handleUpdateConsumer = (id: string, patch: Partial<ConsumerData>) => {
    if (!plan) return
    plan.electrical.consumers = (plan.electrical.consumers as ConsumerData[]).map((c) =>
      c.id === id ? { ...c, ...patch } : c
    )
    refresh()
  }

  const handleDeleteConsumer = (id: string) => {
    if (!plan) return
    plan.electrical.consumers = (plan.electrical.consumers as ConsumerData[]).filter((c) => c.id !== id)
    refresh()
  }

  const handleImportDevices = () => {
    if (!plan) return
    const existingIds = new Set((plan.electrical.consumers as ConsumerData[]).map((c) => c.deviceId))
    for (const room of rooms) {
      for (const device of room.devices) {
        if (existingIds.has(device.id)) continue
        const consumer = deviceToConsumer(device, room.id)
        plan.electrical.consumers = [...(plan.electrical.consumers as ConsumerData[]), consumer]
      }
    }
    refresh()
  }

  const handleAutoGroup = () => {
    if (!plan) return
    const consumers = (plan.electrical.consumers as ConsumerData[]) || []
    const generated = groupConsumersToCircuits(consumers)
    // Estimate lengths per circuit
    for (const c of generated) {
      c.lengthM = estimateCircuitLength(c, rooms)
    }
    plan.electrical.circuits = generated
    refresh()
  }

  const handleClearCircuits = () => {
    if (!plan) return
    plan.electrical.circuits = []
    refresh()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/35"
      onClick={() => setOpen(false)}
    >
      <div
        className="absolute left-1/2 top-1/2 flex max-h-[80vh] w-[calc(100%-32px)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-white p-4 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">Комнаты и потребители</span>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            onClick={handleAutoGroup}
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm text-white hover:bg-orange-600"
          >
            ⚡ Автогруппировать линии
          </button>
          <button
            onClick={handleImportDevices}
            className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600"
          >
            Импорт устройств
          </button>
          <button
            onClick={handleClearCircuits}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Очистить линии
          </button>
        </div>

        <div className="flex flex-1 gap-3 overflow-hidden">
          {/* Rooms list */}
          <div className="flex w-1/3 min-w-[180px] flex-col gap-2 overflow-y-auto border-r border-gray-200 pr-2 dark:border-gray-700">
            {rooms.length === 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400">Нет комнат. Нарисуйте стены.</div>
            )}
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoomId(room.id)}
                className={`rounded-lg border p-2 text-left text-sm ${
                  selectedRoom?.id === room.id
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700'
                }`}
              >
                <div className="font-medium text-gray-900 dark:text-white">{room.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {room.area > 0 ? (room.area / 1_000_000).toFixed(2) : '0.00'} м² · {room.devices.length} устр. ·{' '}
                  {room.consumers.length} потр.
                </div>
              </button>
            ))}
          </div>

          {/* Room details */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
            {selectedRoom ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{selectedRoom.name}</h3>
                  <button
                    onClick={() => handleAddFreeConsumer(selectedRoom.id)}
                    className="rounded-lg bg-orange-500 px-2 py-1 text-xs text-white hover:bg-orange-600"
                  >
                    + Потребитель
                  </button>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Площадь: <b>{(selectedRoom.area / 1_000_000).toFixed(2)} м²</b>
                </div>

                <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Устройства на плане</h4>
                {selectedRoom.devices.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">Нет устройств в этой комнате.</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {selectedRoom.devices.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between rounded border border-gray-200 px-2 py-1 text-sm dark:border-gray-700"
                      >
                        <span className="text-gray-900 dark:text-white">{d.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{d.type}</span>
                      </div>
                    ))}
                  </div>
                )}

                <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Потребители</h4>
                {selectedRoom.consumers.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">Нет потребителей.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {selectedRoom.consumers.map((c) => (
                      <ConsumerRow
                        key={c.id}
                        consumer={c}
                        onUpdate={(patch) => handleUpdateConsumer(c.id, patch)}
                        onDelete={() => handleDeleteConsumer(c.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">Выберите комнату.</div>
            )}

            {circuits.length > 0 && (
              <>
                <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Линии щита</h4>
                <div className="flex flex-col gap-2">
                  {circuits.map((c) => (
                    <div
                      key={c.id}
                      className="rounded border border-gray-200 p-2 text-sm dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{c.ratedCurrentA}А · {c.crossSectionMm2} мм²</span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {c.consumers.length} потр. · {c.lengthM} м
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ConsumerRow({
  consumer,
  onUpdate,
  onDelete,
}: {
  consumer: ConsumerData
  onUpdate: (patch: Partial<ConsumerData>) => void
  onDelete: () => void
}) {
  return (
    <div className="rounded border border-gray-200 p-2 text-sm dark:border-gray-700">
      <div className="mb-2 flex items-center gap-2">
        <input
          type="text"
          value={consumer.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <button
          onClick={onDelete}
          className="text-red-500 hover:text-red-700"
          title="Удалить"
        >
          ×
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={consumer.category}
          onChange={(e) => onUpdate({ category: e.target.value as ConsumerCategory })}
          className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={consumer.powerW}
          onChange={(e) => onUpdate({ powerW: Number(e.target.value) })}
          className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          placeholder="Вт"
        />
        <input
          type="number"
          value={consumer.count}
          onChange={(e) => onUpdate({ count: Number(e.target.value) })}
          className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          placeholder="Кол-во"
        />
        <input
          type="number"
          value={consumer.demandRatio}
          step={0.1}
          min={0.1}
          max={1}
          onChange={(e) => onUpdate({ demandRatio: Number(e.target.value) })}
          className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          placeholder="Коэф. спроса"
        />
      </div>
    </div>
  )
}
