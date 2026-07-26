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
    <div className="space-y-2">
      {layers.map((layer) => (
        <label
          key={layer.key}
          className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
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
  )
}
