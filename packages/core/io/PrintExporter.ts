import { EditorState } from '../editor/EditorState';
import { Plan } from '../model/Plan';
import { CABLE_TYPES, CableType } from '../model/Cable';
import { DEVICE_CATALOG } from '../catalogs/DeviceCatalog';
import { ThemeManager } from '../editor/ThemeManager';

const DEVICE_COLORS: Record<string, string> = {
  socket: '#2563eb',
  'socket-uz': '#2563eb',
  'socket-usb': '#2563eb',
  switch: '#7c3aed',
  'switch-2': '#7c3aed',
  panel: '#dc2626',
  breaker: '#f59e0b',
  light: '#10b981',
};

const CABLE_COLORS: Record<CableType, string> = {
  power: '#ef4444',
  lighting: '#f59e0b',
  'low-current': '#10b981',
};
import { renderSheetToDataURL } from './SheetRenderer';
import { getSheetDimensions, Sheet } from '../model/Sheet';

export interface PrintOptions {
  title?: string;
  includeSpec?: boolean;
  includeLegend?: boolean;
  /** Если true, iframe создаётся, но диалог печати не вызывается (для тестов). */
  _testMode?: boolean;
  /** Разрешение рендера листа в px на мм. По умолчанию 96 DPI (~3.78). */
  resolution?: number;
}

/**
 * Печать всех листов проекта через диалог печати браузера.
 * Каждый лист рендерится в собственном формате (A4/A3, альбомный/портретный)
 * внутри своей рамки и печатается на отдельной странице.
 */
export class PrintExporter {
  constructor(
    private plan: Plan,
    private editorState: EditorState,
    private themeManager: ThemeManager,
  ) {}

  print(options: PrintOptions = {}): void {
    const title = options.title ?? 'План помещения';
    const includeSpec = options.includeSpec ?? true;
    const includeLegend = options.includeLegend ?? true;
    const testMode = options._testMode ?? false;
    const resolution = options.resolution ?? 3.7795275591; // 96 DPI

    if (this.plan.sheets.length === 0) {
      alert('Нет листов для печати');
      return;
    }

    const previousActiveSheetId = this.plan.activeSheetId;

    const pages: Array<{ sheet: Sheet; dataUrl: string }> = [];
    for (const sheet of this.plan.sheets) {
      const dataUrl = renderSheetToDataURL(
        this.plan,
        this.editorState,
        this.themeManager,
        sheet,
        { resolution }
      );
      if (dataUrl) {
        pages.push({ sheet, dataUrl });
      }
    }

    // Восстанавливаем активный лист
    this.plan.setActiveSheet(previousActiveSheetId);

    if (pages.length === 0) {
      alert('Нечего печатать');
      return;
    }

    const html = this.buildHtml({
      title,
      pages,
      includeLegend,
      includeSpec,
    });

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const win = iframe.contentWindow;
    if (win && !testMode) {
      win.focus();
      setTimeout(() => win.print(), 0);
    }

    if (!testMode) {
      setTimeout(() => iframe.remove(), 2000);
    }
  }

