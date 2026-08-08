import { icon } from './icons';

export interface PanelConfig {
  id: string;
  title: string;
  icon: string;
  body: HTMLElement;
  width?: number;
}

interface PanelState {
  x: number;
  y: number;
  xAnchor?: 'left' | 'right';
  xOffset?: number;
  collapsed: boolean;
  closed: boolean;
  w?: number;
  h?: number;
}

const STORAGE_LAYOUT = 'involtcad-panels-layout';
const SNAP_THRESHOLD = 12;
const PANEL_WIDTH = 280;
const PANEL_GAP = 12;
const BASE_Z = 100;
const AVOID_MARGIN = 8;
const MIN_VIEWPORT_WIDTH = 400;
const MIN_PANEL_WIDTH = 240;
const MAX_PANEL_WIDTH = 600;
const MIN_PANEL_HEIGHT = 120;

/**
 * Отдельная плавающая панель: drag за заголовок, сворачивание, закрытие,
 * магнитное прилипание к краям экрана и соседним панелям.
 */
class Panel {
  readonly element: HTMLDivElement;
  collapsed = false;
  closed = false;

  private header!: HTMLDivElement;
  private bodyWrap!: HTMLDivElement;
  private collapseBtn!: HTMLButtonElement;
  private resizeHandle!: HTMLDivElement;

  constructor(
    readonly config: PanelConfig,
    private manager: PanelManager,
  ) {
    this.element = this.render();
  }

  get id(): string {
    return this.config.id;
  }

  get preferredWidth(): number {
    return this.config.width ?? PANEL_WIDTH;
  }

  private render(): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'float-panel';
    el.dataset.panel = this.id;

    this.header = document.createElement('div');
    this.header.className = 'float-panel-header';
    this.header.innerHTML =
      `<span class="ui-icon">${this.config.icon}</span>` +
      `<span class="float-panel-title">${this.config.title}</span>`;

    const actions = document.createElement('div');
    actions.className = 'float-panel-actions';

    this.collapseBtn = document.createElement('button');
    this.collapseBtn.className = 'float-panel-collapse';
    this.collapseBtn.title = 'Свернуть/развернуть';
    this.collapseBtn.innerHTML = `<span class="ui-icon">${icon('collapseUp')}</span>`;
    this.collapseBtn.addEventListener('click', e => {
      e.stopPropagation();
      this.setCollapsed(!this.collapsed);
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'float-panel-close';
    closeBtn.title = 'Закрыть';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      this.manager.hide(this.id);
    });

    actions.appendChild(this.collapseBtn);
    actions.appendChild(closeBtn);
    this.header.appendChild(actions);

    this.bodyWrap = document.createElement('div');
    this.bodyWrap.className = 'float-panel-body';
    this.bodyWrap.appendChild(this.config.body);

    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'float-panel-resize';
    this.resizeHandle.title = 'Изменить размер';
    this.resizeHandle.addEventListener('pointerdown', e => this.onResizeStart(e));

    el.appendChild(this.header);
    el.appendChild(this.bodyWrap);
    el.appendChild(this.resizeHandle);

    el.addEventListener('pointerdown', () => this.manager.bringToFront(this.id));
    this.header.addEventListener('pointerdown', e => this.onDragStart(e));

