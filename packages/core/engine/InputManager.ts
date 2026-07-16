import { Vector2 } from '../geometry/Vector2';
import { Camera } from './Camera';

export interface PointerState {
  id: number;
  screen: Vector2;
  world: Vector2;
  type: string;
  button: number;
}

export interface InputEvent {
  pointerId: number;
  screenPoint: Vector2;
  worldPoint: Vector2;
  pointerType: string;
  button: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

export type ToolEventName = 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel';

/**
 * Универсальный обработчик ввода: мышь, тач, стилус.
 * Разделяет жесты панорамирования/зума и события инструментов.
 */
export class InputManager {
  private pointers = new Map<number, PointerState>();
  private canvas: HTMLCanvasElement;
  private camera: Camera;

  /** Подписчики на события инструментов. */
  onPointerDown?: (e: InputEvent) => void;
  onPointerMove?: (e: InputEvent) => void;
  onPointerUp?: (e: InputEvent) => void;
  onPointerCancel?: (e: InputEvent) => void;
  onDoubleClick?: (e: InputEvent) => void;

  /** Подписчики на навигацию. */
  onPan?: (dx: number, dy: number) => void;
  onZoom?: (screenPoint: Vector2, factor: number) => void;
  onRequestRender?: () => void;

  private panning = false;
  private lastPanScreen = new Vector2(0, 0);
  private panButton = 1; // средняя кнопка мыши

  // pinch
  private initialPinchDist = 0;
  private initialScale = 1;
  private lastPinchCenter = new Vector2(0, 0);

  // tap detection
  private tapStartScreen = new Vector2(0, 0);
  private tapStartTime = 0;
  private readonly tapThresholdPx = 6;

  // space pan
  private spacePressed = false;

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    this.canvas = canvas;
    this.camera = camera;

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerUp);
    canvas.addEventListener('dblclick', this.handleDoubleClick);
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  private makeEvent(ev: PointerEvent): InputEvent {
    const screenPoint = this.clientToCanvas(ev.clientX, ev.clientY);
    return {
      pointerId: ev.pointerId,
      screenPoint,
      worldPoint: this.camera.screenToWorld(screenPoint),
      pointerType: ev.pointerType,
      button: ev.button,
      shiftKey: ev.shiftKey,
      ctrlKey: ev.ctrlKey,
      altKey: ev.altKey,
    };
  }

