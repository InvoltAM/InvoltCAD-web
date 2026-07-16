import { Camera } from './Camera';
import { InputManager, InputEvent } from './InputManager';
import { Plan } from '../model/Plan';
import { Vector2 } from '../geometry/Vector2';
import { SnapEngine, SnapResult } from '../snap/SnapEngine';
import { GridRenderer } from '../render/GridRenderer';
import { WallRenderer } from '../render/WallRenderer';
import { OpeningRenderer } from '../render/OpeningRenderer';
import { GhostRenderer } from '../render/GhostRenderer';
import { DimensionRenderer } from '../render/DimensionRenderer';
import { DeviceRenderer } from '../render/DeviceRenderer';
import { CableRenderer } from '../render/CableRenderer';
import { RoomRenderer } from '../render/RoomRenderer';
import { WallDimensionRenderer } from '../render/WallDimensionRenderer';
import { ToolManager, ToolName } from '../tools/ToolManager';
import { EditorState } from '../editor/EditorState';
import { CommandManager } from '../editor/CommandManager';
import { ValidationIssue } from '../rules/ValidationTypes';
import { ThemeManager } from '../editor/ThemeManager';

/**
 * Главный движок редактора.
 * Управляет canvas, камерой, вводом, отрисовкой слоев, инструментами,
 * состоянием редактора и undo/redo.
 */
