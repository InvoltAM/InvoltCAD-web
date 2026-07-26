import { icon } from './icons';

export interface PanelConfig {
  id: string;
  title: string;
  icon: string;
  body: HTMLElement;
}

interface PanelState {
  x: number;
  y: number;
  collapsed: boolean;
  closed: boolean;
}

const STORAGE_LAYOUT = 'involtcad-panels-layout';
const SNAP_THRESHOLD = 12;
const PANEL_WIDTH = 280;
const BASE_Z = 100;
const AVOID_MARGIN = 8;

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

  constructor(
    readonly config: PanelConfig,
    private manager: PanelManager,
  ) {
    this.element = this.render();
  }

  get id(): string {
    return this.config.id;
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

    el.appendChild(this.header);
    el.appendChild(this.bodyWrap);

    el.addEventListener('pointerdown', () => this.manager.bringToFront(this.id));
    this.header.addEventListener('pointerdown', e => this.onDragStart(e));

    return el;
  }

  private onDragStart(e: PointerEvent): void {
    if (e.button !== 0) return;
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

  setPosition(x: number, y: number): void {
    this.element.style.left = `${Math.round(x)}px`;
    this.element.style.top = `${Math.round(y)}px`;
    this.element.style.right = 'auto';
  }

  setCollapsed(collapsed: boolean): void {
    this.collapsed = collapsed;
    this.element.classList.toggle('collapsed', collapsed);
    const iconEl = this.collapseBtn.querySelector('.ui-icon') as HTMLElement;
    if (iconEl) {
      iconEl.innerHTML = collapsed ? icon('collapseDown') : icon('collapseUp');
    }
    this.manager.saveLayout();
  }

  setClosed(closed: boolean): void {
    this.closed = closed;
    this.element.style.display = closed ? 'none' : '';
  }

  applyState(state: PanelState): void {
    this.setPosition(state.x, state.y);
    this.setCollapsed(state.collapsed);
    this.setClosed(state.closed);
  }

  getState(): PanelState {
    return {
      x: parseFloat(this.element.style.left) || 0,
      y: parseFloat(this.element.style.top) || 0,
      collapsed: this.collapsed,
      closed: this.closed,
    };
  }
}

/**
 * Менеджер плавающих панелей: z-order, snapping, персистентность раскладки.
 */
export class PanelManager {
  private panels: Panel[] = [];
  private zCounter = BASE_Z;

  constructor(
    configs: PanelConfig[],
    private parent: HTMLElement,
    private avoidElement?: HTMLElement,
  ) {
    const saved = this.loadLayout();
    configs.forEach((config, i) => {
      const panel = new Panel(config, this);
      this.panels.push(panel);
      this.parent.appendChild(panel.element);

      const state = saved[config.id] ?? this.defaultState(i);
      panel.applyState(state);
      panel.element.style.zIndex = String(this.zCounter++);
    });
    window.addEventListener('resize', () => this.clampAllToViewport());
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
  private defaultState(index: number): PanelState {
    const avoid = this.avoidRect();
    const top = avoid ? avoid.bottom + AVOID_MARGIN : 60;
    const headerH = 33;
    const bodyH = 260;
    return {
      x: window.innerWidth - PANEL_WIDTH - 16,
      y: top + index * (headerH + bodyH + 12),
      collapsed: index > 0,
      closed: false,
    };
  }

  private loadLayout(): Record<string, PanelState> {
    try {
      const raw = localStorage.getItem(STORAGE_LAYOUT);
      if (raw) return JSON.parse(raw) as Record<string, PanelState>;
    } catch {
      // ignore parse errors
    }
    return {};
  }

  saveLayout(): void {
    const layout: Record<string, PanelState> = {};
    for (const panel of this.panels) {
      layout[panel.id] = panel.getState();
    }
    localStorage.setItem(STORAGE_LAYOUT, JSON.stringify(layout));
  }

  private clampAllToViewport(): void {
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
}
