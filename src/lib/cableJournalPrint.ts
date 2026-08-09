import type { SheetTitleBlock } from '@core/model/Sheet';
import type { Plan } from '@core/model/Plan';
import { Camera } from '@core/engine/Camera';
import { ThemeManager } from '@core/editor/ThemeManager';
import { SheetFrameRenderer } from '@core/render/SheetFrameRenderer';

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
  laid: boolean;
}

export interface CableJournalPrintOptions {
  title: string;
  rows: CableJournalPrintRow[];
  titleBlock?: SheetTitleBlock | null;
  plan?: Plan | null;
}

const A3_LANDSCAPE = { width: 420, height: 297 };
const MARGIN = { left: 20, right: 5, top: 5, bottom: 5 };

export function printCableJournal(options: CableJournalPrintOptions): void {
  const { rows, titleBlock, plan } = options;

  const html = buildHtml({ rows, titleBlock, plan });

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = `${A3_LANDSCAPE.width}mm`;
  iframe.style.height = `${A3_LANDSCAPE.height}mm`;
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
  if (win) {
    win.focus();
    setTimeout(() => win.print(), 0);
  }

  setTimeout(() => iframe.remove(), 2000);
}

export function buildHtml(params: {
  rows: CableJournalPrintRow[];
  titleBlock?: SheetTitleBlock | null;
  plan?: Plan | null;
}): string {
  const tb = params.titleBlock;
  const show = tb?.show;
  const rowsHtml = params.rows.length
    ? params.rows
        .map(
          (row) => `
    <tr>
      <td><input type="checkbox" ${row.laid ? 'checked' : ''} disabled /></td>
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
    : '<tr><td colspan="13" class="empty">Нет кабелей</td></tr>';

  const activeSheet = params.plan?.activeSheet;
  const formatLabel = activeSheet
    ? `Формат ${activeSheet.pageSize} ${activeSheet.orientation === 'landscape' ? 'альбомный' : 'портретный'}`
    : 'Формат A3 альбомный';

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
  .format-label {
    position: absolute;
    right: ${MARGIN.right}mm;
    bottom: 0;
    width: 40mm;
    height: ${MARGIN.bottom}mm;
    border: 0.35mm solid #000;
    border-bottom: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8pt;
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
            <th rowspan="2">Прол.</th>
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
      ${params.plan ? buildStampImage(params.plan) : buildStampSvg(tb)}
    </div>
    <div class="format-label">${formatLabel}</div>
  </div>
</body>
</html>`;
}

function buildStampSvg(tb: SheetTitleBlock | undefined | null): string {
  if (!tb) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="185mm" height="55mm" viewBox="0 0 185 55" preserveAspectRatio="xMidYMid meet">
      <rect x="0" y="0" width="185" height="55" fill="none" stroke="black" stroke-width="0.7" />
      <text x="92.5" y="27.5" font-size="5" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif">Штамп</text>
    </svg>`;
  }

  const show = tb.show;
  const dateLabel = show.date && tb.date ? formatDateMmYy(tb.date) : '';

  const leftCols = [10, 10, 10, 10, 15, 10];
  const leftW = leftCols.reduce((a, b) => a + b, 0); // 65
  const mainLeftW = 70;
  const mainRightW = 50;
  const totalW = leftW + mainLeftW + mainRightW; // 185
  const totalH = 55;
  const rowH = 5;

  let lines = '';
  let labels = '';

  // Внешняя рамка штампа 0.7 мм.
  lines += `<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="none" stroke="black" stroke-width="0.7" />`;

  // 11 горизонтальных строк по 5 мм.
  const skippedMainLeftRows = new Set([1, 3, 4, 6, 7, 9, 10]);
  const skippedMainRightRows = new Set([1, 3, 4, 7, 9, 10]);
  for (let r = 1; r < 11; r++) {
    const ry = rowH * r;
    // Левая группа
    lines += `<line x1="0" y1="${ry}" x2="${leftW}" y2="${ry}" stroke="black" stroke-width="0.35" />`;
    // Основное поле слева (70 мм)
    if (!skippedMainLeftRows.has(r)) {
      lines += `<line x1="${leftW}" y1="${ry}" x2="${leftW + mainLeftW}" y2="${ry}" stroke="black" stroke-width="0.35" />`;
    }
    // Основное поле справа (50 мм)
    if (!skippedMainRightRows.has(r)) {
      lines += `<line x1="${leftW + mainLeftW}" y1="${ry}" x2="${totalW}" y2="${ry}" stroke="black" stroke-width="0.35" />`;
    }
  }

  // Вертикальная граница между левой группой и основным полем
  lines += `<line x1="${leftW}" y1="0" x2="${leftW}" y2="${totalH}" stroke="black" stroke-width="0.35" />`;

  // Вертикальная граница между основным полем слева и справа (только строки 1–6 снизу)
  lines += `<line x1="${leftW + mainLeftW}" y1="${totalH - 30}" x2="${leftW + mainLeftW}" y2="${totalH}" stroke="black" stroke-width="0.35" />`;

  // Вертикали в правой части для строк 4-6
  const rightSubX1 = leftW + mainLeftW + 15;
  const rightSubX2 = rightSubX1 + 15;
  lines += `<line x1="${rightSubX1}" y1="${totalH - 30}" x2="${rightSubX1}" y2="${totalH - 15}" stroke="black" stroke-width="0.35" />`;
  lines += `<line x1="${rightSubX2}" y1="${totalH - 30}" x2="${rightSubX2}" y2="${totalH - 15}" stroke="black" stroke-width="0.35" />`;

  // Внутренние вертикали левой группы
  let cx = 0;
  const mergedPairs = new Set([0, 2]);
  for (let i = 0; i < leftCols.length - 1; i++) {
    cx += leftCols[i];
    if (mergedPairs.has(i)) {
      lines += `<line x1="${cx}" y1="0" x2="${cx}" y2="${totalH - 30}" stroke="black" stroke-width="0.35" />`;
    } else {
      lines += `<line x1="${cx}" y1="0" x2="${cx}" y2="${totalH}" stroke="black" stroke-width="0.35" />`;
    }
  }

  // Заголовки левой группы (строка 7 снизу, центр y=22.5)
  const leftHeaders = ['Изм.', 'Кол.уч.', 'Лист', '№док.', 'Подп.', 'Дата'];
  let hx = 0;
  for (let i = 0; i < leftCols.length; i++) {
    labels += textSvg(leftHeaders[i], hx + leftCols[i] / 2, 22.5, 2.5, 'middle', 'middle');
    hx += leftCols[i];
  }

  // Заголовки правой части (строка 6 снизу, центр y=27.5)
  labels += textSvg('Стадия', leftW + mainLeftW + 7.5, totalH - 25 - rowH / 2, 2.5, 'middle', 'middle');
  labels += textSvg('Лист', rightSubX1 - 7.5, totalH - 25 - rowH / 2, 2.5, 'middle', 'middle');
  labels += textSvg('Листов', rightSubX2 + 10, totalH - 25 - rowH / 2, 2.5, 'middle', 'middle');

  // Значения правой части (Стадия, Лист, Листов) в объединённых строках 4-5
  const mainRightX = leftW + mainLeftW;
  if (show.stage && tb.stage) {
    labels += textSvg(tb.stage, mainRightX + 7.5, 35, 3.5, 'middle', 'middle');
  }
  if (show.sheetNo && tb.sheetNo) {
    labels += textSvg(tb.sheetNo, rightSubX1 - 7.5, 35, 3.5, 'middle', 'middle');
  }
  if (show.sheetTotal && tb.sheetTotal) {
    labels += textSvg(tb.sheetTotal, rightSubX2 + 10, 35, 3.5, 'middle', 'middle');
  }

  // Строки 1-6 левой группы (снизу вверх): роль, фамилия, подпись, дата
  const rows = [
    { show: show.row1, role: 'Утвердил', name: tb.approver, signature: tb.signatureApprover },
    { show: show.row2, role: 'Н.контр.', name: tb.normController, signature: tb.signatureNormController },
    { show: show.row3, role: 'ГИП', name: tb.gip, signature: tb.signatureGip },
    { show: show.row4, role: 'Проверил', name: tb.checker, signature: tb.signatureChecker },
    { show: show.row5, role: 'Согласовал', name: tb.reviewer, signature: tb.signatureReviewer },
    { show: show.row6, role: 'Разраб.', name: tb.designer, signature: tb.signatureDesigner },
  ];
  for (let i = 0; i < 6; i++) {
    const row = rows[i];
    if (!row.show) continue;
    const rowY = 52.5 - i * 5; // центр строки
    labels += textSvg(row.role, 10, rowY, 2.5, 'middle', 'middle');
    if (row.name) labels += textSvg(row.name, 30, rowY, 3.5, 'middle', 'middle');
    if (row.signature) labels += textSvg(row.signature, 47.5, rowY, 3.5, 'middle', 'middle');
    if (dateLabel) labels += textSvg(dateLabel, 60, rowY, 2.5, 'middle', 'middle');
  }

  // Заполняемые поля основного поля слева
  const mainLeftCenter = leftW + mainLeftW / 2;
  if (show.drawingTitle && tb.drawingTitle) {
    labels += textSvg(tb.drawingTitle, mainLeftCenter, 47.5, 3.5, 'middle', 'middle');
  }
  if (show.section && tb.section) {
    labels += textSvg(tb.section, mainLeftCenter, 32.5, 3.5, 'middle', 'middle');
  }

  // Заполняемые поля основного поля справа (120 мм)
  const mainFieldCenter = leftW + 60;
  if (show.address && tb.address) {
    labels += textSvg(tb.address, mainFieldCenter, 17.5, 2.5, 'middle', 'middle');
  }
  if (show.projectCode && tb.projectCode) {
    labels += textSvg(tb.projectCode, mainFieldCenter, 5, 3.5, 'middle', 'middle');
  }

  // Компания / логотип (нижнее правое поле, строки 1-3, 50×15 мм)
  if (show.company && (tb.company || tb.companyLogo)) {
    const companyX = mainRightX;
    const companyY = totalH - 15;
    const companyW = mainRightW;
    const companyH = 15;
    if (tb.companyLogo) {
      labels += `<image x="${companyX + 2}" y="${companyY + 2}" width="${companyW - 4}" height="${companyH - 4}" href="${tb.companyLogo}" preserveAspectRatio="xMidYMid meet" />`;
    } else if (tb.company) {
      labels += textSvg(tb.company, companyX + companyW / 2, companyY + companyH / 2, 3.5, 'middle', 'middle');
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${totalW} ${totalH}" preserveAspectRatio="xMidYMid meet">
    ${lines}
    ${labels}
  </svg>`;
}

function textSvg(
  value: string,
  x: number,
  y: number,
  fontSizeMm: number,
  textAnchor: 'middle' | 'start' = 'middle',
  dominantBaseline: 'middle' | 'hanging' | 'auto' = 'middle',
): string {
  const escaped = escapeHtml(value);
  return `<text x="${x}" y="${y}" font-size="${fontSizeMm}" text-anchor="${textAnchor}" dominant-baseline="central" alignment-baseline="central" font-family="Arial,Helvetica,sans-serif">${escaped}</text>`;
}

function formatDateMmYy(dateStr: string): string {
  const parts = dateStr.split(/[.\\/-]/);
  if (parts.length >= 3) {
    const mm = parts[1]?.padStart(2, '0') ?? '';
    const yy = parts[2]?.slice(-2) ?? '';
    return `${mm}.${yy}`;
  }
  return dateStr;
}

function buildStampImage(plan: Plan): string {
  const scale = 10;
  const widthMm = 185;
  const heightMm = 55;
  const canvas = document.createElement('canvas');
  canvas.width = widthMm * scale;
  canvas.height = heightMm * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return buildStampSvg(plan.activeSheet?.titleBlock);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const camera = new Camera(canvas.width, canvas.height);
  camera.scale = 1;
  const themeManager = new ThemeManager('light');
  const renderer = new SheetFrameRenderer(plan, camera, themeManager);
  const color = themeManager.getColor('sheetFrame');
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  renderer.renderStamp(ctx, 0, 0, widthMm * scale, heightMm * scale, scale);

  const dataUrl = canvas.toDataURL('image/png');
  return `<img src="${dataUrl}" style="display:block; width:100%; height:100%;" alt="" />`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
