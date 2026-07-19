/**
 * Load calculation per СП 256.1325800.2016 (Electrical installations of residential and public buildings).
 *
 * Calculates installed power, design power, and design current for consumers,
 * groups, and panels using demand factors (Кс) and simultaneity factors (Ко).
 */

export type BuildingType = 'residential' | 'office' | 'commercial' | 'industrial'
export type ConsumerType = 'socket' | 'light' | 'appliance' | 'heater' | 'motor' | 'stove' | 'waterHeater' | 'washingMachine' | 'airConditioner'

export interface LoadConsumer {
  id: string
  name: string
  type: ConsumerType
  installedPowerKw: number
  cosPhi: number
  quantity: number
  roomId?: string
  groupId?: string
}

export interface LoadGroup {
  id: string
  name: string
  type: 'socket' | 'light' | 'power' | 'mixed'
  consumers: LoadConsumer[]
  demandFactor: number
  simultaneityFactor: number
  totalInstalledPower: number
  designPower: number
  designCurrent: number
  peakCurrent: number
  voltageV: number
  phaseCount: 1 | 3
}

export interface PanelLoad {
  panelId: string
  groups: LoadGroup[]
  totalInstalledPower: number
  totalDesignPower: number
  totalDesignCurrent: number
  inputCurrent: number
  demandFactor: number
}

// ─── Demand factors (Кс) per SP 256, Table 7 ───
const DEMAND_FACTORS: Record<BuildingType, Partial<Record<ConsumerType, number>>> = {
  residential: {
    socket: 0.4,
    light: 0.7,
    stove: 0.7,
    waterHeater: 0.7,
    washingMachine: 0.5,
    airConditioner: 0.7,
    heater: 0.7,
    appliance: 0.6,
    motor: 0.75,
  },
  office: {
    socket: 0.6,
    light: 0.9,
    heater: 0.8,
    appliance: 0.7,
    motor: 0.75,
  },
  commercial: {
    socket: 0.7,
    light: 0.95,
    heater: 0.8,
    appliance: 0.8,
    motor: 0.75,
  },
  industrial: {
    socket: 0.5,
    light: 0.85,
    heater: 0.8,
    appliance: 0.7,
    motor: 0.7,
  },
}

// ─── Simultaneity factors (Ко) by consumer count ───
const SIMULTANEITY_SOCKET = [
  { max: 5, factor: 1.0 },
  { max: 10, factor: 0.8 },
  { max: 20, factor: 0.7 },
  { max: Infinity, factor: 0.6 },
]

const SIMULTANEITY_LIGHT = [
  { max: 10, factor: 1.0 },
  { max: 20, factor: 0.9 },
  { max: Infinity, factor: 0.8 },
]

const SIMULTANEITY_POWER = [
  { max: 3, factor: 1.0 },
  { max: 6, factor: 0.85 },
  { max: Infinity, factor: 0.75 },
]

// ─── Default power factors ───
const DEFAULT_COS_PHI: Record<ConsumerType, number> = {
  socket: 0.95,
  light: 0.95,
  appliance: 0.9,
  heater: 1.0,
  motor: 0.75,
  stove: 1.0,
  waterHeater: 1.0,
  washingMachine: 0.9,
  airConditioner: 0.8,
}

// ─── Default installed power per consumer (kW) ───
const DEFAULT_POWER_KW: Partial<Record<ConsumerType, number>> = {
  socket: 0.1,      // per socket
  light: 0.06,      // 60W typical
  stove: 7.0,       // electric stove
  waterHeater: 2.0, // boiler
  washingMachine: 2.2,
  airConditioner: 1.5,
  heater: 1.5,
  appliance: 0.5,
  motor: 0.75,
}

function getSimultaneityFactor(count: number, type: 'socket' | 'light' | 'power'): number {
  const table = type === 'socket' ? SIMULTANEITY_SOCKET : type === 'light' ? SIMULTANEITY_LIGHT : SIMULTANEITY_POWER
  for (const row of table) {
    if (count <= row.max) return row.factor
  }
  return table[table.length - 1].factor
}

function getDemandFactor(consumerType: ConsumerType, buildingType: BuildingType): number {
  return DEMAND_FACTORS[buildingType]?.[consumerType] ?? 0.6
}

function getCosPhi(consumerType: ConsumerType): number {
  return DEFAULT_COS_PHI[consumerType] ?? 0.9
}

function getDefaultPower(consumerType: ConsumerType): number {
  return DEFAULT_POWER_KW[consumerType] ?? 0.1
}

/**
 * Map placed plan blocks to load consumers.
 * Uses block definitionId to determine consumer type and default power.
 */
