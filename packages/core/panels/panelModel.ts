export interface PanelDevice {
  id: string
  type: 'breaker' | 'rcd' | 'contactor' | 'relay' | 'terminal' | 'busbar'
  name: string
  rating: number // номинал в амперах
  poles: 1 | 2 | 3 | 4
  width: number // ширина в модулях (1 модуль = 18 мм)
}

export interface DinRail {
  id: string
  index: number
  devices: PanelDevice[]
  maxModules: number // максимальное количество модулей на рейке
}

export interface Panel {
  id: string
  name: string
  rows: DinRail[]
  totalModules: number
  usedModules: number
}

/**
 * Автокомпоновка устройств на DIN-рейках.
 */
export function layoutPanel(devices: PanelDevice[], modulesPerRail = 18): Panel {
  const rows: DinRail[] = []
  let currentRow: DinRail = {
    id: `rail-${rows.length}`,
    index: rows.length,
    devices: [],
    maxModules: modulesPerRail,
  }

  let usedModules = 0

  for (const device of devices) {
    if (usedModules + device.width > modulesPerRail) {
      // Начинаем новую рейку
      rows.push(currentRow)
      currentRow = {
        id: `rail-${rows.length}`,
        index: rows.length,
        devices: [],
        maxModules: modulesPerRail,
      }
      usedModules = 0
    }

    currentRow.devices.push(device)
    usedModules += device.width
  }

  // Добавляем последнюю рейку
  if (currentRow.devices.length > 0) {
    rows.push(currentRow)
  }

  const totalModules = rows.reduce((sum, row) => sum + row.devices.reduce((s, d) => s + d.width, 0), 0)

  return {
    id: 'panel-1',
    name: 'Щит',
    rows,
    totalModules: rows.length * modulesPerRail,
    usedModules: totalModules,
  }
}

/**
 * Генерация устройств щита из ОЛС/кабельного журнала.
 */
export function generatePanelDevices(groupCount: number): PanelDevice[] {
  const devices: PanelDevice[] = []

  // Вводной автомат
  devices.push({
    id: 'input-breaker',
    type: 'breaker',
    name: 'Вводной автомат',
    rating: 40,
    poles: 2,
    width: 2,
  })

  // УЗО
  devices.push({
    id: 'rcd',
    type: 'rcd',
    name: 'УЗО',
    rating: 40,
    poles: 2,
    width: 2,
  })

  // Автоматы групп
  for (let i = 0; i < groupCount; i++) {
    devices.push({
      id: `breaker-${i}`,
      type: 'breaker',
      name: `Автомат группы ${i + 1}`,
      rating: 16,
      poles: 1,
      width: 1,
    })
  }

  // Шины
  devices.push({
    id: 'busbar-n',
    type: 'busbar',
    name: 'Шина N',
    rating: 0,
    poles: 1,
    width: 2,
  })

  devices.push({
    id: 'busbar-pe',
    type: 'busbar',
    name: 'Шина PE',
    rating: 0,
    poles: 1,
    width: 2,
  })

  return devices
}
