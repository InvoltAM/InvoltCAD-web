import { Plan } from '../model/Plan'
import { CABLE_TYPES } from '../model/Cable'
import { findDeviceCatalogItem } from '../model/Device'

/**
 * Экспорт спецификации и кабельного журнала в XLSX (Excel).
 */
export async function exportToXlsx(plan: Plan, filename = 'involtcad-spec.xlsx'): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ExcelJS = require('exceljs')
  const workbook = new ExcelJS.Workbook()

  // Лист спецификации
  const specSheet = workbook.addWorksheet('Спецификация')

  // Заголовки
  specSheet.columns = [
    { header: 'Позиция', key: 'position', width: 10 },
    { header: 'Наименование', key: 'name', width: 30 },
    { header: 'Количество', key: 'quantity', width: 12 },
    { header: 'Единица', key: 'unit', width: 10 },
    { header: 'Примечание', key: 'note', width: 20 },
  ]

  // Стены
  if (plan.walls.length > 0) {
    const wallLength = plan.walls.reduce((sum, w) => sum + w.a.distanceTo(w.b), 0)
    specSheet.addRow({
      position: 1,
      name: 'Стены',
      quantity: plan.walls.length,
      unit: 'шт',
      note: `${Math.round(wallLength)} мм`,
    })
  }

  // Проёмы
  const doors = plan.walls.reduce((sum, w) => sum + w.openings.filter((o) => o.type === 'door').length, 0)
  const windows = plan.walls.reduce((sum, w) => sum + w.openings.filter((o) => o.type === 'window').length, 0)
  if (doors > 0) {
    specSheet.addRow({
      position: 2,
      name: 'Двери',
      quantity: doors,
      unit: 'шт',
      note: '',
    })
  }
  if (windows > 0) {
    specSheet.addRow({
      position: 3,
      name: 'Окна',
      quantity: windows,
      unit: 'шт',
      note: '',
    })
  }

  // Устройства
  const devicesByType = new Map<string, number>()
  for (const device of plan.devices) {
    devicesByType.set(device.type, (devicesByType.get(device.type) ?? 0) + 1)
  }
  let position = 4
  for (const [type, count] of devicesByType) {
    const item = findDeviceCatalogItem(type as any)
    specSheet.addRow({
      position: position++,
      name: item?.label ?? type,
      quantity: count,
      unit: 'шт',
      note: '',
    })
  }

  // Кабели
  const cablesByType = new Map<string, { count: number; length: number }>()
  for (const cable of plan.cables) {
    const key = `${CABLE_TYPES[cable.type]} ${cable.crossSection} мм²`
    const existing = cablesByType.get(key) ?? { count: 0, length: 0 }
    existing.count++
    existing.length += cable.length
    cablesByType.set(key, existing)
  }
  for (const [key, val] of cablesByType) {
    specSheet.addRow({
      position: position++,
      name: key,
      quantity: (val.length / 1000).toFixed(2),
      unit: 'м',
      note: `${val.count} шт`,
    })
  }

  // Лист кабельного журнала
  const cableSheet = workbook.addWorksheet('Кабельный журнал')
  cableSheet.columns = [
    { header: '№', key: 'number', width: 5 },
    { header: 'От', key: 'from', width: 15 },
    { header: 'К', key: 'to', width: 15 },
    { header: 'Тип', key: 'type', width: 15 },
    { header: 'Сечение', key: 'section', width: 10 },
    { header: 'Длина', key: 'length', width: 10 },
    { header: 'Длина с запасом', key: 'totalLength', width: 15 },
  ]

  plan.cables.forEach((cable, index) => {
    cableSheet.addRow({
      number: index + 1,
      from: cable.fromDeviceId,
      to: cable.toDeviceId,
      type: CABLE_TYPES[cable.type],
      section: cable.crossSection,
      length: (cable.length / 1000).toFixed(2),
      totalLength: cable.totalLength ? (cable.totalLength / 1000).toFixed(2) : '',
    })
  })

  // Скачивание файла
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