    return el;
  }

  private onDragStart(e: PointerEvent): void {
    if (e.button !== 0) return;
    if (window.innerWidth < 768) return; // на мобильных drag отключён (bottom-sheet)
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();

    const rect = this.element.getBoundingClientRect();
    const grabX = e.clientX - rect.left;
    const grabY = e.clientY - rect.top;
    this.header.classList.add('dragging');

    const onMove = (ev: PointerEvent): void => {
      let x = ev.clientX - grabX;
      let y = ev.clientY - grabY;

      // clamp к viewport (заголовок всегда доступен)
      const w = this.element.offsetWidth;
      x = Math.max(0, Math.min(window.innerWidth - w, x));
      y = Math.max(0, Math.min(window.innerHeight - 40, y));

      const snapped = this.manager.snap(this, x, y);
      this.setPosition(snapped.x, snapped.y);
    };

    const onUp = (ev: PointerEvent): void => {
      this.header.classList.remove('dragging');
      try {
        this.header.releasePointerCapture(ev.pointerId);
      } catch {
        // synthetic events may not have an active pointer
      }
      this.header.removeEventListener('pointermove', onMove);
      this.header.removeEventListener('pointerup', onUp);
      this.manager.saveLayout();
    };

    try {
      this.header.setPointerCapture(e.pointerId);
    } catch {
      // synthetic events may not have an active pointer
    }
    this.header.addEventListener('pointermove', onMove);
    this.header.addEventListener('pointerup', onUp);
  }

  private onResizeStart(e: PointerEvent): void {
    if (e.button !== 0) return;
    if (window.innerWidth < 768) return; // на мобильных ресайз отключён (bottom-sheet)
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = this.element.getBoundingClientRect();
    const maxH = window.innerHeight - 80;

    this.resizeHandle.classList.add('resizing');

    const onMove = (ev: PointerEvent): void => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const w = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, startRect.width + dx));
      const h = Math.max(MIN_PANEL_HEIGHT, Math.min(maxH, startRect.height + dy));
      this.setSize(w, h);
    };

    const onUp = (ev: PointerEvent): void => {
      this.resizeHandle.classList.remove('resizing');
      try {
        this.resizeHandle.releasePointerCapture(ev.pointerId);
      } catch {
        // synthetic events may not have an active pointer
      }
      this.resizeHandle.removeEventListener('pointermove', onMove);
      this.resizeHandle.removeEventListener('pointerup', onUp);
      this.manager.saveLayout();
    };

    try {
      this.resizeHandle.setPointerCapture(e.pointerId);
    } catch {
      // synthetic events may not have an active pointer
    }
    this.resizeHandle.addEventListener('pointermove', onMove);
    this.resizeHandle.addEventListener('pointerup', onUp);
  }

  setPosition(x: number, y: number): void {
    this.element.style.left = `${Math.round(x)}px`;
    this.element.style.top = `${Math.round(y)}px`;
    this.element.style.right = 'auto';
  }

  setSize(w: number, h: number): void {
    this.element.style.width = `${Math.round(w)}px`;
    this.element.style.height = `${Math.round(h)}px`;
  }

  clearSize(): void {
    this.element.style.width = '';
    this.element.style.height = '';
  }

  setCollapsedImpl(collapsed: boolean): void {
    this.collapsed = collapsed;
    this.element.classList.toggle('collapsed', collapsed);
    const iconEl = this.collapseBtn.querySelector('.ui-icon') as HTMLElement;
    if (iconEl) {
      iconEl.innerHTML = collapsed ? icon('collapseDown') : icon('collapseUp');
    }
  }

  setCollapsed(collapsed: boolean): void {
    if (this.manager.isLayoutReady() && !collapsed && this.manager.isMobile()) {
      this.manager.collapseOthers(this);
    }
    this.setCollapsedImpl(collapsed);
    if (this.manager.isLayoutReady()) {
      this.manager.reflowColumns();
    }
  }

  setClosed(closed: boolean): void {
    this.closed = closed;
    this.element.style.display = closed ? 'none' : '';
    if (this.manager.isLayoutReady()) {
      this.manager.reflowColumns();
    }
  }

  applyState(state: PanelState): void {
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const width = state.w ?? this.element.offsetWidth;
    let x = state.x;
    if (state.xAnchor === 'right' && state.xOffset !== undefined && viewportW > 0) {
      x = viewportW - state.xOffset - width;
    } else if (state.xAnchor === 'left' && state.xOffset !== undefined) {
      x = state.xOffset;
    }
    x = Math.max(0, Math.min(viewportW - width, x));
    let y = Math.max(0, Math.min(viewportH - 40, state.y));
    this.setPosition(x, y);
    if (state.w && state.h) {
      this.setSize(state.w, state.h);
    } else {
      this.clearSize();
    }
    this.setCollapsed(state.collapsed);
    this.setClosed(state.closed);
  }

  getState(): PanelState {
    const rect = this.element.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const width = rect.width;
    const center = rect.left + width / 2;
    const anchor: 'left' | 'right' = center < viewportW / 2 ? 'left' : 'right';
    const xOffset = anchor === 'left' ? rect.left : viewportW - rect.right;
    return {
      x: rect.left,
      y: rect.top,
      xAnchor: anchor,
      xOffset,
      collapsed: this.collapsed,
      closed: this.closed,
      w: parseFloat(this.element.style.width) || undefined,
      h: parseFloat(this.element.style.height) || undefined,
    };
  }
}

