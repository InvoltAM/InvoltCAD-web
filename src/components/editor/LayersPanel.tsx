'use client'

import { useCadStore } from '@/stores/cadStore'

const layers: Array<{ key: keyof ReturnType<typeof useCadStore.getState>['layers']; label: string }> = [
  { key: 'rooms', label: 'Комнаты' },
  { key: 'walls', label: 'Стены' },
  { key: 'openings', label: 'Двери/окна' },
  { key: 'dimensions', label: 'Размеры' },
  { key: 'wallDimensions', label: 'Размеры стен' },
  { key: 'devices', label: 'Оборудование' },
  { key: 'cables', label: 'Кабели' },
]

export default function LayersPanel() {
  const currentLayers = useCadStore((s) => s.layers)
  const setLayers = useCadStore((s) => s.setLayers)

  return (
    <div className="absolute right-[220px] top-3 z-20 hidden w-40 rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800 md:block">
      <div className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
        Слои
      </div>
      <div className="p-3">
        {layers.map((layer) => (
          <label
            key={layer.key}
            className="mb-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
          >
            <input
              type="checkbox"
              checked={currentLayers[layer.key]}
              onChange={(e) =>
                setLayers({ ...currentLayers, [layer.key]: e.target.checked })
              }
              className="rounded border-gray-300"
            />
            {layer.label}
          </label>
        ))}
      </div>
    </div>
  )
}
