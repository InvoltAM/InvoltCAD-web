import { Plan } from '../model/Plan'

export interface SheetLayout {
  pageSize: 'A4' | 'A3'
  orientation: 'portrait' | 'landscape'
  scale: number
  title: string
  includeSpec: boolean
  includeLegend: boolean
}

export interface SheetContent {
  svg: string
  spec: string
  legend: string
}

/**
 * Компоновка листа по ГОСТ 21.1101-2013.
 */
export function composeSheet(plan: Plan, options: SheetLayout): SheetContent {
  // Генерируем SVG плана
  const svg = generatePlanSvg(plan, options)

  // Генерируем спецификацию
  const spec = options.includeSpec ? generateSpecHtml(plan) : ''

  // Генерируем легенду
  const legend = options.includeLegend ? generateLegendHtml() : ''

  return { svg, spec, legend }
}

function generatePlanSvg(plan: Plan, options: SheetLayout): string {
  const bounds = plan.getBounds(100)
  const width = bounds.max.x - bounds.min.x
  const height = bounds.max.y - bounds.min.y

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.min.x} ${bounds.min.y} ${width} ${height}" width="${width / options.scale}mm" height="${height / options.scale}mm">
  <rect x="${bounds.min.x}" y="${bounds.min.y}" width="${width}" height="${height}" fill="white" stroke="black" stroke-width="0.5"/>
`

  // Стены
  for (const wall of plan.walls) {
    svg += `  <line x1="${wall.a.x}" y1="${wall.a.y}" x2="${wall.b.x}" y2="${wall.b.y}" stroke="black" stroke-width="${wall.thickness}" />
`
  }

  svg += '</svg>'
  return svg
}

function generateSpecHtml(plan: Plan): string {
  const wallLength = plan.walls.reduce((sum, w) => sum + w.a.distanceTo(w.b), 0)
  const doors = plan.walls.reduce((sum, w) => sum + w.openings.filter((o) => o.type === 'door').length, 0)
  const windows = plan.walls.reduce((sum, w) => sum + w.openings.filter((o) => o.type === 'window').length, 0)

  return `
<table border="1" cellpadding="4" cellspacing="0">
  <tr><th>Параметр</th><th>Значение</th></tr>
  <tr><td>Стены</td><td>${plan.walls.length} шт, ${Math.round(wallLength)} мм</td></tr>
  <tr><td>Двери</td><td>${doors} шт</td></tr>
  <tr><td>Окна</td><td>${windows} шт</td></tr>
  <tr><td>Устройства</td><td>${plan.devices.length} шт</td></tr>
  <tr><td>Кабели</td><td>${(plan.cables.reduce((sum, c) => sum + c.length, 0) / 1000).toFixed(2)} м</td></tr>
</table>
`
}

function generateLegendHtml(): string {
  return `
<table border="1" cellpadding="4" cellspacing="0">
  <tr><th colspan="2">Условные обозначения</th></tr>
  <tr><td style="background:#2563eb;color:white">🔌</td><td>Розетка</td></tr>
  <tr><td style="background:#7c3aed;color:white">💡</td><td>Выключатель</td></tr>
  <tr><td style="background:#dc2626;color:white">⚡</td><td>Щит</td></tr>
  <tr><td style="background:#ef4444">—</td><td>Силовой кабель</td></tr>
  <tr><td style="background:#f59e0b">—</td><td>Освещение</td></tr>
  <tr><td style="background:#10b981">—</td><td>Слаботочка</td></tr>
</table>
`
}