/**
 * Менеджер плавающих панелей: z-order, snapping, персистентность раскладки.
 */
export class PanelManager {
  private panels: Panel[] = [];
  private zCounter = BASE_Z;
  private layoutReady = false;
  private resizeObserver: ResizeObserver | null = null;
  private pendingReflow = false;
  private reflowing = false;
  private handleResize = () => {
    if (this.isMobile()) {
      this.reflowMobile();
    } else {
      this.applyAnchors();
    }
  };

  private applyAnchors(): void {
    if (!this.layoutReady) return;
    for (const panel of this.panels) {
      if (panel.closed) continue;
      const state = panel.getState();
      panel.applyState(state);
    }
    this.saveLayout();
  }

  constructor(
    configs: PanelConfig[],
    private parent: HTMLElement,
    private avoidElement?: HTMLElement,
  ) {
    const saved = this.loadLayout();
    const hasSavedLayout = Object.keys(saved).length > 0;
    configs.forEach((config, i) => {
      const panel = new Panel(config, this);
      this.panels.push(panel);
      this.parent.appendChild(panel.element);

      const state = saved[config.id] ?? this.defaultState(panel, i);
      panel.applyState(state);
      panel.element.style.zIndex = String(this.zCounter++);
    });

    this.layoutReady = true;

    // Отслеживаем изменение размеров панелей (после рендера React-порталов, сворачивания и т.д.)
    this.resizeObserver = new ResizeObserver(() => {
      if (this.pendingReflow || this.reflowing) return;
      this.pendingReflow = true;
      requestAnimationFrame(() => {
        if (!this.layoutReady) {
          this.pendingReflow = false;
          return;
        }
        this.reflowing = true;
        this.reflowColumns();
        this.reflowing = false;
        this.pendingReflow = false;
      });
    });
    for (const panel of this.panels) {
      this.resizeObserver.observe(panel.element);
    }

    if (!hasSavedLayout) {
      // При первом запуске выстраиваем панели компактно, без лишних зазоров
      this.reflowColumn();
    } else {
      // Если сохранённая раскладка приводит к перекрытию — сбрасываем в аккуратный столбик
      this.sanitizeLayout();
    }

    this.saveLayout();

    window.addEventListener('resize', this.handleResize);
  }

  isLayoutReady(): boolean {
    return this.layoutReady;
  }

  isMobile(): boolean {
    return window.innerWidth < 768;
  }

  /** Сворачивает все панели кроме указанной (используется на мобильных). */
  collapseOthers(except: Panel): void {
    for (const panel of this.panels) {
      if (panel !== except && !panel.closed && !panel.collapsed) {
        panel.setCollapsedImpl(true);
      }
    }
  }

