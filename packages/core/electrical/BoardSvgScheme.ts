import { DistributionBoardData, BoardComponent } from './BoardEngine';
import { CircuitData } from './RoomConsumerEngine';

const COLORS = {
  L1: '#ef4444',
  L2: '#f59e0b',
  L3: '#22c55e',
  N: '#3b82f6',
  PE: '#10b981',
  bus: '#6b7280',
  text: '#1f2937',
  textDark: '#e5e7eb',
};

export interface SvgSchemeOptions {
  width?: number;
  dark?: boolean;
}

function componentLabel(comp: BoardComponent): string {
  if (comp.type === 'input-breaker') return `QF ${comp.ratingA}А`;
  if (comp.type === 'rcd') return `QF+УЗО ${comp.ratingA ?? ''}А ${comp.rcdMA}мА`;
  if (comp.type === 'breaker') return `QF ${comp.ratingA}А`;
  if (comp.type === 'contactor') return `KM`;
  if (comp.type === 'meter') return `E`;
  return comp.name;
}

export function generateBoardSvg(board: DistributionBoardData, options: SvgSchemeOptions = {}): string {
  const width = options.width ?? 900;
  const dark = options.dark ?? false;
  const textColor = dark ? COLORS.textDark : COLORS.text;
  const bg = dark ? '#111827' : '#ffffff';
  const busY = 80;
  const startX = 40;
  const moduleWidth = 40;
  const moduleGap = 12;
  const groupGap = 40;

  const components = board.components;
  let x = startX;
  const componentBoxes: Array<{ comp: BoardComponent; x: number; y: number; w: number; h: number }> = [];

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 500" width="${width}" height="500" style="background:${bg};font-family:Arial,Helvetica,sans-serif">`;

  // Title
  svg += `<text x="20" y="30" fill="${textColor}" font-size="16" font-weight="bold">${board.name}</text>`;
  svg += `<text x="20" y="50" fill="${textColor}" font-size="11">${board.phases === 'three' ? '3-ф' : '1-ф'} · ${board.voltage}В · ${board.totalPowerW.toFixed(0)}Вт · ${board.recommendedEnclosure}</text>`;

  // Main horizontal bus (L1, N, PE) near top
  svg += `<line x1="20" y1="${busY}" x2="${width - 20}" y2="${busY}" stroke="${COLORS.L1}" stroke-width="3"/>`;
  svg += `<text x="20" y="${busY - 10}" fill="${COLORS.L1}" font-size="11" font-weight="bold">L1</text>`;
  if (board.phases === 'three') {
    svg += `<line x1="20" y1="${busY + 12}" x2="${width - 20}" y2="${busY + 12}" stroke="${COLORS.L2}" stroke-width="3"/>`;
    svg += `<line x1="20" y1="${busY + 24}" x2="${width - 20}" y2="${busY + 24}" stroke="${COLORS.L3}" stroke-width="3"/>`;
    svg += `<text x="20" y="${busY + 8}" fill="${COLORS.L2}" font-size="11" font-weight="bold">L2</text>`;
    svg += `<text x="20" y="${busY + 20}" fill="${COLORS.L3}" font-size="11" font-weight="bold">L3</text>`;
  }
  // Neutral and PE bus below
  svg += `<line x1="20" y1="${busY + 42}" x2="${width - 20}" y2="${busY + 42}" stroke="${COLORS.N}" stroke-width="2"/>`;
  svg += `<text x="20" y="${busY + 56}" fill="${COLORS.N}" font-size="11" font-weight="bold">N</text>`;
  svg += `<line x1="20" y1="${busY + 66}" x2="${width - 20}" y2="${busY + 66}" stroke="${COLORS.PE}" stroke-width="2" stroke-dasharray="4 4"/>`;
  svg += `<text x="20" y="${busY + 80}" fill="${COLORS.PE}" font-size="11" font-weight="bold">PE</text>`;

  for (const comp of components) {
    const w = comp.widthModules * moduleWidth;
    const h = 120;
    const y = busY + 100;

    componentBoxes.push({ comp, x, y, w, h });

    // Component box
    svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${dark ? '#1f2937' : '#f3f4f6'}" stroke="${textColor}" stroke-width="1"/>`;

    // Symbol depending on type
    const cx = x + w / 2;
    const cy = y + 45;
    if (comp.type === 'breaker' || comp.type === 'input-breaker') {
      // Circuit breaker symbol: rectangle with diagonal
      svg += `<rect x="${cx - 12}" y="${cy - 12}" width="24" height="24" fill="none" stroke="${textColor}" stroke-width="1.5"/>`;
      svg += `<line x1="${cx - 8}" y1="${cy + 8}" x2="${cx + 8}" y2="${cy - 8}" stroke="${textColor}" stroke-width="1.5"/>`;
    } else if (comp.type === 'rcd') {
      // RCD: rectangle with diagonal + test button
      svg += `<rect x="${cx - 14}" y="${cy - 14}" width="28" height="28" fill="none" stroke="${textColor}" stroke-width="1.5"/>`;
      svg += `<line x1="${cx - 8}" y1="${cy + 8}" x2="${cx + 8}" y2="${cy - 8}" stroke="${textColor}" stroke-width="1.5"/>`;
      svg += `<circle cx="${cx + 10}" cy="${cy + 10}" r="3" fill="${textColor}"/>`;
    } else {
      svg += `<circle cx="${cx}" cy="${cy}" r="14" fill="none" stroke="${textColor}" stroke-width="1.5"/>`;
    }

    // Connection from bus to component top
    const phaseColor = board.phases === 'single' ? COLORS.L1 : COLORS[comp.phase];
    svg += `<line x1="${cx}" y1="${busY + 20}" x2="${cx}" y2="${y}" stroke="${phaseColor}" stroke-width="2"/>`;

    // Label
    svg += `<text x="${cx}" y="${y + h - 35}" text-anchor="middle" fill="${textColor}" font-size="10">${componentLabel(comp)}</text>`;
    svg += `<text x="${cx}" y="${y + h - 20}" text-anchor="middle" fill="${textColor}" font-size="9">${comp.name}</text>`;

    // Circuit lines going down from each breaker
    if (comp.type === 'breaker' || comp.type === 'input-breaker') {
      const circuit = board.circuits.find((c) => c.id === comp.circuitIds[0]);
      if (circuit) {
        svg += `<line x1="${cx}" y1="${y + h}" x2="${cx}" y2="${y + h + 40}" stroke="${phaseColor}" stroke-width="2"/>`;
        svg += `<text x="${cx + 5}" y="${y + h + 28}" fill="${textColor}" font-size="10">${circuit.name}</text>`;
        svg += `<text x="${cx + 5}" y="${y + h + 42}" fill="${textColor}" font-size="9">${circuit.cableType} · ${circuit.lengthM}м</text>`;
      }
    }

    x += w + moduleGap;
  }

  // Legend
  svg += `<text x="${width - 180}" y="30" fill="${textColor}" font-size="10">QF — автоматический выключатель</text>`;
  svg += `<text x="${width - 180}" y="45" fill="${textColor}" font-size="10">УЗО — устройство защитного отключения</text>`;

  svg += `</svg>`;
  return svg;
}

