'use client'

import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'

export default function PropertyPanel() {
  const selectedWallId = useCadStore((s) => s.selectedWallId)
  const selectedOpeningId = useCadStore((s) => s.selectedOpeningId)
  const selectedDeviceId = useCadStore((s) => s.selectedDeviceId)
  const selectedCableId = useCadStore((s) => s.selectedCableId)
  const selectedDimensionId = useCadStore((s) => s.selectedDimensionId)
  const currentTool = useCadStore((s) => s.currentTool)
  const { engineRef } = useEditor()

  const hasSelection =
    selectedWallId ||
    selectedOpeningId ||
    selectedDeviceId ||
    selectedCableId ||
    selectedDimensionId

  const hasToolSettings =
    currentTool === 'wall' ||
    currentTool === 'door' ||
    currentTool === 'window' ||
    currentTool === 'device' ||
    currentTool === 'cable'

  if (!hasSelection && !hasToolSettings) {
    return (
      <div className="absolute right-3 top-3 z-20 hidden w-48 rounded-lg border border-gray-200 bg-white p-3 shadow-md dark:border-gray-700 dark:bg-gray-800 md:block">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Выберите объект или инструмент
        </div>
      </div>
    )
  }

  return (
    <div className="absolute right-3 top-3 z-20 hidden w-48 rounded-lg border border-gray-200 bg-white p-3 shadow-md dark:border-gray-700 dark:bg-gray-800 md:block">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-gray-900 dark:text-white">Свойства</span>
        <button
          onClick={() => useCadStore.getState().clearSelection()}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          ×
        </button>
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        {selectedWallId && 'Стена выбрана'}
        {selectedOpeningId && 'Проём выбран'}
        {selectedDeviceId && 'Устройство выбрано'}
        {selectedCableId && 'Кабель выбран'}
        {selectedDimensionId && 'Размер выбран'}
        {!hasSelection && currentTool === 'wall' && 'Настройки стены'}
        {!hasSelection && currentTool === 'door' && 'Настройки двери'}
        {!hasSelection && currentTool === 'window' && 'Настройки окна'}
        {!hasSelection && currentTool === 'device' && 'Каталог устройств'}
        {!hasSelection && currentTool === 'cable' && 'Настройки кабеля'}
      </div>
      {/* TODO: детальные свойства */}
    </div>
  )
}
