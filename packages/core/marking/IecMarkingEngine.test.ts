import { describe, it, expect } from 'vitest';
import { buildIecLabels, detectPrefix, layoutLabelsOnA4, generateLabelsSvg, exportLabelsToCsv } from './IecMarkingEngine';

describe('IecMarkingEngine', () => {
  it('detects prefixes by device type', () => {
    expect(detectPrefix('socket')).toBe('R');
    expect(detectPrefix('switch')).toBe('S');
    expect(detectPrefix('light')).toBe('E');
    expect(detectPrefix('cable')).toBe('W');
    expect(detectPrefix('unknown')).toBe('X');
  });

  it('builds labels with sequential numbering', () => {
    const labels = buildIecLabels({
      devices: [
        { id: 'd1', type: 'socket', name: 'Розетка кухня', roomName: 'Кухня' },
        { id: 'd2', type: 'socket', name: 'Розетка спальня' },
        { id: 'd3', type: 'switch', name: 'Выключатель' },
      ],
      cables: [{ id: 'c1', type: 'power' }],
    });
    expect(labels).toHaveLength(4);
    expect(labels[0].fullName).toBe('R1.КУХ');
    expect(labels[1].fullName).toBe('R2');
    expect(labels[2].fullName).toBe('S1');
    expect(labels[3].fullName).toBe('W1');
  });

  it('lays out labels on A4 sheet', () => {
    const labels = buildIecLabels({
      devices: Array.from({ length: 10 }, (_, i) => ({ id: `d${i}`, type: 'socket', name: `R${i}` })),
    });
    const sheet = layoutLabelsOnA4(labels);
    expect(sheet.pageWidthMm).toBe(210);
    expect(sheet.pageHeightMm).toBe(297);
    expect(sheet.labels.length).toBe(10);
  });

  it('generates SVG', () => {
    const labels = buildIecLabels({
      devices: [{ id: 'd1', type: 'socket', name: 'Розетка' }],
      breakers: [{ id: 'b1', type: 'breaker', name: 'Автомат' }],
    });
    const sheet = layoutLabelsOnA4(labels);
    const svg = generateLabelsSvg(sheet);
    expect(svg).toContain('<svg');
    expect(svg).toContain('R1');
    expect(svg).toContain('QF1');
  });

  it('exports CSV', () => {
    const labels = buildIecLabels({
      devices: [{ id: 'd1', type: 'socket', name: 'Розетка' }],
    });
    const csv = exportLabelsToCsv(labels);
    expect(csv).toContain('Полное имя;Тип;Описание');
    expect(csv).toContain('R1');
  });
});