export function generateOlsFromCircuits(circuits: CircuitData[], options: SvgSchemeOptions = {}): string {
  // Simpler vertical OLS for legacy compatibility
  const width = options.width ?? 900;
  const dark = options.dark ?? false;
  const textColor = dark ? COLORS.textDark : COLORS.text;
  const bg = dark ? '#111827' : '#ffffff';
  const rowHeight = 60;
  const height = 120 + circuits.length * rowHeight;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background:${bg};font-family:Arial,Helvetica,sans-serif">`;
  svg += `<text x="20" y="30" fill="${textColor}" font-size="16" font-weight="bold">Однолинейная схема</text>`;

  let y = 80;
  for (const circuit of circuits) {
    const phaseColor = COLORS[circuit.phase];
    svg += `<line x1="40" y1="${y}" x2="${width - 40}" y2="${y}" stroke="${phaseColor}" stroke-width="2"/>`;
    svg += `<rect x="60" y="${y - 12}" width="24" height="24" fill="none" stroke="${textColor}" stroke-width="1.5"/>`;
    svg += `<line x1="64" y1="${y + 8}" x2="80" y2="${y - 8}" stroke="${textColor}" stroke-width="1.5"/>`;
    svg += `<text x="100" y="${y + 5}" fill="${textColor}" font-size="12">${circuit.name} · ${circuit.ratedCurrentA}А · ${circuit.cableType} · ${circuit.lengthM}м</text>`;
    y += rowHeight;
  }

  svg += `</svg>`;
  return svg;
}
