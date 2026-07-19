import { Plan } from '../model/Plan'
import { wallPolyline } from '../model/Wall'
import { CABLE_TYPES } from '../model/Cable'
import { findDeviceCatalogItem } from '../model/Device'

/**
 * Экспорт плана в SVG.
 */
export function exportToSvg(plan: Plan, filename = 'involtcad-plan.svg'): void {
  const bounds = plan.getBounds(100)
  const width = bounds.max.x - bounds.min.x
  const height = bounds.max.y - bounds.min.y

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.min.x} ${bounds.min.y} ${width} ${height}" width="${width}mm" height="${height}mm">
  <defs>
    <style>
      .wall { fill: none; stroke: #3a3a3a; stroke-width: 2; }
      .opening { fill: #fff; stroke: #3a3a3a; stroke-width: 1; }
      .device { fill: #fff; stroke: #2563eb; stroke-width: 1; }
      .cable { fill: none; stroke-width: 2; }
      .room { fill: rgba(200, 210, 200, 0.3); stroke: none; }
      .dimension { fill: none; stroke: #1a1a1a; stroke-width: 1; }
      .text { font-family: sans-serif; font-size: 12px; fill: #1a1a1a; }
    </style>
  </defs>
`

  // Комнаты
  for (const room of plan.getRooms()) {
    const points = room.polygon.map((p) => `${p.x},${p.y}`).join(' ')
    svg += `  <polygon class="room" points="${points}" />\n`
  }

  // Стены
  for (const wall of plan.walls) {
    const polyline = wallPolyline(wall, 50)
    const points = polyline.map((p) => `${p.x},${p.y}`).join(' ')
    svg += `  <polyline class="wall" points="${points}" stroke-width="${wall.thickness}" />\n`
  }

  // Проёмы
  for (const wall of plan.walls) {
    const wallLen = wall.a.distanceTo(wall.b)
    const dir = wall.b.sub(wall.a).normalized()
    for (const opening of wall.openings) {
      const center = wall.a.add(dir.scale(opening.t * wallLen))
      const w = opening.width
      const h = wall.thickness
      svg += `  <rect class="opening" x="${center.x - w / 2}" y="${center.y - h / 2}" width="${w}" height="${h}" />\n`
    }
  }

  // Устройства
  for (const device of plan.devices) {
    const pos = plan.deviceWorldPosition(device)
    const item = findDeviceCatalogItem(device.type)
    const size = item ? Math.max(item.width, item.height) : 50
    svg += `  <rect class="device" x="${pos.x - size / 2}" y="${pos.y - size / 2}" width="${size}" height="${size}" />\n`
    svg += `  <text class="text" x="${pos.x}" y="${pos.y + size}" text-anchor="middle">${device.name}</text>\n`
  }

  // Кабели
  for (const cable of plan.cables) {
    const color = cable.type === 'power' ? '#ef4444' : cable.type === 'lighting' ? '#f59e0b' : '#10b981'
    const points = cable.route.map((p) => `${p.x},${p.y}`).join(' ')
    svg += `  <polyline class="cable" points="${points}" stroke="${color}" />\n`
  }

  // Размеры
  for (const dim of plan.dimensions) {
    svg += `  <line class="dimension" x1="${dim.a.x}" y1="${dim.a.y}" x2="${dim.b.x}" y2="${dim.b.y}" />\n`
    const mid = dim.a.add(dim.b).scale(0.5)
    svg += `  <text class="text" x="${mid.x}" y="${mid.y - 10}" text-anchor="middle">${dim.text ?? Math.round(dim.length)}</text>\n`
  }

  svg += '</svg>'

  // Скачивание файла
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