export function blocksToConsumers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  placedBlocks: Array<{ id: string; definitionId: string; properties?: Record<string, any> }>,
  _buildingType: BuildingType = 'residential'
): LoadConsumer[] {
  const consumers: LoadConsumer[] = []

  for (const block of placedBlocks) {
    let type: ConsumerType = 'appliance'
    let power = 0
    let cosPhi = 0.9
    let name = block.definitionId

    // Map block categories to consumer types
    if (block.definitionId.includes('socket')) {
      type = 'socket'
      power = getDefaultPower('socket')
      cosPhi = getCosPhi('socket')
      name = 'Розетка'
    } else if (block.definitionId.includes('light')) {
      type = 'light'
      power = getDefaultPower('light')
      cosPhi = getCosPhi('light')
      name = 'Светильник'
    } else if (block.definitionId.includes('panel')) {
      continue // Panels are sources, not consumers at this level
    } else if (block.definitionId.includes('switch')) {
      continue // Switches don't consume power
    } else {
      type = 'appliance'
      power = getDefaultPower('appliance')
      cosPhi = getCosPhi('appliance')
    }

    // Override from block properties if available
    if (block.properties?.power) {
      const p = String(block.properties.power)
      const match = p.match(/(\d+(?:\.\d+)?)/)
      if (match) {
        const val = parseFloat(match[1])
        power = p.includes('kW') || p.includes('кВт') ? val : val / 1000
      }
    }

    consumers.push({
      id: block.id,
      name,
      type,
      installedPowerKw: power,
      cosPhi,
      quantity: 1,
    })
  }

  return consumers
}

/**
 * Group consumers by type and create load groups.
 * Typical grouping: socket groups (max 10), light groups (max 20), individual power consumers.
 */
export function groupConsumers(
  consumers: LoadConsumer[],
  buildingType: BuildingType = 'residential',
  voltageV: number = 230,
  phaseCount: 1 | 3 = 1
): LoadGroup[] {
  const groups: LoadGroup[] = []

  // Separate by type
  const sockets = consumers.filter((c) => c.type === 'socket')
  const lights = consumers.filter((c) => c.type === 'light')
  const powerConsumers = consumers.filter((c) => !['socket', 'light'].includes(c.type))

  // Group sockets: max 10 per group
  const socketGroupSize = 10
  for (let i = 0; i < sockets.length; i += socketGroupSize) {
    const groupConsumers = sockets.slice(i, i + socketGroupSize)
    const groupNum = Math.floor(i / socketGroupSize) + 1
    groups.push(calculateGroup(`Гр.р.${groupNum}`, 'socket', groupConsumers, buildingType, voltageV, phaseCount))
  }

  // Group lights: max 20 per group
  const lightGroupSize = 20
  for (let i = 0; i < lights.length; i += lightGroupSize) {
    const groupConsumers = lights.slice(i, i + lightGroupSize)
    const groupNum = Math.floor(i / lightGroupSize) + 1
    groups.push(calculateGroup(`Гр.о.${groupNum}`, 'light', groupConsumers, buildingType, voltageV, phaseCount))
  }

  // Power consumers: individual groups or combined
  if (powerConsumers.length > 0) {
    // For simplicity, put all power consumers in one group
    groups.push(calculateGroup('Гр.сил.', 'power', powerConsumers, buildingType, voltageV, phaseCount))
  }

  return groups
}

function calculateGroup(
  name: string,
  type: 'socket' | 'light' | 'power' | 'mixed',
  consumers: LoadConsumer[],
  buildingType: BuildingType,
  voltageV: number,
  phaseCount: 1 | 3
): LoadGroup {
  const totalCount = consumers.reduce((sum, c) => sum + c.quantity, 0)
  const totalInstalledPower = consumers.reduce((sum, c) => sum + c.installedPowerKw * c.quantity, 0)

  // Weighted demand factor
  let weightedDemandSum = 0
  for (const c of consumers) {
    const ks = getDemandFactor(c.type, buildingType)
    weightedDemandSum += c.installedPowerKw * c.quantity * ks
  }
  const demandFactor = totalInstalledPower > 0 ? weightedDemandSum / totalInstalledPower : 0

  // Simultaneity factor
  const simultaneityFactor = getSimultaneityFactor(totalCount, type === 'mixed' ? 'power' : type)

  // Design power
  const designPower = totalInstalledPower * demandFactor * simultaneityFactor

  // Weighted cos phi
  let weightedCosSum = 0
  for (const c of consumers) {
    weightedCosSum += c.installedPowerKw * c.quantity * c.cosPhi
  }
  const cosPhi = totalInstalledPower > 0 ? weightedCosSum / totalInstalledPower : 0.95

  // Design current
  let designCurrent: number
  if (phaseCount === 3) {
    designCurrent = designPower * 1000 / (Math.sqrt(3) * voltageV * cosPhi)
  } else {
    designCurrent = designPower * 1000 / (voltageV * cosPhi)
  }

  // Peak current (assume 1.4x for motor starting or inrush)
  const hasMotor = consumers.some((c) => c.type === 'motor')
  const peakCurrent = hasMotor ? designCurrent * 1.4 : designCurrent * 1.1

  return {
    id: `group-${name}`,
    name,
    type,
    consumers,
    demandFactor,
    simultaneityFactor,
    totalInstalledPower,
    designPower,
    designCurrent,
    peakCurrent,
    voltageV,
    phaseCount,
  }
}