export class CanvasEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  camera: Camera;

  ghostRenderer: GhostRenderer;
  gridRenderer: GridRenderer;
  wallRenderer: WallRenderer;
  openingRenderer: OpeningRenderer;
  dimensionRenderer: DimensionRenderer;
  deviceRenderer: DeviceRenderer;
  cableRenderer: CableRenderer;
  roomRenderer!: RoomRenderer;
  wallDimensionRenderer!: WallDimensionRenderer;
  input: InputManager;
  snapEngine: SnapEngine;
  toolManager: ToolManager;
  editorState: EditorState;
  commandManager: CommandManager;

  snap: SnapResult | null = null;
  private ghostDraw: ((ctx: CanvasRenderingContext2D) => void) | null = null;

  private rafId = 0;
  private needsRender = false;
  private resizeHandler: () => void;
  private keydownHandler!: (e: KeyboardEvent) => void;
  private themeUnsubscribe: (() => void) | null = null;

  onChange?: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    public plan: Plan,
    private themeManager: ThemeManager,
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D не поддерживается');
    this.ctx = ctx;

    this.editorState = new EditorState();
    this.commandManager = new CommandManager(() => this.notifyChanged());

    this.camera = new Camera();
    this.resize();

    this.snapEngine = new SnapEngine(plan, this.camera);
    this.ghostRenderer = new GhostRenderer(this.camera, this.themeManager);
    this.gridRenderer = new GridRenderer(this.camera, this.themeManager);
    this.wallRenderer = new WallRenderer(plan, this.camera, this.editorState, this.themeManager);
    this.openingRenderer = new OpeningRenderer(plan, this.camera, this.themeManager);
    this.dimensionRenderer = new DimensionRenderer(plan, this.camera, this.themeManager);
    this.deviceRenderer = new DeviceRenderer(plan, this.camera, this.editorState, this.themeManager);
    this.cableRenderer = new CableRenderer(plan, this.camera, this.editorState, this.themeManager);
    this.roomRenderer = new RoomRenderer(plan, this.camera, this.themeManager);
    this.wallDimensionRenderer = new WallDimensionRenderer(plan, this.camera, this.themeManager);

    this.input = new InputManager(canvas, this.camera);
    this.setupInput();

    this.toolManager = new ToolManager();

    // Синхронизация zoom из камеры в EditorState
    this.editorState.set('zoom', this.camera.scale);

    this.resizeHandler = () => {
      this.resize();
      this.requestRender();
    };
    window.addEventListener('resize', this.resizeHandler);

    // Перерисовка при смене темы
    this.themeUnsubscribe = this.themeManager.subscribe(() => this.requestRender());

    this.requestRender();
  }

  destroy(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.input.destroy();
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('keydown', this.keydownHandler);
    this.themeUnsubscribe?.();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private setupInput(): void {
    this.input.onPan = (dx, dy) => this.camera.panBy(dx, dy);
    this.input.onZoom = (pt, f) => {
      this.camera.zoomAt(pt, f);
      this.editorState.set('zoom', this.camera.scale);
    };
    this.input.onRequestRender = () => this.requestRender();

    this.input.onPointerDown = (e) => {
      if (this.toolManager.getCurrentName() === 'hand') return;
      this.toolManager.dispatchPointerDown(e);
    };
    this.input.onPointerMove = (e) => {
      if (this.toolManager.getCurrentName() === 'hand') return;
      this.toolManager.dispatchPointerMove(e);
    };
    this.input.onPointerUp = (e) => {
      if (this.toolManager.getCurrentName() === 'hand') return;
      this.toolManager.dispatchPointerUp(e);
    };
    this.input.onDoubleClick = (e) => {
      if (this.toolManager.getCurrentName() === 'hand') return;
      this.toolManager.dispatchDoubleClick(e);
    };

    this.keydownHandler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.commandManager.redo();
        else this.commandManager.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        this.commandManager.redo();
        return;
      }
      this.toolManager.dispatchKeyDown(e);
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const w = rect?.width ?? window.innerWidth;
    const h = rect?.height ?? window.innerHeight;

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.setViewport(w, h);
  }

  requestRender(): void {
    this.needsRender = true;
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => this.render());
  }

  private render(): void {
    this.rafId = 0;
    if (!this.needsRender) return;
    this.needsRender = false;

    const ctx = this.ctx;
    const w = this.camera.viewportWidth;
    const h = this.camera.viewportHeight;
    const layers = this.editorState.get('layers');

    // 1. Фон
    ctx.fillStyle = this.themeManager.getColor('canvasBg');
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    this.camera.applyTransform(ctx);

    // 2. Сетка
    this.gridRenderer.render(ctx);

    // 3. Комнаты (под стенами)
    if (layers.rooms) {
      this.roomRenderer.render(ctx);
    }

    // 4. Размерные линии
    if (layers.dimensions) {
      this.dimensionRenderer.render(ctx);
    }

    // 5. Авторазмеры стен
    if (layers.wallDimensions) {
      this.wallDimensionRenderer.render(ctx);
    }

    // 6. Стены
    if (layers.walls) {
      this.wallRenderer.render(ctx);
    }

    // 7. Проемы
    if (layers.openings) {
      this.openingRenderer.render(ctx);
    }

    // 8. Устройства
    if (layers.devices) {
      this.deviceRenderer.render(ctx);
    }

    // 9. Кабели
    if (layers.cables) {
      this.cableRenderer.render(ctx);
    }

    // 10. Ghost-слой
    if (this.ghostDraw) {
      this.ghostDraw(ctx);
    }

    ctx.restore();

    // 11. Маркеры валидации (в экранных координатах)
    if (this.editorState.get('showValidation')) {
      this.renderValidationMarkers(ctx);
    }

    // 12. Лупа для touch (в экранных координатах)
    if (this.magnifierScreenPoint) {
      const magCanvas = this.ghostRenderer.renderMagnifier(
        this.canvas, this.magnifierScreenPoint, 60, 2,
      );
      const size = 120;
      const x = Math.min(this.camera.viewportWidth - size - 10, this.magnifierScreenPoint.x + 20);
      const y = Math.max(10, this.magnifierScreenPoint.y - size - 20);
      ctx.drawImage(magCanvas, x, y);
    }
  }

  private magnifierScreenPoint: Vector2 | null = null;

  showMagnifier(screenPoint: Vector2): void {
    this.magnifierScreenPoint = screenPoint;
    this.requestRender();
  }

  hideMagnifier(): void {
    this.magnifierScreenPoint = null;
    this.requestRender();
  }

  /** Установить функцию отрисовки ghost-слоя или null. */
  setGhost(draw: ((ctx: CanvasRenderingContext2D) => void) | null): void {
    this.ghostDraw = draw;
  }

  setSnap(snap: SnapResult | null): void {
    this.snap = snap;
  }

  /** Регистрация инструмента. */
  registerTool(name: ToolName, tool: { name: ToolName } & any): void {
    this.toolManager.register(tool);
  }

  setTool(name: ToolName): void {
    this.toolManager.setTool(name);
    this.editorState.set('currentTool', name);
    // Сбрасываем выделение при переключении на инструмент рисования
    if (name !== 'select' && name !== 'hand') {
      this.setSelectedWall(null);
      this.setSelectedOpening(null);
      this.setSelectedDevice(null);
      this.setSelectedCable(null);
      this.setSelectedDimension(null);
      this.setSelectedRoom(null);
    }
  }

  getCurrentTool(): ToolName | null {
    return this.toolManager.getCurrentName();
  }

  setSelectedWall(id: string | null): void {
    this.editorState.set('selectedWallId', id);
    this.wallRenderer.setSelectedWall(id);
    if (id) this.editorState.set('selectedOpeningId', null);
    this.requestRender();
  }

  setSelectedOpening(id: string | null): void {
    this.editorState.set('selectedOpeningId', id);
    this.openingRenderer.setSelectedOpening(id);
    if (id) {
      this.editorState.set('selectedWallId', null);
      this.editorState.set('selectedDeviceId', null);
      this.editorState.set('selectedCableId', null);
    }
    this.requestRender();
  }

  setSelectedDevice(id: string | null): void {
    this.editorState.set('selectedDeviceId', id);
    this.deviceRenderer.setSelectedDevice(id);
    if (id) {
      this.editorState.set('selectedWallId', null);
      this.editorState.set('selectedOpeningId', null);
      this.editorState.set('selectedCableId', null);
    }
    this.requestRender();
  }

  setSelectedCable(id: string | null): void {
    this.editorState.set('selectedCableId', id);
    this.cableRenderer.setSelectedCable(id);
    if (id) {
      this.editorState.set('selectedWallId', null);
      this.editorState.set('selectedOpeningId', null);
      this.editorState.set('selectedDeviceId', null);
    }
    this.requestRender();
  }

  setSelectedDimension(id: string | null): void {
    this.editorState.set('selectedDimensionId', id);
    this.dimensionRenderer.setSelectedDimension(id);
    if (id) {
      this.editorState.set('selectedWallId', null);
      this.editorState.set('selectedOpeningId', null);
      this.editorState.set('selectedDeviceId', null);
      this.editorState.set('selectedCableId', null);
      this.editorState.set('selectedRoomIndex', null);
    }
    this.requestRender();
  }

  setSelectedRoom(index: number | null): void {
    this.editorState.set('selectedRoomIndex', index);
    this.roomRenderer.setSelectedRoom(index);
    if (index !== null) {
      this.editorState.set('selectedWallId', null);
      this.editorState.set('selectedOpeningId', null);
      this.editorState.set('selectedDeviceId', null);
      this.editorState.set('selectedCableId', null);
      this.editorState.set('selectedDimensionId', null);
    }
    this.requestRender();
  }

  getSelectedRoom(): number | null {
    return this.editorState.get('selectedRoomIndex');
  }

  getSelectedWall(): string | null {
    return this.editorState.get('selectedWallId');
  }

  getSelectedOpening(): string | null {
    return this.editorState.get('selectedOpeningId');
  }

  getSelectedDevice(): string | null {
    return this.editorState.get('selectedDeviceId');
  }

  getSelectedCable(): string | null {
    return this.editorState.get('selectedCableId');
  }

  getSelectedDimension(): string | null {
    return this.editorState.get('selectedDimensionId');
  }

  /** Уведомить об изменении плана (autosave + render). */
  notifyChanged(): void {
    this.plan.recalcCableRoutes();
    this.onChange?.();
    this.requestRender();
  }

  /** Центрировать камеру на мировой точке. */
  focusOn(point: Vector2, scale = 0.2): void {
    this.camera.focusOn(point, scale);
    this.requestRender();
  }

  private renderValidationMarkers(ctx: CanvasRenderingContext2D): void {
    const issues = this.editorState.get('validationIssues');
    if (!issues || issues.length === 0) return;

    for (const issue of issues) {
      const pos = this.resolveIssuePosition(issue);
      if (!pos) continue;
      const screen = this.camera.worldToScreen(pos);
      const color = issue.severity === 'error' ? '#dc2626' : issue.severity === 'warning' ? '#eab308' : '#3b82f6';

      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
  }

  private resolveIssuePosition(issue: ValidationIssue): Vector2 | null {
    if (issue.position) return issue.position;
    if (!issue.objectId) return null;

    switch (issue.type) {
      case 'device': {
        const device = this.plan.findDevice(issue.objectId);
        return device ? this.plan.deviceWorldPosition(device) : null;
      }
      case 'cable': {
        const cable = this.plan.findCable(issue.objectId);
        if (!cable || cable.route.length === 0) return null;
        let x = 0, y = 0;
        for (const p of cable.route) { x += p.x; y += p.y; }
        return new Vector2(x / cable.route.length, y / cable.route.length);
      }
      case 'wall': {
        const wall = this.plan.findWall(issue.objectId);
        return wall ? wall.a.add(wall.b).scale(0.5) : null;
      }
      case 'opening': {
        const found = this.plan.findOpening(issue.objectId);
        if (!found) return null;
        const wall = found.wall;
        const len = wall.a.distanceTo(wall.b);
        const dir = wall.b.sub(wall.a).scale(1 / len);
        return wall.a.add(dir.scale(found.opening.t * len));
      }
      default:
        return null;
    }
  }

  /** Полная очистка плана. */
  clearPlan(): void {
    this.plan.walls = [];
    this.plan.devices = [];
    this.plan.cables = [];
    this.setSelectedWall(null);
    this.setSelectedOpening(null);
    this.setSelectedDevice(null);
    this.setSelectedCable(null);
    this.setSelectedDimension(null);
    this.notifyChanged();
  }
}
