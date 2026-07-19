/**
 * Расчёт молниезащиты по СО-153-34.21.122-2003.
 */

export interface LightningProtectionResult {
  category: 'I' | 'II' | 'III' | 'IV'
  required: boolean
  rodCount: number
  rodHeight: number
  protectionZone: number // радиус зоны защиты, м
}

/**
 * Определение категории молниезащиты по типу здания.
 */
export function getLightningCategory(
  buildingType: 'residential' | 'office' | 'industrial' | 'warehouse',
  fireZone: 'P-I' | 'P-II' | 'P-IIa' | 'P-III' = 'P-III'
): 'I' | 'II' | 'III' | 'IV' {
  if (fireZone === 'P-I') return 'I'
  if (fireZone === 'P-II' || fireZone === 'P-IIa') return 'II'
  if (buildingType === 'industrial' || buildingType === 'warehouse') return 'II'
  return 'III'
}

/**
 * Расчёт зоны защиты стержневого молниеотвода.
 */
export function calculateProtectionZone(rodHeight: number): number {
  // Упрощённый расчёт по формуле защитного конуса
  return rodHeight * 1.5
}

/**
 * Расчёт молниезащиты.
 */
export function calculateLightningProtection(
  buildingType: 'residential' | 'office' | 'industrial' | 'warehouse',
  buildingHeight: number,
  buildingArea: number,
  fireZone: 'P-I' | 'P-II' | 'P-IIa' | 'P-III' = 'P-III'
): LightningProtectionResult {
  const category = getLightningCategory(buildingType, fireZone)

  // Определяем необходимость молниезащиты
  const required = category !== 'IV' && buildingArea > 100

  // Расчёт количества молниеотводов
  const baseCount = Math.ceil(Math.sqrt(buildingArea) / 10)
  const rodCount = Math.max(1, baseCount)

  // Расчёт высоты молниеотвода
  const rodHeight = buildingHeight + 2

  // Расчёт зоны защиты
  const protectionZone = calculateProtectionZone(rodHeight)

  return {
    category,
    required,
    rodCount,
    rodHeight,
    protectionZone,
  }
}
