'use client'

import React, { useEffect, useRef, useState } from 'react'
import { icon } from './icons'

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
]

export default function DevicePalettePanel() {
  const [openId, setOpenId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openId) return
    const handleDocClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) {
        setOpenId(null)
      }
    }
    document.addEventListener('click', handleDocClick)
    return () => document.removeEventListener('click', handleDocClick)
  }, [openId])

  return (
    <div ref={panelRef} className="device-palette-panel">
      <div className="device-palette-grid">
        <button
          className="device-palette-editor-btn"
          onClick={() => alert('Редактор устройств — в разработке')}
          title="Редактор устройств"
        >
          Редактор устройств
        </button>
        {categories.map((cat) => {
          const isOpen = openId === cat.id
          return (
            <div key={cat.id} className="device-palette-group">
              <button
                className={`device-palette-btn ${isOpen ? 'active' : ''}`}
                onClick={() => setOpenId(isOpen ? null : cat.id)}
                title={cat.label}
              >
                <span
                  className="ui-icon device-palette-icon"
                  dangerouslySetInnerHTML={{ __html: icon(cat.iconName) }}
                />
                <span className="device-palette-label">{cat.label}</span>
              </button>
              {isOpen && (
                <div className="device-palette-submenu">
                  <div className="device-palette-submenu-empty">В разработке</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
