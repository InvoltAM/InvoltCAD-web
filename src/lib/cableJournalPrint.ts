import type { SheetTitleBlock } from '@core/model/Sheet';

export interface CableJournalPrintRow {
  idx: number;
  circuitName: string;
  brand: string;
  section: number;
  routeM: number;
  rise: number;
  fall: number;
  totalM: number;
  panel: string;
  autoNo: string;
  roomName: string;
  consumerName: string;
}

export interface CableJournalPrintOptions {
  title: string;
  rows: CableJournalPrintRow[];
  titleBlock?: SheetTitleBlock | null;
  /** Если true, iframe создаётся, но диалог печати не вызывается и iframe не удаляется (для тестов). */
  _testMode?: boolean;
}

const A3_LANDSCAPE = { width: 420, height: 297 };
const MARGIN = { left: 20, right: 5, top: 5, bottom: 5 };

export function printCableJournal(options: CableJournalPrintOptions): HTMLIFrameElement | void {
  const { rows, titleBlock, _testMode } = options;

  const html = buildHtml({ rows, titleBlock });

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '${A3_LANDSCAPE.width}mm';
  iframe.style.height = '${A3_LANDSCAPE.height}mm';
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
  if (win && !_testMode) {
    win.focus();
    setTimeout(() => win.print(), 0);
  }

  if (!_testMode) {
    setTimeout(() => iframe.remove(), 2000);
  }

  if (_testMode) {
    return iframe;
  }
}