  /** Мобильная раскладка: развёрнутая панель — bottom sheet, остальные — табы внизу. */
  reflowMobile(): void {
    const visible = this.panels.filter((p) => !p.closed);
    if (visible.length === 0) return;

    const tabs = visible.filter((p) => p.collapsed);
    const expanded = visible.filter((p) => !p.collapsed);

    const tabH = 48;
    const tabCount = tabs.length;
    const tabW = tabCount > 0 ? window.innerWidth / tabCount : window.innerWidth;

    // Активная развёрнутая панель — та, что выше по z-index
    const active = expanded.length > 0
      ? expanded.reduce((a, b) => (parseInt(a.element.style.zIndex || '0') > parseInt(b.element.style.zIndex || '0') ? a : b))
      : null;

    // Раскладываем свёрнутые панели в виде табов внизу
    tabs.forEach((panel, i) => {
      panel.setPosition(Math.round(i * tabW), window.innerHeight - tabH);
      panel.setSize(Math.round(tabW), tabH);
    });

    // Активная панель занимает bottom sheet над табами
    if (active) {
      const maxSheetH = window.innerHeight - 120;
      const sheetH = Math.min(maxSheetH, Math.max(200, Math.round(window.innerHeight * 0.55)));
      const y = window.innerHeight - sheetH - tabH;
      active.setPosition(0, y);
      active.setSize(window.innerWidth, sheetH);
      this.bringToFront(active.id);
    }

    if (this.layoutReady) {
      this.saveLayout();
    }
  }

  /** Восстанавливает раскладку по умолчанию: вертикальный столбик у правого края. */
  resetLayout(): void {
    this.reflowColumn();
    this.saveLayout();
  }

  /** Раскладывает видимые панели в столбик без перекрытий, сохраняя вертикальный порядок. */
  reflowColumn(): void {
    if (this.isMobile()) {
      this.reflowMobile();
      return;
    }

    const avoid = this.avoidRect();
    let y = avoid ? avoid.bottom + AVOID_MARGIN : 60;

    const visible = this.panels
      .filter((p) => !p.closed)
      .map((p) => ({ p, rect: p.element.getBoundingClientRect() }))
      .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)
      .map((o) => o.p);

    for (const panel of visible) {
      panel.clearSize();
      const width = panel.preferredWidth;
      const effectiveWidth = Math.max(window.innerWidth, width + 32);
      const x = Math.max(16, effectiveWidth - width - 16);
      panel.setPosition(x, y);
      y += panel.element.offsetHeight + PANEL_GAP;
    }