  /** Преобразует viewport-координаты курсора в координаты canvas (CSS-пиксели). */
  private clientToCanvas(clientX: number, clientY: number): Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    return new Vector2(clientX - rect.left, clientY - rect.top);
  }

  private handlePointerDown = (ev: PointerEvent) => {
    ev.preventDefault();
    this.canvas.setPointerCapture(ev.pointerId);

    const screen = this.clientToCanvas(ev.clientX, ev.clientY);
    const state: PointerState = {
      id: ev.pointerId,
      screen,
      world: this.camera.screenToWorld(screen),
      type: ev.pointerType,
      button: ev.button,
    };
    this.pointers.set(ev.pointerId, state);

    // Начало pan / pinch
    if (this.pointers.size === 1) {
      this.tapStartScreen = screen.clone();
      this.tapStartTime = performance.now();
      this.lastPanScreen = screen.clone();

      // Средняя кнопка мыши или Space+левая → pan
      if (ev.button === this.panButton || (this.spacePressed && ev.button === 0)) {
        this.panning = true;
        return;
      }

      // На touch одним пальцем при выбранном инструменте — событие инструменту
      this.onPointerDown?.(this.makeEvent(ev));
    } else if (this.pointers.size === 2) {
      // Начало pinch
      this.panning = false;
      const pts = Array.from(this.pointers.values());
      this.initialPinchDist = pts[0].screen.distanceTo(pts[1].screen);
      this.initialScale = 1;
      this.lastPinchCenter = pts[0].screen.add(pts[1].screen).scale(0.5);
    }
  };

  private handlePointerMove = (ev: PointerEvent) => {
    ev.preventDefault();
    const screen = this.clientToCanvas(ev.clientX, ev.clientY);
    const state = this.pointers.get(ev.pointerId);
    if (state) {
      state.screen = screen;
      state.world = this.camera.screenToWorld(screen);
    }

    if (this.pointers.size === 2) {
      // Pinch zoom + pan
      const pts = Array.from(this.pointers.values());
      const d = pts[0].screen.distanceTo(pts[1].screen);
      if (this.initialPinchDist > 0) {
        const factor = d / this.initialPinchDist;
        const center = pts[0].screen.add(pts[1].screen).scale(0.5);
        this.onZoom?.(center, factor / this.initialScale);
        this.initialScale = factor;

        // Pan по центру pinch
        const dx = center.x - this.lastPinchCenter.x;
        const dy = center.y - this.lastPinchCenter.y;
        if (dx !== 0 || dy !== 0) this.onPan?.(dx, dy);
        this.lastPinchCenter = center;
        this.onRequestRender?.();
      }
      return;
    }

    if (this.panning && this.pointers.size === 1 && state) {
      const dx = screen.x - this.lastPanScreen.x;
      const dy = screen.y - this.lastPanScreen.y;
      if (dx !== 0 || dy !== 0) {
        this.onPan?.(dx, dy);
        this.lastPanScreen = screen.clone();
        this.onRequestRender?.();
      }
      return;
    }

    // Hover / drag — передаем инструменту, если не panning и не pinch
    if (this.pointers.size <= 1 && !this.panning) {
      this.onPointerMove?.(this.makeEvent(ev));
    }
  };

  private handlePointerUp = (ev: PointerEvent) => {
    ev.preventDefault();
    this.pointers.delete(ev.pointerId);

    if (this.panning) {
      this.panning = false;
      if (this.pointers.size === 0) return;
    }

    // Если один pointer остался после pinch — передаем ему событие down для инструмента
    if (this.pointers.size === 1) {
      const remaining = Array.from(this.pointers.values())[0];
      this.onPointerDown?.({
        pointerId: remaining.id,
        screenPoint: remaining.screen,
        worldPoint: remaining.world,
        pointerType: remaining.type,
        button: 0,
        shiftKey: false,
        ctrlKey: false,
        altKey: false,
      });
      return;
    }

    // Tap detection: если pointer не сдвинулся больше порога — это click для инструмента
    const screen = this.clientToCanvas(ev.clientX, ev.clientY);
    const moved = screen.distanceTo(this.tapStartScreen);
    const duration = performance.now() - this.tapStartTime;
    if (moved < this.tapThresholdPx && duration < 500) {
      this.onPointerUp?.(this.makeEvent(ev));
    } else {
      this.onPointerUp?.(this.makeEvent(ev));
    }
  };

  private handleDoubleClick = (ev: MouseEvent) => {
    ev.preventDefault();
    this.onDoubleClick?.(this.makeMouseEvent(ev));
  };

  private makeMouseEvent(ev: MouseEvent): InputEvent {
    const screenPoint = this.clientToCanvas(ev.clientX, ev.clientY);
    return {
      pointerId: 0,
      screenPoint,
      worldPoint: this.camera.screenToWorld(screenPoint),
      pointerType: 'mouse',
      button: ev.button,
      shiftKey: ev.shiftKey,
      ctrlKey: ev.ctrlKey,
      altKey: ev.altKey,
    };
  }

  private handleWheel = (ev: WheelEvent) => {
    ev.preventDefault();
    const screenPoint = this.clientToCanvas(ev.clientX, ev.clientY);
    const factor = ev.deltaY < 0 ? 1.1 : 0.9;
    this.onZoom?.(screenPoint, factor);
    this.onRequestRender?.();
  };

  private handleKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === ' ' && !this.spacePressed) {
      this.spacePressed = true;
    }
  };

  private handleKeyUp = (ev: KeyboardEvent) => {
    if (ev.key === ' ') {
      this.spacePressed = false;
    }
  };

  isPanning(): boolean {
    return this.panning;
  }

  /** Есть ли активный touch-ввод (хотя бы один pointer типа touch). */
  isActiveTouch(): boolean {
    for (const state of this.pointers.values()) {
      if (state.type === 'touch') return true;
    }
    return false;
  }
}
