import { InputEvent } from '../engine/InputManager';

export type ToolName = 'wall' | 'door' | 'window' | 'select' | 'hand' | 'device' | 'cable' | 'dimension';

export interface Tool {
  readonly name: ToolName;
  onActivate?(): void;
  onDeactivate?(): void;
  onPointerDown?(e: InputEvent): void;
  onPointerMove?(e: InputEvent): void;
  onPointerUp?(e: InputEvent): void;
  onPointerCancel?(e: InputEvent): void;
  onDoubleClick?(e: InputEvent): void;
  onKeyDown?(e: KeyboardEvent): boolean | void;
}

/**
 * Менеджер инструментов (State Machine).
 * Поддерживает подписку на смену инструмента для UI.
 */
export class ToolManager {
  private tools = new Map<ToolName, Tool>();
  private current: Tool | null = null;
  private listeners: Array<(name: ToolName | null) => void> = [];

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  setTool(name: ToolName): void {
    if (this.current) {
      this.current.onDeactivate?.();
    }
    this.current = this.tools.get(name) ?? null;
    this.current?.onActivate?.();
    for (const listener of this.listeners) {
      listener(name);
    }
  }

  getCurrent(): Tool | null {
    return this.current;
  }

  getCurrentName(): ToolName | null {
    return this.current?.name ?? null;
  }

  onToolChange(listener: (name: ToolName | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  dispatchPointerDown(e: InputEvent): void {
    this.current?.onPointerDown?.(e);
  }

  dispatchPointerMove(e: InputEvent): void {
    this.current?.onPointerMove?.(e);
  }

  dispatchPointerUp(e: InputEvent): void {
    this.current?.onPointerUp?.(e);
  }

  dispatchPointerCancel(e: InputEvent): void {
    this.current?.onPointerCancel?.(e);
  }

  dispatchDoubleClick(e: InputEvent): void {
    this.current?.onDoubleClick?.(e);
  }

  dispatchKeyDown(e: KeyboardEvent): void {
    for (const tool of this.tools.values()) {
      const handled = tool.onKeyDown?.(e);
      if (handled) return;
    }
  }
}
