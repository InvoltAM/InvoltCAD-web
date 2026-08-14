'use client'

import React from 'react'
import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'
import { icon } from './icons'
import { SocketIP21Symbol, SocketIP44Symbol } from './DeviceSymbols'
import type { DeviceType } from '@core/model/Device'

interface DeviceCategory {
  id: string
  label: string
  iconName: Parameters<typeof icon>[0]
}

const categories: DeviceCategory[] = [
  { id: 'socket', label: 'Розетки', iconName: 'socket' },
  { id: 'switch', label: 'Выключатель', iconName: 'switch' },
  { id: 'light', label: 'Светильник', iconName: 'light' },
  { id: 'sensor', label: 'Датчик', iconName: 'sensor' },
  { id: 'output', label: 'Вывод', iconName: 'output' },
  { id: 'camera', label: 'В.камера', iconName: 'camera' },
  { id: 'sks', label: 'СКС', iconName: 'sks' },
  { id: 'drive', label: 'Привод', iconName: 'drive' },
  { id: 'smartHome', label: 'УД', iconName: 'smartHome' },
  { id: 'panel', label: 'Щиты', iconName: 'panel' },
]

interface DeviceItem {
  type: DeviceType
  label: string
  fullName: string
  symbol: React.ReactNode
}

const devicesByCategory: Record<string, DeviceItem[]> = {
  socket: [
    {
      type: 'socket-ip21',
      label: 'Розетка IP21',
      fullName: 'Розетка 220В IP21 2Р+РЕ скрытой установки',
      symbol: <SocketIP21Symbol className="device-palette-symbol" />,
    },
    {
      type: 'socket-ip44',
      label: 'Розетка IP44',
      fullName: 'Розетка 220В IP44 2Р+РЕ скрытой установки',
      symbol: <SocketIP44Symbol className="device-palette-symbol" />,
    },
  ],
}

export default function DevicePalettePanel() {
  const [view, setView] = React.useState<string | null>(null)
  const setSelectedDeviceType = useCadStore((s) => s.setSelectedDeviceType)
  const setTool = useCadStore((s) => s.setTool)
  const selectedDeviceType = useCadStore((s) => s.selectedDeviceType)
  const { engineRef } = useEditor()

  const handleSelectDevice = (type: DeviceType) => {
    setSelectedDeviceType(type)
    setTool('device')
    // Форсируем переактивацию инструмента, чтобы ghost и state обновились
    // даже если currentTool уже 'device'
    engineRef.current?.setTool('device')
  }

  return (
    <div className="device-palette-panel">
      {view === null ? (
        <div className="device-palette-grid">
          <button
            className="device-palette-editor-btn"
            onClick={() => alert('Редактор устройств — в разработке')}
            title="Редактор устройств"
          >
            Редактор устройств
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className="device-palette-btn"
              onClick={() => setView(cat.id)}
              title={cat.label}
            >
              <span
                className="ui-icon device-palette-icon"
                dangerouslySetInnerHTML={{ __html: icon(cat.iconName) }}
              />
              <span className="device-palette-label">{cat.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="device-palette-device-view">
          <button className="device-palette-back-btn" onClick={() => setView(null)}>
            ← Назад
          </button>
          <div className="device-palette-grid">
            {(devicesByCategory[view] ?? []).map((item) => (
              <button
                key={item.type}
                className={`device-palette-btn ${selectedDeviceType === item.type ? 'active' : ''}`}
                onClick={() => handleSelectDevice(item.type)}
                title={item.fullName}
              >
                {item.symbol}
                <span className="device-palette-label">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