    if (this.layoutReady) {
      this.saveLayout();
    }
  }

  /**
   * Перестраивает каждую вертикальную колонку панелей: панели с близким X
   * сохраняют своё горизонтальное положение, а по Y прилипают друг к другу
   * (нижняя к нижней границе вышестоящей) без перекрытий.
   * На мобильных устройствах переключается на bottom-sheet раскладку.
   */
  reflowColumns(): void {
    if (this.isMobile()) {
      this.reflowMobile();
      return;
    }

    const visible = this.panels.filter((p) => !p.closed);
    if (visible.length === 0) return;

    // Группируем панели в вертикальные колонки по близости X
    const columns: Panel[][] = [];
    for (const panel of visible) {
      const rect = panel.element.getBoundingClientRect();
      let found = false;
      for (const col of columns) {
        const colLeft = col[0].element.getBoundingClientRect().left;
        if (Math.abs(rect.left - colLeft) <= SNAP_THRESHOLD) {
          col.push(panel);
          found = true;
          break;
        }
      }
      if (!found) {
        columns.push([panel]);
      }
    }

    const avoid = this.avoidRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    for (const col of columns) {
      col.sort((a, b) => a.element.getBoundingClientRect().top - b.element.getBoundingClientRect().top);

      const firstRect = col[0].element.getBoundingClientRect();

      // Привязываем колонку к правому краю, если она вылезает за viewport,
      // иначе сохраняем её горизонтальное положение
      const minX = 8;
      const maxX = Math.max(minX, viewportW - firstRect.width - 8);
      let x = Math.min(Math.max(firstRect.left, minX), maxX);

      // Если колонка пересекает панель листов, начинаем ниже неё
      let y = firstRect.top;
      if (avoid && avoid.width > 0 && avoid.height > 0) {
        const overlapsSheets = x < avoid.right + AVOID_MARGIN && x + firstRect.width > avoid.left - AVOID_MARGIN;
        if (overlapsSheets) {
          y = Math.max(y, avoid.bottom + AVOID_MARGIN);
        }
      }

      for (const panel of col) {
        const rect = panel.element.getBoundingClientRect();
        // Если панель не помещается по высоте, прижимаем её к низу viewport
        const panelH = rect.height;
        if (y + panelH > viewportH - 8) {
          y = Math.max(avoid ? avoid.bottom + AVOID_MARGIN : 8, viewportH - panelH - 8);
        }
        panel.setPosition(x, y);
        y += panel.element.offsetHeight + PANEL_GAP;
      }
    }

    if (this.layoutReady) {
      this.saveLayout();
    }
  }

  private static rectsOverlap(a: DOMRect, b: DOMRect): boolean {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  /** Проверяет, перекрываются ли видимые панели, и при необходимости перестраивает их колонки. */
  private sanitizeLayout(): void {
    const rects = this.panels
      .filter(p => !p.closed)
      .map(p => p.element.getBoundingClientRect());
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        if (PanelManager.rectsOverlap(rects[i], rects[j])) {
          this.reflowColumns();
          return;
        }
      }
    }
  }

  /** Прямоугольник панели листов — плавающие панели не должны его пересекать. */
  private avoidRect(): DOMRect | null {
    return this.avoidElement?.getBoundingClientRect() ?? null;
  }

  /** Сдвигает Y вниз, если панель пересекает защищённую область (панель листов). */
  private avoidSheetsBar(x: number, y: number, w: number, h: number): number {
    const avoid = this.avoidRect();
    if (!avoid || avoid.width === 0 || avoid.height === 0) return y;
    const margin = AVOID_MARGIN;
    const panelRight = x + w;
    const panelBottom = y + h;
    const avoidRight = avoid.right + margin;
    const avoidBottom = avoid.bottom + margin;
    const intersectsX = x < avoidRight && panelRight > avoid.left - margin;
    const intersectsY = y < avoidBottom && panelBottom > avoid.top - margin;
    if (intersectsX && intersectsY) {
      return avoidBottom;
    }
    return y;
  }

  /** Раскладка по умолчанию: столбик у правого края, ниже панели листов. */
  private defaultState(panel: Panel, index: number): PanelState {
    const avoid = this.avoidRect();
    const top = avoid ? avoid.bottom + AVOID_MARGIN : 60;
    const headerH = 33;
    const bodyH = 260;
    const width = panel.preferredWidth;
    const x = window.innerWidth - width - 16;
    return {
      x,
      y: top + index * (headerH + bodyH + 12),
      xAnchor: 'right',
      xOffset: 16,
      collapsed: index > 0,
      closed: false,
    };
  }

  private loadLayout(): Record<string, PanelState> {
    try {
      const raw = localStorage.getItem(STORAGE_LAYOUT);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, PanelState>;
        const viewportW = window.innerWidth;
        for (const state of Object.values(parsed)) {
          if (state.xAnchor === undefined && viewportW > 0) {
            const width = state.w ?? PANEL_WIDTH;
            const center = state.x + width / 2;
            state.xAnchor = center < viewportW / 2 ? 'left' : 'right';
            state.xOffset = state.xAnchor === 'left' ? state.x : viewportW - (state.x + width);
          }
        }
        return parsed;
      }
    } catch {
      // ignore parse errors
    }
    return {};
  }

  saveLayout(): void {
    if (!this.layoutReady || window.innerWidth < MIN_VIEWPORT_WIDTH || this.isMobile()) return;
    const layout: Record<string, PanelState> = {};
    for (const panel of this.panels) {
      layout[panel.id] = panel.getState();
    }
    localStorage.setItem(STORAGE_LAYOUT, JSON.stringify(layout));
  }

  private clampAllToViewport(): void {
    if (window.innerWidth < MIN_VIEWPORT_WIDTH) return;
    for (const panel of this.panels) {
      const rect = panel.element.getBoundingClientRect();
      let x = Math.max(0, Math.min(window.innerWidth - rect.width, rect.left));
      let y = Math.max(0, Math.min(window.innerHeight - 40, rect.top));
      y = this.avoidSheetsBar(x, y, rect.width, rect.height);
      panel.setPosition(x, y);
    }
    this.saveLayout();
  }

  /** Магнитное прилипание к краям экрана и другим панелям. */
  snap(self: Panel, x: number, y: number): { x: number; y: number } {
    const w = self.element.offsetWidth;
    const h = self.element.offsetHeight;

    // Кандидаты для X и Y: [значение, на что выравниваем (left|right|top|bottom)]
    const xCandidates: Array<{ pos: number; align: 'left' | 'right' }> = [
      { pos: 0, align: 'left' },
      { pos: window.innerWidth, align: 'right' },
    ];
    const yCandidates: Array<{ pos: number; align: 'top' | 'bottom' }> = [
      { pos: 0, align: 'top' },
      { pos: window.innerHeight, align: 'bottom' },
    ];

    for (const other of this.panels) {
      if (other === self || other.closed) continue;
      const r = other.element.getBoundingClientRect();
      xCandidates.push({ pos: r.left, align: 'left' }, { pos: r.right, align: 'right' });
      // стыковка «друг под другом»: низ соседа → мой верх и наоборот
      yCandidates.push({ pos: r.top, align: 'top' }, { pos: r.bottom, align: 'top' });
      yCandidates.push({ pos: r.top, align: 'bottom' }, { pos: r.bottom, align: 'bottom' });
    }

    let bestX: number | null = null;
    let bestXd = SNAP_THRESHOLD + 1;
    for (const c of xCandidates) {
      const target = c.align === 'left' ? c.pos : c.pos - w;
      const d = Math.abs(x - target);
      if (d < bestXd) {
        bestXd = d;
        bestX = target;
      }
    }

    let bestY: number | null = null;
    let bestYd = SNAP_THRESHOLD + 1;
    for (const c of yCandidates) {
      const target = c.align === 'top' ? c.pos : c.pos - h;
      const d = Math.abs(y - target);
      if (d < bestYd) {
        bestYd = d;
        bestY = target;
      }
    }

    const snappedY = this.avoidSheetsBar(bestX ?? x, bestY ?? y, w, h);
    return { x: bestX ?? x, y: snappedY };
  }

  bringToFront(id: string): void {
    const panel = this.panels.find(p => p.id === id);
    if (!panel) return;
    panel.element.style.zIndex = String(this.zCounter++);
  }

  show(id: string): void {
    const panel = this.panels.find(p => p.id === id);
    if (!panel) return;
    panel.setClosed(false);
    panel.setCollapsed(false);
    this.bringToFront(id);
    this.saveLayout();
  }

  hide(id: string): void {
    const panel = this.panels.find(p => p.id === id);
    if (!panel) return;
    panel.setClosed(true);
    this.saveLayout();
  }

  toggle(id: string): void {
    const panel = this.panels.find(p => p.id === id);
    if (!panel) return;
    if (panel.closed) this.show(id);
    else this.hide(id);
  }

  isVisible(id: string): boolean {
    const panel = this.panels.find(p => p.id === id);
    return !!panel && !panel.closed;
  }

  list(): Array<{ id: string; title: string; icon: string; visible: boolean }> {
    return this.panels.map(p => ({
      id: p.id,
      title: p.config.title,
      icon: p.config.icon,
      visible: !p.closed,
    }));
  }

  destroy(): void {
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }
}
