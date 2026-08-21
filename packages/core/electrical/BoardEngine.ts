import { CircuitData } from './RoomConsumerEngine';

export interface BoardComponent {
  id: string;
  type: 'input-breaker' | 'rcd' | 'breaker' | 'contactor' | 'bus' | 'meter';
  name: string;
  ratingA?: number;
  breakingCapacityKa?: number;
  characteristic?: 'B' | 'C' | 'D';
  rcdType?: 'AC' | 'A' | 'S';
  rcdMA?: number;
  widthModules: number;
  phase: 'L1' | 'L2' | 'L3';
  circuitIds: string[];
}

export interface DistributionBoardData {
  id: string;
  name: string;
  voltage: number;
  phases: 'single' | 'three';
  inBreakerA: number;
  inBreakerType: 'B' | 'C' | 'D';
  rcdIn: boolean;
  rcdInMA?: number;
  rcdInType?: 'AC' | 'A' | 'S';
  dinModules: number;
  components: BoardComponent[];
  circuits: CircuitData[];
  totalPowerW: number;
  totalCurrentA: number;
  recommendedEnclosure: string;
  priceLevel: 'budget' | 'standard' | 'premium';
}

export interface BoardOptions {
  phases?: 'single' | 'three';
  voltage?: number;
  priceLevel?: 'budget' | 'standard' | 'premium';
  withMainRcd?: boolean;
  withGroupRcd?: boolean;
}

function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

export function buildDistributionBoard(
  circuits: CircuitData[],
  options: BoardOptions = {}
): DistributionBoardData {
  const phases = options.phases ?? 'single';
  const voltage = options.voltage ?? (phases === 'three' ? 400 : 230);
  const priceLevel = options.priceLevel ?? 'standard';
  const withMainRcd = options.withMainRcd ?? true;
  const withGroupRcd = options.withGroupRcd ?? false;

  const totalPowerW = circuits.reduce((sum, c) => {
    return sum + c.consumers.reduce((cs, cons) => cs + cons.powerW * cons.count * cons.demandRatio, 0);
  }, 0);

  const lineVoltage = phases === 'three' ? 400 : 230;
  const totalCurrentA = totalPowerW / lineVoltage / (phases === 'three' ? Math.sqrt(3) : 1);
  const inBreakerA = roundUpTo(Math.max(25, totalCurrentA * 1.25), 5);
  const inBreakerType: 'B' | 'C' | 'D' = totalCurrentA > 40 ? 'C' : 'B';

  const components: BoardComponent[] = [];

  // Main breaker: 2 modules for single phase, 3 for three phase (or 4-pole)
  components.push({
    id: 'input-breaker',
    type: 'input-breaker',
    name: `Вводной автомат ${inBreakerA}А`,
    ratingA: inBreakerA,
    characteristic: inBreakerType,
    breakingCapacityKa: 6,
    widthModules: phases === 'three' ? 3 : 2,
    phase: 'L1',
    circuitIds: circuits.map((c) => c.id),
  });

  // Main RCD (optional, 2 modules single / 4 modules three)
  if (withMainRcd) {
    const rcdMA = phases === 'three' ? 300 : 100;
    components.push({
      id: 'main-rcd',
      type: 'rcd',
      name: `УЗО вводное ${rcdMA}мА`,
      rcdType: 'A',
      rcdMA,
      widthModules: phases === 'three' ? 4 : 2,
      phase: 'L1',
      circuitIds: circuits.map((c) => c.id),
    });
  }

  // Group breakers (and RCDs if requested)
  for (const circuit of circuits) {
    const breaker: BoardComponent = {
      id: `breaker-${circuit.id}`,
      type: 'breaker',
      name: `${circuit.name} ${circuit.ratedCurrentA}А`,
      ratingA: circuit.ratedCurrentA,
      characteristic: circuit.breakerType as 'B' | 'C' | 'D',
      widthModules: phases === 'three' ? 3 : 1,
      phase: circuit.phase,
      circuitIds: [circuit.id],
    };
    components.push(breaker);

    if (withGroupRcd && (circuit.type === 'socket' || circuit.type === 'appliance')) {
      components.push({
        id: `rcd-${circuit.id}`,
        type: 'rcd',
        name: `УЗО ${circuit.ratedCurrentA}А 30мА`,
        ratingA: circuit.ratedCurrentA,
        rcdType: 'A',
        rcdMA: 30,
        widthModules: phases === 'three' ? 4 : 2,
        phase: circuit.phase,
        circuitIds: [circuit.id],
      });
    }
  }

  const totalModules = components.reduce((sum, c) => sum + c.widthModules, 0);
  // Reserve ~20% for future + bus gaps
  const dinModules = roundUpTo(Math.ceil(totalModules * 1.2), 12);
  const recommendedEnclosure = pickEnclosure(dinModules, priceLevel);

  return {
    id: crypto.randomUUID(),
    name: 'Распределительный щит',
    voltage,
    phases,
    inBreakerA,
    inBreakerType,
    rcdIn: withMainRcd,
    rcdInMA: withMainRcd ? (phases === 'three' ? 300 : 100) : undefined,
    rcdInType: withMainRcd ? 'A' : undefined,
    dinModules,
    components,
    circuits,
    totalPowerW,
    totalCurrentA,
    recommendedEnclosure,
    priceLevel,
  };
}

function pickEnclosure(modules: number, level: 'budget' | 'standard' | 'premium'): string {
  if (modules <= 12) return level === 'budget' ? 'Корпус 12 модулей' : 'Щит 12 модулей';
  if (modules <= 24) return 'Щит 24 модуля';
  if (modules <= 36) return 'Щит 36 модулей';
  if (modules <= 48) return 'Щит 48 модулей';
  if (modules <= 60) return 'Щит 60 модулей';
  return 'Щит 72 модуля';
}

export function balancePhases(circuits: CircuitData[]): CircuitData[] {
  // Simple round-robin phase assignment for three-phase boards
  const phases: Array<'L1' | 'L2' | 'L3'> = ['L1', 'L2', 'L3'];
  return circuits.map((c, i) => ({ ...c, phase: phases[i % 3] }));
}