  private buildHtml(params: {
    title: string;
    pages: Array<{ sheet: Sheet; dataUrl: string }>;
    includeLegend: boolean;
    includeSpec: boolean;
  }): string {
    const date = new Date().toLocaleDateString('ru-RU');
    const legendHtml = params.includeLegend ? this.buildLegendHtml() : '';
    const specHtml = params.includeSpec ? this.buildSpecHtml() : '';

    const pagesHtml = params.pages.map(({ sheet, dataUrl }, index) => {
      const dims = getSheetDimensions(sheet.pageSize, sheet.orientation);
      const isFirstPage = index === 0;

      // Аспект-ратио листа для корректного отображения внутри страницы
      const aspectClass = dims.width > dims.height ? 'landscape' : 'portrait';

      return `
<div class="sheet-page ${aspectClass}" data-size="${sheet.pageSize}" data-orientation="${sheet.orientation}">
  ${isFirstPage ? `
  <div class="header">
    <div class="header-title">${this.escapeHtml(params.title)}</div>
    <div class="header-meta">${this.escapeHtml(sheet.name)} &nbsp;|&nbsp; ${date}</div>
  </div>
  <img class="plan-image" src="${dataUrl}" alt="${this.escapeHtml(sheet.name)}">
  ${legendHtml}
  ${specHtml}
  ` : `
  <div class="header">
    <div class="header-title">${this.escapeHtml(params.title)}</div>
    <div class="header-meta">${this.escapeHtml(sheet.name)} &nbsp;|&nbsp; ${date}</div>
  </div>
  <img class="plan-image" src="${dataUrl}" alt="${this.escapeHtml(sheet.name)}">
  `}
</div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>${this.escapeHtml(params.title)}</title>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #111827;
  }
  @page {
    size: A4 portrait;
    margin: 10mm;
  }
  .sheet-page {
    width: 100%;
    min-height: 100vh;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8mm;
  }
  .sheet-page:last-child {
    page-break-after: auto;
  }
  .header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-bottom: 1px solid #d1d5db;
    padding-bottom: 3mm;
    margin-bottom: 4mm;
  }
  .header-title { font-size: 14pt; font-weight: 700; }
  .header-meta { font-size: 10pt; color: #4b5563; }
  .plan-image {
    display: block;
    max-width: 100%;
    max-height: 245mm;
    height: auto;
    width: auto;
    border: 1px solid #e5e7eb;
    margin-bottom: 4mm;
  }
  .section-title {
    font-size: 11pt;
    font-weight: 700;
    margin: 4mm 0 2mm;
    width: 100%;
  }
  .legend-table, .spec-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    margin-bottom: 4mm;
    max-width: 190mm;
  }
  .legend-table td, .spec-table th, .spec-table td {
    border: 1px solid #d1d5db;
    padding: 2mm 3mm;
    text-align: left;
    vertical-align: middle;
  }
  .spec-table th { background: #f3f4f6; }
  .symbol {
    display: inline-block;
    width: 16px;
    height: 16px;
    line-height: 16px;
    text-align: center;
    border-radius: 2px;
    color: #fff;
    font-size: 10px;
  }
  .color-box {
    display: inline-block;
    width: 24px;
    height: 4px;
    border-radius: 2px;
    vertical-align: middle;
    margin-right: 6px;
  }
  @media print {
    .sheet-page { padding: 0; }
  }
</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
  }

  private buildLegendHtml(): string {
    const deviceRows = DEVICE_CATALOG.map(item => {
      const color = DEVICE_COLORS[item.type] ?? '#2563eb';
      return `<tr>
        <td><span class="symbol" style="background:${color}">${this.escapeHtml(item.icon)}</span></td>
        <td>${this.escapeHtml(item.label)}</td>
      </tr>`;
    }).join('');

    const cableRows = (Object.keys(CABLE_TYPES) as CableType[]).map(type => {
      return `<tr>
        <td><span class="color-box" style="background:${CABLE_COLORS[type]}"></span></td>
        <td>${this.escapeHtml(CABLE_TYPES[type])}</td>
      </tr>`;
    }).join('');

    return `<div class="section-title">Легенда</div>
<table class="legend-table">
  <tr><td colspan="2"><strong>Устройства</strong></td></tr>
  ${deviceRows}
  <tr><td colspan="2"><strong>Кабели</strong></td></tr>
  ${cableRows}
</table>`;
  }

  private buildSpecHtml(): string {
    const walls = this.plan.walls;
    const wallLength = walls.reduce((sum, w) => sum + w.a.distanceTo(w.b), 0);
    const wallArea = walls.reduce((sum, w) => {
      const length = w.a.distanceTo(w.b);
      const openingArea = w.openings.reduce((a, o) => a + o.width * w.thickness, 0);
      return sum + length * w.thickness - openingArea;
    }, 0);
    const doors = walls.reduce((sum, w) => sum + w.openings.filter(o => o.type === 'door').length, 0);
    const windows = walls.reduce((sum, w) => sum + w.openings.filter(o => o.type === 'window').length, 0);
    const rooms = this.plan.getRooms();
    const totalArea = rooms.reduce((sum, r) => sum + r.area, 0);
    const cableLength = this.plan.cables.reduce((sum, c) => sum + c.length, 0);

    return `<div class="section-title">Спецификация</div>
<table class="spec-table">
  <tr><th>Параметр</th><th>Значение</th></tr>
  <tr><td>Стены</td><td>${walls.length} шт, ${Math.round(wallLength)} мм</td></tr>
  <tr><td>Площадь стен</td><td>${(wallArea / 1_000_000).toFixed(2)} м²</td></tr>
  <tr><td>Двери</td><td>${doors} шт</td></tr>
  <tr><td>Окна</td><td>${windows} шт</td></tr>
  <tr><td>Устройства</td><td>${this.plan.devices.length} шт</td></tr>
  <tr><td>Кабели</td><td>${(cableLength / 1000).toFixed(2)} м</td></tr>
  <tr><td>Комнаты</td><td>${rooms.length} шт, ${(totalArea / 1_000_000).toFixed(2)} м²</td></tr>
</table>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
