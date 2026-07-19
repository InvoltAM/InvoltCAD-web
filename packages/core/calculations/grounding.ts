/**
 * Расчёт заземления по ПУЭ (глава 1.7).
 */

export interface GroundingResult {
  soilResistivity: number // удельное сопротивление грунта, Ом·м
  electrodeType: 'rod' | 'strip' | 'plate'
  electrodeCount: number
  totalResistance: number // общее сопротивление заземления, Ом
  requiredResistance: number // требуемое сопротивление, Ом
  compliant: boolean
}

const SOIL_RESISTIVITY: Record<string, number> = {
  sand: 500,
  sandyLoam: 300,
  loam: 100,
  clay: 50,
  peat: 20,
}

const REQUIRED_RESISTANCE: Record<string, number> = {
  residential: 4,
  lightning: 10,
  industrial: 4,
}

/**
 * Расчёт сопротивления растекания для вертикального стержня.
 */
function rodResistance(length: number, diameter: number, soilResistivity: number): number {
  return (soilResistivity / (2 * Math.PI * length)) * (Math.log(4 * length / diameter) - 1)
}

/**
 * Расчёт сопротивления растекания для горизонтальной полосы.
 */
function stripResistance(length: number, width: number, depth: number, soilResistivity: number): number {
  return (soilResistivity / (2 * Math.PI * length)) * Math.log(2 * length * length / (width * depth))
}

/**
 * Расчёт заземления.
 */
export function calculateGrounding(
  soilType: keyof typeof SOIL_RESISTIVITY,
  buildingType: keyof typeof REQUIRED_RESISTANCE,
  electrodeType: 'rod' | 'strip' | 'plate' = 'rod',
  electrodeLength = 2.5,
  electrodeDiameter = 0.016,
  electrodeCount = 3
): GroundingResult {
  const soilResistivity = SOIL_RESISTIVITY[soilType]
  const requiredResistance = REQUIRED_RESISTANCE[buildingType]

  let singleResistance: number

  if (electrodeType === 'rod') {
    singleResistance = rodResistance(electrodeLength, electrodeDiameter, soilResistivity)
  } else if (electrodeType === 'strip') {
    singleResistance = stripResistance(electrodeLength, 0.04, 0.7, soilResistivity)
  } else {
    // plate
    singleResistance = (soilResistivity / 4) * Math.sqrt(Math.PI / (electrodeLength * electrodeLength))
  }

  // Общее сопротивление с учётом коэффициента использования
  const utilizationFactor = electrodeCount <= 3 ? 0.85 : electrodeCount <= 5 ? 0.8 : 0.75
  const totalResistance = singleResistance / (electrodeCount * utilizationFactor)

  return {
    soilResistivity,
    electrodeType,
    electrodeCount,
    totalResistance,
    requiredResistance,
    compliant: totalResistance <= requiredResistance,
  }
}
