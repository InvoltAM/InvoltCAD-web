import { Cable } from '../model/Cable';
import { CircuitData, ConsumerData } from './RoomConsumerEngine';

export interface CableRunSegment {
  from: { x: number; y: number };
  to: { x: number; y: number };
  lengthMm: number;
}

export interface CableRunData {
  id: string;
  circuitId?: string;
  cableId: string;
  fromDeviceId: string;
  toDeviceId: string;
  cableType: string;
  crossSectionMm2: number;
  routeM: number;      // геометрическая длина маршрута, м
  spareM: number;      // запас, м
  totalM: number;      // итоговая длина, м
  segments: CableRunSegment[];
  description?: string;
}

const DEFAULT_SPARE_RATIO = 0.1;
const MIN_SPARE_M = 0.5;

export function computeCableSpareM(routeM: number): number {
  return Math.max(routeM * DEFAULT_SPARE_RATIO, MIN_SPARE_M);
}

export function computeCableTotalM(routeM: number): number {
  return routeM + computeCableSpareM(routeM);
}

export function buildCableRuns(
  cables: Cable[],
  circuits: CircuitData[],
): CableRunData[] {
  const consumerToCircuit = new Map<string, CircuitData>();
  for (const circuit of circuits) {
    for (const consumer of circuit.consumers) {
      if (consumer.deviceId) {
        consumerToCircuit.set(consumer.deviceId, circuit);
      }
    }
  }

  return cables.map((cable) => {
    const circuit = consumerToCircuit.get(cable.toDeviceId);
    const routeM = cable.length / 1000;
    const spareM = (cable.spareLength ?? computeCableSpareM(routeM) * 1000) / 1000;
    const totalM = cable.totalLength ?? routeM + spareM;

    const segments: CableRunSegment[] = [];
    for (let i = 1; i < cable.route.length; i++) {
      const a = cable.route[i - 1];
      const b = cable.route[i];
      segments.push({
        from: { x: a.x, y: a.y },
        to: { x: b.x, y: b.y },
        lengthMm: a.distanceTo(b),
      });
    }

    return {
      id: `run-${cable.id}`,
      circuitId: circuit?.id ?? cable.circuitId,
      cableId: cable.id,
      fromDeviceId: cable.fromDeviceId,
      toDeviceId: cable.toDeviceId,
      cableType: cable.type,
      crossSectionMm2: cable.crossSection,
      routeM,
      spareM,
      totalM,
      segments,
      description: circuit ? `Линия ${circuit.name}` : undefined,
    };
  });
}

export interface CableSpecificationItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  category: 'cable' | 'conduit' | 'fitting' | 'mounting' | 'other';
}

export function buildCableSpecification(runs: CableRunData[]): CableSpecificationItem[] {
  const cableTotals = new Map<string, { type: string; section: number; totalM: number }>();

  for (const run of runs) {
    const key = `${run.cableType}-${run.crossSectionMm2}`;
    const existing = cableTotals.get(key);
    if (existing) {
      existing.totalM += run.totalM;
    } else {
      cableTotals.set(key, {
        type: run.cableType,
        section: run.crossSectionMm2,
        totalM: run.totalM,
      });
    }
  }

  const items: CableSpecificationItem[] = [];
  for (const [key, value] of cableTotals) {
    items.push({
      id: `cable-${key}`,
      name: `Кабель ${cableTypeName(value.type)} ${value.section} мм²`,
      unit: 'м',
      quantity: Math.ceil(value.totalM),
      category: 'cable',
    });
  }

  // Гофра/труба: условно 1 м на 1 м кабеля
  const totalCableM = runs.reduce((sum, r) => sum + r.totalM, 0);
  if (totalCableM > 0) {
    items.push({
      id: 'spec-conduit',
      name: 'Гофротруба / кабель-канал',
      unit: 'м',
      quantity: Math.ceil(totalCableM),
      category: 'conduit',
    });
  }

  // Клеммы/соединители: условно 2 шт на каждый кабель
  if (runs.length > 0) {
    items.push({
      id: 'spec-connectors',
      name: 'Клеммные колодки / соединители',
      unit: 'шт',
      quantity: runs.length * 2,
      category: 'fitting',
    });
  }

  return items;
}

function cableTypeName(type: string): string {
  if (type === 'power') return 'силовой';
  if (type === 'lighting') return 'освещение';
  if (type === 'low-current') return 'слаботочка';
  return type;
}