export function buildHtml(params: {
  rows: CableJournalPrintRow[];
  titleBlock?: SheetTitleBlock | null;
}): string {
  const tb = params.titleBlock;
  const show = tb?.show;
  const rowsHtml = params.rows.length
    ? params.rows
        .map(
          (row) => `
    <tr>
      <td>${row.idx}</td>
      <td>${escapeHtml(row.circuitName)}</td>
      <td>${escapeHtml(row.brand)}</td>
      <td>${row.section}</td>
      <td>${row.routeM.toFixed(2)}</td>
      <td>${row.rise.toFixed(2)}</td>
      <td>${row.fall.toFixed(2)}</td>
      <td>${row.totalM.toFixed(2)}</td>
      <td>${escapeHtml(row.panel)}</td>
      <td>${escapeHtml(row.autoNo)}</td>
      <td>${escapeHtml(row.roomName)}</td>
      <td>${escapeHtml(row.consumerName)}</td>
    </tr>`,
        )
        .join('')
    : '<tr><td colspan="12" class="empty">Нет кабелей</td></tr>';

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Кабельный журнал</title>
<style>
  @page {
    size: A3 landscape;
    margin: 0;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    background: #fff;
  }
  .sheet {
    position: relative;
    width: ${A3_LANDSCAPE.width}mm;
    height: ${A3_LANDSCAPE.height}mm;
    padding: ${MARGIN.top}mm ${MARGIN.right}mm ${MARGIN.bottom}mm ${MARGIN.left}mm;
    overflow: hidden;
  }
  .outer-frame {
    position: absolute;
    left: 0; top: 0; right: 0; bottom: 0;
    border: 0.5mm solid #000;
  }
  .inner-frame {
    position: absolute;
    left: ${MARGIN.left}mm; top: ${MARGIN.top}mm;
    right: ${MARGIN.right}mm; bottom: ${MARGIN.bottom}mm;
    border: 0.7mm solid #000;
  }
  .content {
    position: absolute;
    left: ${MARGIN.left + 5}mm; top: ${MARGIN.top + 5}mm;
    right: ${MARGIN.right + 5}mm;
    bottom: ${MARGIN.bottom + 5 + 55}mm;
  }
  h1 {
    font-size: 12pt;
    font-weight: bold;
    margin: 0 0 4mm 0;
    text-align: center;
  }
  table.journal {
    width: 100%;
    border-collapse: collapse;
    font-size: 8pt;
  }
  table.journal th, table.journal td {
    border: 0.35mm solid #000;
    padding: 1mm 1.5mm;
    text-align: center;
    vertical-align: middle;
  }
  table.journal th {
    background: #f2f2f2;
    font-weight: bold;
  }
  table.journal td { font-size: 8pt; }
  table.journal .empty {
    text-align: center;
    padding: 5mm;
  }
  .stamp {
    position: absolute;
    right: ${MARGIN.right}mm;
    bottom: ${MARGIN.bottom}mm;
    width: 185mm;
    height: 55mm;
  }
  table.stamp-table {
    width: 185mm;
    height: 55mm;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 7pt;
  }
  table.stamp-table td {
    border: 0.35mm solid #000;
    padding: 0.5mm;
    text-align: center;
    vertical-align: middle;
    overflow: hidden;
    white-space: nowrap;
  }
  table.stamp-table .label {
    font-size: 6pt;
    text-align: left;
    padding-left: 1mm;
  }
  table.stamp-table .top-field {
    font-size: 8pt;
    font-weight: bold;
  }
  table.stamp-table .company {
    font-size: 8pt;
    font-weight: bold;
  }
  table.stamp-table .left-main {
    background: transparent;
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="outer-frame"></div>
    <div class="inner-frame"></div>
    <div class="content">
      <h1>Кабельный журнал</h1>
      <table class="journal">
        <thead>
          <tr>
            <th rowspan="2">№ п/п</th>
            <th rowspan="2">№гр.</th>
            <th rowspan="2">Марка кабеля</th>
            <th rowspan="2">S, мм²</th>
            <th colspan="4">Длина, м</th>
            <th colspan="2">Начало</th>
            <th colspan="2">Конец</th>
          </tr>
          <tr>
            <th>черт.</th>
            <th>↑ П</th>
            <th>↓ О</th>
            <th>Общая</th>
            <th>щит</th>
            <th>№Авт.</th>
            <th>пом.</th>
            <th>Потребитель</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
    <div class="stamp">
      ${buildStampHtml(tb)}
    </div>
  </div>
</body>
</html>`;
}

function buildStampHtml(tb: SheetTitleBlock | undefined | null): string {
  if (!tb) {
    return `<table class="stamp-table"><tr><td>Штамп</td></tr></table>`;
  }

  const projectCode = escapeHtml(tb.projectCode || '');
  const address = escapeHtml(tb.address || '');
  const section = escapeHtml(tb.section || '');
  const drawingTitle = escapeHtml(tb.drawingTitle || '');
  const stage = escapeHtml(tb.stage || '');
  const sheetNo = escapeHtml(tb.sheetNo || '');
  const sheetTotal = escapeHtml(tb.sheetTotal || '');
  const company = escapeHtml(tb.company || '');
  const companyLogo = tb.companyLogo || '';
  const designer = escapeHtml(tb.designer || '');
  const checker = escapeHtml(tb.checker || '');
  const normController = escapeHtml(tb.normController || '');
  const gip = escapeHtml(tb.gip || '');
  const approver = escapeHtml(tb.approver || '');
  const reviewer = escapeHtml(tb.reviewer || '');
  const date = escapeHtml(tb.date || '');
  const scaleLabel = escapeHtml(tb.scaleLabel || '');

  const logoCell = companyLogo
    ? `<img src="${companyLogo}" style="max-width:18mm;max-height:8mm;" alt="" />`
    : '';

  return `<table class="stamp-table">
    <colgroup>
      <col style="width:10mm"><col style="width:10mm"><col style="width:10mm"><col style="width:10mm">
      <col style="width:15mm"><col style="width:10mm"><col style="width:70mm">
      <col style="width:15mm"><col style="width:15mm"><col style="width:20mm">
    </colgroup>
    <tbody>
      <tr>
        <td colspan="6" rowspan="4" class="left-main"></td>
        <td colspan="4" class="top-field">${drawingTitle}</td>
      </tr>
      <tr><td colspan="4" class="top-field">${address}</td></tr>
      <tr><td colspan="4" class="top-field">${section}</td></tr>
      <tr><td colspan="4" class="top-field">${projectCode}</td></tr>
      <tr>
        <td colspan="6" rowspan="2" class="left-main"></td>
        <td colspan="4" class="top-field"></td>
      </tr>
      <tr>
        <td></td>
        <td>Стадия</td>
        <td>Лист</td>
        <td>Листов</td>
      </tr>
      <tr>
        <td colspan="6" class="left-main"></td>
        <td></td>
        <td>${stage}</td>
        <td>${sheetNo}</td>
        <td>${sheetTotal}</td>
      </tr>
      <tr>
        <td colspan="2" class="label">Утвердил</td>
        <td colspan="2">${approver}</td>
        <td colspan="2" class="label">Проверил</td>
        <td colspan="4" rowspan="4" class="company">${logoCell}<div>${company}</div></td>
      </tr>
      <tr>
        <td colspan="2" class="label">Н.контр.</td>
        <td colspan="2">${normController}</td>
        <td colspan="2" class="label">Согласовал</td>
      </tr>
      <tr>
        <td colspan="2" class="label">ГИП</td>
        <td colspan="2">${gip}</td>
        <td colspan="2" class="label">Разработал</td>
      </tr>
      <tr>
        <td colspan="2" class="label">Дата</td>
        <td colspan="4">${date}</td>
      </tr>
    </tbody>
  </table>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