/**
 * Calculate panel load from groups.
 */
export function calculatePanelLoad(
  panelId: string,
  groups: LoadGroup[],
  voltageV: number = 230,
  phaseCount: 1 | 3 = 1
): PanelLoad {
  const totalInstalledPower = groups.reduce((sum, g) => sum + g.totalInstalledPower, 0)
  const totalDesignPower = groups.reduce((sum, g) => sum + g.designPower, 0)

  // Panel demand factor
  const demandFactor = totalInstalledPower > 0 ? totalDesignPower / totalInstalledPower : 0

  // Weighted cos phi for panel
  let weightedCosSum = 0
  let totalPower = 0
  for (const g of groups) {
    const groupCos = g.consumers.reduce((s, c) => s + c.installedPowerKw * c.quantity * c.cosPhi, 0)
      / (g.totalInstalledPower || 1)
    weightedCosSum += g.designPower * groupCos
    totalPower += g.designPower
  }
  const cosPhi = totalPower > 0 ? weightedCosSum / totalPower : 0.95

  let totalDesignCurrent: number
  let inputCurrent: number
  if (phaseCount === 3) {
    totalDesignCurrent = totalDesignPower * 1000 / (Math.sqrt(3) * voltageV * cosPhi)
    inputCurrent = totalDesignPower * 1000 / (Math.sqrt(3) * 400 * cosPhi)
  } else {
    totalDesignCurrent = totalDesignPower * 1000 / (voltageV * cosPhi)
    inputCurrent = totalDesignCurrent
  }

  return {
    panelId,
    groups,
    totalInstalledPower,
    totalDesignPower,
    totalDesignCurrent,
    inputCurrent,
    demandFactor,
  }
}

/**
 * Full pipeline: placed blocks → consumers → groups → panel load.
 */
export function calculateLoads(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  placedBlocks: Array<{ id: string; definitionId: string; properties?: Record<string, any> }>,
  options: {
    buildingType?: BuildingType
    voltageV?: number
    phaseCount?: 1 | 3
    panelId?: string
  } = {}
): PanelLoad {
  const {
    buildingType = 'residential',
    voltageV = 230,
    phaseCount = 1,
    panelId = 'panel-1',
  } = options

  const consumers = blocksToConsumers(placedBlocks, buildingType)
  const groups = groupConsumers(consumers, buildingType, voltageV, phaseCount)
  return calculatePanelLoad(panelId, groups, voltageV, phaseCount)
}

/**
 * Get recommended group names based on SP 256 conventions.
 */
export function getRecommendedGroupName(type: 'socket' | 'light' | 'power', index: number): string {
  const prefixes = { socket: 'Гр.р.', light: 'Гр.о.', power: 'Гр.сил.' }
  return `${prefixes[type]}${index}`
}

/**
 * Check if a group exceeds SP 256 limits.
 */
export function checkGroupLimits(group: LoadGroup): Array<{ type: 'warning' | 'error'; message: string }> {
  const issues: Array<{ type: 'warning' | 'error'; message: string }> = []

  const count = group.consumers.reduce((s, c) => s + c.quantity, 0)

  if (group.type === 'socket' && count > 10) {
    issues.push({ type: 'warning', message: `В группе ${group.name} более 10 розеток (${count}). Рекомендуется разделить.` })
  }
  if (group.type === 'light' && count > 20) {
    issues.push({ type: 'warning', message: `В группе ${group.name} более 20 светильников (${count}). Рекомендуется разделить.` })
  }
  if (group.designCurrent > 16) {
    issues.push({ type: 'error', message: `Расчётный ток группы ${group.name} ${group.designCurrent.toFixed(1)}А превышает 16А. Требуется увеличить сечение или разделить группу.` })
  }
  if (group.designCurrent > 25) {
    issues.push({ type: 'error', message: `Расчётный ток группы ${group.name} ${group.designCurrent.toFixed(1)}А превышает 25А. Критическое превышение!` })
  }

  return issues
}
