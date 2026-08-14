import { Vector2 } from '../geometry/Vector2';
import { InputEvent } from '../engine/InputManager';
import { Plan } from '../model/Plan';
import { SnapEngine } from '../snap/SnapEngine';
import { CanvasEngine } from '../engine/CanvasEngine';
import { Tool } from './ToolManager';
import { AddPrimitiveCommand } from '../editor/CommandManager';

type TextMode = 'single' | 'multi' | 'callout';
type TextState = 'idle' | 'placing';

/**
 * Инструмент «Текст».
 * Режимы:
 *  - single:   один клик — позиция текста, затем диалог ввода.
 *  - multi:    аналогично single, но сохраняет переносы строк.
 *  - callout:  первый клик — позиция текста, второй — конец выноски, затем диалог.
 */
export class TextTool implements Tool {
  readonly name = 'text' as const;

  private state: TextState = 'idle';
  private startPoint: Vector2 | null = null;

  constructor(
    private canvas: CanvasEngine,
    private plan: Plan,
    private snapEngine: SnapEngine,
  ) {}

  private get mode(): TextMode {
    return this.canvas.editorState.get('selectedTextMode') ?? 'single';
  }

  onActivate(): void {
    this.state = 'idle';
    this.startPoint = null;
    this.canvas.setGhost(null);
    this.canvas.setSnap(null);
  }

  onDeactivate(): void {
    this.state = 'idle';
    this.startPoint = null;
    this.canvas.setGhost(null);
    this.canvas.setSnap(null);
  }

  onPointerDown(e: InputEvent): void {
    const snap = this.snapEngine.snap(e.screenPoint);
    this.canvas.setSnap(snap);

    if (this.state === 'idle') {
      if (this.mode === 'callout') {
        this.startPoint = snap.point.clone();
        this.state = 'placing';
        this.updateGhost();
        return;
      }

      this.placeText(snap.point.clone());
      return;
    }

    if (this.state === 'placing' && this.startPoint) {
      this.placeCallout(this.startPoint, snap.point.clone());
      this.state = 'idle';
      this.startPoint = null;
      this.canvas.setGhost(null);
    }
  }

  onPointerMove(e: InputEvent): void {
    if (this.state === 'placing') {
      const snap = this.snapEngine.snap(e.screenPoint);
      this.canvas.setSnap(snap);
      this.updateGhost();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onPointerUp(e: InputEvent): void {}

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      if (this.state === 'placing') {
        this.state = 'idle';
        this.startPoint = null;
        this.canvas.setGhost(null);
        this.canvas.setSnap(null);
        return true;
      }
    }
    return false;
  }

  private placeText(point: Vector2): void {
    const text = this.promptText();
    if (!text || !text.trim()) return;

    this.canvas.commandManager.execute(new AddPrimitiveCommand(this.plan, 'text', [point.clone()], text.trim(), 140));
    this.canvas.notifyChanged();
  }

  private placeCallout(start: Vector2, end: Vector2): void {
    const text = this.promptText();
    if (!text || !text.trim()) return;

    this.canvas.commandManager.execute(new AddPrimitiveCommand(this.plan, 'text', [start.clone(), end.clone()], text.trim(), 140));
    this.canvas.notifyChanged();
  }

  private promptText(): string | null {
    if (typeof window === 'undefined') return null;
    const mode = this.mode;
    const label = mode === 'multi' ? 'Введите многострочный текст (\\n — перенос):' : 'Введите текст:';
    const value = window.prompt(label, '');
    if (value === null) return null;
    return mode === 'multi' ? value.replace(/\\n/g, '\n') : value;
  }

  private updateGhost(): void {
    if (this.state !== 'placing' || !this.startPoint) {
      this.canvas.setGhost(null);
      return;
    }

    this.canvas.setGhost((ctx) => {
      const end = this.canvas.snap?.point ?? this.startPoint;
      if (!end) return;
      const color = this.canvas.themeManager.getColor('ghostWall');
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1 / this.canvas.camera.scale;

      // Линия выноски
      ctx.beginPath();
      ctx.moveTo(this.startPoint!.x, this.startPoint!.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Точка начала текста
      ctx.beginPath();
      ctx.arc(this.startPoint!.x, this.startPoint!.y, 4 / this.canvas.camera.scale, 0, Math.PI * 2);
      ctx.fill();
    });
    this.canvas.requestRender();
  }
}
