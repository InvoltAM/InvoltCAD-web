import { Plan } from '@core/model/Plan';
import { CanvasEngine } from '@core/engine/CanvasEngine';
import { icon } from './icons';

/**
 * Горизонтальная панель листов проекта сверху экрана.
 * Переключение, добавление, переименование (даблклик), перетаскивание
 * для изменения порядка и удаление листов.
 */
export class SheetsBar {
  readonly element: HTMLDivElement;
  private draggedSheetId: string | null = null;

  constructor(
    private plan: Plan,
    private engine: CanvasEngine,
    parent: HTMLElement,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'sheets-bar';
    parent.appendChild(this.element);
    this.refresh();
  }

  refresh(): void {
    this.element.innerHTML = '';

    const tabs = document.createElement('div');
    tabs.className = 'sheets-bar-tabs';

    for (const sheet of this.plan.sheets) {
      tabs.appendChild(this.renderTab(sheet.id, sheet.name));
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'sheet-add';
    addBtn.title = 'Добавить лист';
    addBtn.innerHTML = `<span class="ui-icon">${icon('zoomIn')}</span>`;
    addBtn.addEventListener('click', () => this.addSheet());

    this.element.appendChild(tabs);
    this.element.appendChild(addBtn);
  }

  private renderTab(id: string, name: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'sheet-tab' + (id === this.plan.activeSheet.id ? ' active' : '');
    btn.dataset.sheet = id;
    btn.draggable = true;
    btn.title = `${name} — двойной клик для переименования`;

    const label = document.createElement('span');
    label.className = 'sheet-tab-label';
    label.textContent = name;
    btn.appendChild(label);

    // Удаление доступно, если листов больше одного
    if (this.plan.sheets.length > 1) {
      const close = document.createElement('span');
      close.className = 'sheet-tab-close';
      close.title = 'Удалить лист';
      close.textContent = '×';
      close.addEventListener('click', e => {
        e.stopPropagation();
        this.confirmDelete(id, close);
      });
      btn.appendChild(close);
    }

    btn.addEventListener('click', () => this.switchTo(id));
    btn.addEventListener('dblclick', () => this.startRename(btn, id));

    // Перетаскивание для изменения порядка
    btn.addEventListener('dragstart', e => {
      this.draggedSheetId = id;
      e.dataTransfer?.setData('text/plain', id);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      btn.classList.add('dragging');
    });
    btn.addEventListener('dragover', e => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      btn.classList.add('drop-target');
    });
    btn.addEventListener('dragleave', () => btn.classList.remove('drop-target'));
    btn.addEventListener('drop', e => {
      e.preventDefault();
      const draggedId = e.dataTransfer?.getData('text/plain') ?? this.draggedSheetId;
      if (draggedId && draggedId !== id) {
        this.moveSheet(draggedId, id);
      }
    });
    btn.addEventListener('dragend', () => {
      this.draggedSheetId = null;
      this.element.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
      this.element.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    });

    return btn;
  }

  private switchTo(id: string): void {
    if (id === this.plan.activeSheet.id) return;
    this.plan.setActiveSheet(id);
    this.onSheetChanged();
  }

  private addSheet(): void {
    const base = 'Новый лист';
    let name = base;
    let n = 2;
    while (this.plan.sheets.some(s => s.name === name)) {
      name = `${base} ${n++}`;
    }
    const sheet = this.plan.addSheet(name);
    this.onSheetChanged();
    // Сразу предлагаем переименовать
    const tab = this.element.querySelector(`.sheet-tab[data-sheet="${sheet.id}"]`) as HTMLButtonElement;
    if (tab) this.startRename(tab, sheet.id);
  }

  private startRename(tab: HTMLButtonElement, id: string): void {
    const sheet = this.plan.sheets.find(s => s.id === id);
    if (!sheet) return;
    const label = tab.querySelector('.sheet-tab-label') as HTMLElement;
    const input = document.createElement('input');
    input.className = 'sheet-tab-input';
    input.value = sheet.name;
    label.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const finish = (commit: boolean): void => {
      if (done) return;
      done = true;
      const value = input.value.trim();
      if (commit && value && value !== sheet.name) {
        sheet.name = value;
        this.engine.notifyChanged();
      }
      this.refresh();
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
      e.stopPropagation();
    });
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('dblclick', e => e.stopPropagation());
  }

  /** Двухшаговое удаление: первый клик «вооружает» крестик, второй — удаляет. */
  private confirmDelete(id: string, closeEl: HTMLElement): void {
    if (!closeEl.classList.contains('armed')) {
      closeEl.classList.add('armed');
      closeEl.textContent = '!';
      setTimeout(() => {
        closeEl.classList.remove('armed');
        closeEl.textContent = '×';
      }, 3000);
      return;
    }
    this.plan.removeSheet(id);
    this.onSheetChanged();
  }

  private moveSheet(draggedId: string, targetId: string): void {
    const from = this.plan.sheets.findIndex(s => s.id === draggedId);
    const to = this.plan.sheets.findIndex(s => s.id === targetId);
    if (from === -1 || to === -1) return;
    this.plan.sheets.splice(to, 0, this.plan.sheets.splice(from, 1)[0]);
    this.engine.notifyChanged();
    this.refresh();
  }

  private onSheetChanged(): void {
    this.engine.setSelectedWall(null);
    this.engine.setSelectedOpening(null);
    this.engine.setSelectedDevice(null);
    this.engine.setSelectedCable(null);
    this.engine.commandManager.clear();
    this.engine.notifyChanged();
    this.refresh();
  }
}
