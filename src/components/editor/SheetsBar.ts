import { Plan } from '@core/model/Plan';
import { CanvasEngine } from '@core/engine/CanvasEngine';
import { ThemeManager } from '@core/editor/ThemeManager';
import { PageSize, PageOrientation, PAGE_SIZES, Sheet, SheetTitleBlock, TitleBlockVisibility } from '@core/model/Sheet';
import { projectSync } from '@/lib/projects/sync';
import { exportPng, exportXlsx, exportSvg, exportPrint, exportDxf, exportPdf } from '@/lib/export';
import { icon, IconName } from './icons';

/**
 * Горизонтальная панель листов проекта сверху экрана.
 * Переключение, добавление, переименование (даблклик), перетаскивание
 * для изменения порядка и удаление листов.
 */
export class SheetsBar {
  readonly element: HTMLDivElement;
  private draggedSheetId: string | null = null;
  private activeMenuSheetId: string | null = null;
  private activeMenuEl: HTMLDivElement | null = null;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    private plan: Plan,
    private engine: CanvasEngine,
    private themeManager: ThemeManager,
    parent: HTMLElement,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'sheets-bar';
    parent.appendChild(this.element);
    this.refresh();
  }

  refresh(): void {
    // Если открыто меню, не пересоздаём панель — иначе интерактивные контролы
    // (file input, textbox) теряют фокус и состояние.
    if (this.activeMenuEl) return;
    this.element.innerHTML = '';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'sheet-stamp-btn';
    saveBtn.title = 'Сохранить (Ctrl+S)';
    saveBtn.innerHTML = `<span class="ui-icon">${icon('save')}</span>`;
    saveBtn.addEventListener('click', async () => {
      try {
        await projectSync.saveProject(this.engine.plan);
        alert('Проект сохранён');
      } catch {
        alert('Ошибка сохранения проекта');
      }
    });

    const printBtn = document.createElement('button');
    printBtn.className = 'sheet-stamp-btn';
    printBtn.title = 'Печать / PDF';
    printBtn.innerHTML = `<span class="ui-icon">${icon('print')}</span>`;
    printBtn.addEventListener('click', () => {
      exportPrint(this.engine, this.themeManager);
    });

    const exportBtn = document.createElement('button');
    exportBtn.className = 'sheet-stamp-btn';
    exportBtn.title = 'Экспорт';
    exportBtn.innerHTML = `<span class="ui-icon">${icon('exportSvg')}</span>`;
    exportBtn.addEventListener('click', () => {
      if (this.activeMenuEl && this.activeMenuEl.classList.contains('export-menu')) {
        this.closeMenu();
      } else {
        this.openExportMenu(exportBtn);
      }
    });

    const stampBtn = document.createElement('button');
    stampBtn.className = 'sheet-stamp-btn';
    stampBtn.title = 'Штамп';
    stampBtn.innerHTML = `<span class="ui-icon">${icon('stamp')}</span>`;
    stampBtn.addEventListener('click', () => {
      if (this.activeMenuEl && this.activeMenuEl.classList.contains('stamp-menu')) {
        this.closeMenu();
      } else {
        this.openStampMenu(stampBtn);
      }
    });

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

    const divider = document.createElement('div');
    divider.className = 'sheets-bar-divider';

    this.element.appendChild(saveBtn);
    this.element.appendChild(printBtn);
    this.element.appendChild(exportBtn);
    this.element.appendChild(divider);
    this.element.appendChild(stampBtn);
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

    // Меню формата листа (span role="button", т.к. вложенная <button> невалидна)
    const menuBtn = document.createElement('span');
    menuBtn.className = 'sheet-tab-menu-btn';
    menuBtn.title = 'Формат листа';
    menuBtn.setAttribute('role', 'button');
    menuBtn.tabIndex = 0;
    menuBtn.draggable = false;
    menuBtn.innerHTML = `<span class="ui-icon">${icon('dotsThreeVertical')}</span>`;
    menuBtn.addEventListener('pointerdown', e => {
      e.stopPropagation();
    });
    menuBtn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      this.toggleMenu(id, menuBtn);
    });
    menuBtn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        this.toggleMenu(id, menuBtn);
      }
    });
    btn.appendChild(menuBtn);

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

  private toggleMenu(sheetId: string, anchor: HTMLElement): void {
    if (this.activeMenuSheetId === sheetId) {
      this.closeMenu();
      return;
    }
    this.closeMenu();
    this.openMenu(sheetId, anchor);
  }

  private applyAutoNumbering(sheet: Sheet): void {
    const index = this.plan.sheets.findIndex(s => s.id === sheet.id);
    if (index === -1) return;
    const base = parseInt(sheet.titleBlock.sheetNo, 10);
    if (Number.isNaN(base)) return;
    for (let i = index + 1; i < this.plan.sheets.length; i++) {
      this.plan.sheets[i].titleBlock.sheetNo = String(base + (i - index));
    }
  }

  private openMenu(sheetId: string, anchor: HTMLElement): void {
    const sheet = this.plan.sheets.find(s => s.id === sheetId);
    if (!sheet) return;

    const menu = document.createElement('div');
    menu.className = 'sheet-tab-menu';

    const createRow = (label: string, control: HTMLElement): HTMLDivElement => {
      const row = document.createElement('div');
      row.className = 'sheet-tab-menu-row';
      const labelEl = document.createElement('span');
      labelEl.className = 'sheet-tab-menu-label';
      labelEl.textContent = label;
      row.appendChild(labelEl);
      row.appendChild(control);
      return row;
    };

    const formatSelect = document.createElement('select');
    formatSelect.className = 'sheet-tab-menu-select';
    for (const size of PAGE_SIZES) {
      const opt = document.createElement('option');
      opt.value = size;
      opt.textContent = size;
      if (sheet.pageSize === size) opt.selected = true;
      formatSelect.appendChild(opt);
    }
    formatSelect.addEventListener('change', () => {
      sheet.pageSize = formatSelect.value as PageSize;
      this.engine.notifyChanged();
      this.engine.fitToSheet();
    });
    menu.appendChild(createRow('Формат', formatSelect));

    const orientationSelect = document.createElement('select');
    orientationSelect.className = 'sheet-tab-menu-select';
    const orientations: Array<{ value: PageOrientation; label: string }> = [
      { value: 'landscape', label: 'Альбомная' },
      { value: 'portrait', label: 'Портретная' },
    ];
    for (const o of orientations) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      if (sheet.orientation === o.value) opt.selected = true;
      orientationSelect.appendChild(opt);
    }
    orientationSelect.addEventListener('change', () => {
      sheet.orientation = orientationSelect.value as PageOrientation;
      this.engine.notifyChanged();
      this.engine.fitToSheet();
    });
    menu.appendChild(createRow('Ориентация', orientationSelect));

    const scaleSelect = document.createElement('select');
    scaleSelect.className = 'sheet-tab-menu-select';
    const scales = [50, 100, 200, 500, 1000];
    for (const scale of scales) {
      const opt = document.createElement('option');
      opt.value = String(scale);
      opt.textContent = `1:${scale}`;
      if (sheet.printScale === scale) opt.selected = true;
      scaleSelect.appendChild(opt);
    }
    scaleSelect.addEventListener('change', () => {
      sheet.printScale = Number(scaleSelect.value);
      this.engine.notifyChanged();
      this.engine.fitToSheet();
    });
    menu.appendChild(createRow('Масштаб', scaleSelect));

    const sheetNoInput = document.createElement('input');
    sheetNoInput.className = 'sheet-tab-menu-input';
    sheetNoInput.type = 'text';
    sheetNoInput.value = sheet.titleBlock.sheetNo;
    sheetNoInput.addEventListener('change', () => {
      sheet.titleBlock.sheetNo = sheetNoInput.value;
      if (sheet.titleBlock.autoNumbering) {
        this.applyAutoNumbering(sheet);
      }
      this.engine.notifyChanged();
    });
    sheetNoInput.addEventListener('keydown', e => e.stopPropagation());
    menu.appendChild(createRow('Лист', sheetNoInput));

    const sheetTotalInput = document.createElement('input');
    sheetTotalInput.className = 'sheet-tab-menu-input';
    sheetTotalInput.type = 'text';
    sheetTotalInput.value = sheet.titleBlock.sheetTotal;
    sheetTotalInput.addEventListener('change', () => {
      sheet.titleBlock.sheetTotal = sheetTotalInput.value;
      this.engine.notifyChanged();
    });
    sheetTotalInput.addEventListener('keydown', e => e.stopPropagation());
    menu.appendChild(createRow('Листов', sheetTotalInput));

    const autoNumberingCheckbox = document.createElement('input');
    autoNumberingCheckbox.className = 'sheet-tab-menu-check';
    autoNumberingCheckbox.type = 'checkbox';
    autoNumberingCheckbox.checked = sheet.titleBlock.autoNumbering;
    autoNumberingCheckbox.title = 'Автонумеровать следующие листы';
    autoNumberingCheckbox.addEventListener('change', () => {
      sheet.titleBlock.autoNumbering = autoNumberingCheckbox.checked;
      if (sheet.titleBlock.autoNumbering) {
        this.applyAutoNumbering(sheet);
      }
      this.engine.notifyChanged();
    });
    autoNumberingCheckbox.addEventListener('click', e => e.stopPropagation());
    menu.appendChild(createRow('Автонумерация', autoNumberingCheckbox));

    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${Math.round(rect.left)}px`;
    menu.style.top = `${Math.round(rect.bottom + 6)}px`;
    document.body.appendChild(menu);

    this.activeMenuSheetId = sheetId;
    this.activeMenuEl = menu;

    this.outsideClickHandler = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        this.closeMenu();
      }
    };
    // Закрываем по mousedown на следующем тике, чтобы текущий click не сразу закрыл меню.
    // mousedown выбран вместо click, чтобы меню не закрывалось при закрытии системного file chooser.
    setTimeout(() => {
      if (this.outsideClickHandler) {
        document.addEventListener('mousedown', this.outsideClickHandler, { once: true });
      }
    }, 0);
  }

  private openStampMenu(anchor: HTMLElement): void {
    this.closeMenu();

    const sheet = this.plan.activeSheet;
    const menu = document.createElement('div');
    menu.className = 'sheet-tab-menu stamp-menu';

    const createRow = (label: string, control: HTMLElement): HTMLDivElement => {
      const row = document.createElement('div');
      row.className = 'sheet-tab-menu-row';
      const labelEl = document.createElement('span');
      labelEl.className = 'sheet-tab-menu-label';
      labelEl.textContent = label;
      row.appendChild(labelEl);
      row.appendChild(control);
      return row;
    };

    const tb = sheet.titleBlock;
    let isChoosingFile = false;

    // Штамп общий для всех листов проекта: изменения применяются ко всем sheets.
    const syncTitleBlock = (mutator: (block: SheetTitleBlock) => void): void => {
      for (const s of this.plan.sheets) {
        mutator(s.titleBlock);
      }
    };

    const createField = (
      label: string,
      value: string,
      textKey: keyof SheetTitleBlock,
      showKey: keyof TitleBlockVisibility,
    ): void => {
      const input = document.createElement('input');
      input.className = 'sheet-tab-menu-input';
      input.type = 'text';
      input.value = value;
      input.addEventListener('change', () => {
        syncTitleBlock(block => {
          (block[textKey] as string) = input.value;
        });
        this.engine.notifyChanged();
      });
      input.addEventListener('keydown', e => e.stopPropagation());

      const checkbox = document.createElement('input');
      checkbox.className = 'sheet-tab-menu-check';
      checkbox.type = 'checkbox';
      checkbox.checked = tb.show[showKey];
      checkbox.title = 'Показать в штампе';
      checkbox.addEventListener('change', () => {
        syncTitleBlock(block => {
          block.show[showKey] = checkbox.checked;
        });
        this.engine.notifyChanged();
      });
      checkbox.addEventListener('click', e => e.stopPropagation());

      const controlWrap = document.createElement('div');
      controlWrap.className = 'sheet-tab-menu-control';
      controlWrap.appendChild(input);
      controlWrap.appendChild(checkbox);

      menu.appendChild(createRow(label, controlWrap));
    };

    const createCompanyLogoField = (): void => {
      const label = document.createElement('span');
      label.className = 'sheet-tab-menu-label';
      label.textContent = 'Логотип';

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/png,image/jpeg,image/svg+xml';
      fileInput.className = 'sheet-tab-menu-file';
      fileInput.style.display = 'none';
      fileInput.addEventListener('change', () => {
        isChoosingFile = false;
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result);
          syncTitleBlock(block => {
            block.companyLogo = dataUrl;
          });
          this.engine.notifyChanged();
          updatePreview();
        };
        reader.readAsDataURL(file);
        fileInput.value = '';
      });

      const uploadBtn = document.createElement('button');
      uploadBtn.type = 'button';
      uploadBtn.textContent = 'Загрузить';
      uploadBtn.className = 'sheet-tab-menu-btn';
      uploadBtn.addEventListener('click', () => {
        isChoosingFile = true;
        fileInput.click();
      });

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.textContent = 'Удалить';
      clearBtn.className = 'sheet-tab-menu-btn';
      clearBtn.addEventListener('click', () => {
        syncTitleBlock(block => {
          block.companyLogo = '';
        });
        fileInput.value = '';
        this.engine.notifyChanged();
        updatePreview();
      });

      const preview = document.createElement('img');
      preview.className = 'sheet-tab-menu-logo-preview';
      const updatePreview = () => {
        preview.src = tb.companyLogo || '';
        preview.style.display = tb.companyLogo ? 'block' : 'none';
      };
      updatePreview();

      const checkbox = document.createElement('input');
      checkbox.className = 'sheet-tab-menu-check';
      checkbox.type = 'checkbox';
      checkbox.checked = tb.show.company;
      checkbox.title = 'Показать в штампе';
      checkbox.addEventListener('change', () => {
        syncTitleBlock(block => {
          block.show.company = checkbox.checked;
        });
        this.engine.notifyChanged();
      });
      checkbox.addEventListener('click', e => e.stopPropagation());

      const controlWrap = document.createElement('div');
      controlWrap.className = 'sheet-tab-menu-control';
      controlWrap.appendChild(fileInput);
      controlWrap.appendChild(uploadBtn);
      controlWrap.appendChild(clearBtn);
      controlWrap.appendChild(preview);
      controlWrap.appendChild(checkbox);

      const row = document.createElement('div');
      row.className = 'sheet-tab-menu-row';
      row.appendChild(label);
      row.appendChild(controlWrap);
      menu.appendChild(row);
    };

    createField('№ проекта / Шифр', tb.projectCode, 'projectCode', 'projectCode');
    createField('Адрес', tb.address, 'address', 'address');
    createField('Раздел', tb.section, 'section', 'section');
    createField('Наименование', tb.drawingTitle, 'drawingTitle', 'drawingTitle');
    createField('Компания', tb.company, 'company', 'company');
    createCompanyLogoField();
    createField('Стадия', tb.stage, 'stage', 'stage');
    createField('Дата', tb.date, 'date', 'date');
    createField('Утвердил', tb.approver, 'approver', 'row1');
    createField('Н. контр.', tb.normController, 'normController', 'row2');
    createField('ГИП', tb.gip, 'gip', 'row3');
    createField('Проверил', tb.checker, 'checker', 'row4');
    createField('Согласовал', tb.reviewer, 'reviewer', 'row5');
    createField('Разработал', tb.designer, 'designer', 'row6');

    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${Math.round(rect.left)}px`;
    menu.style.top = `${Math.round(rect.bottom + 6)}px`;
    document.body.appendChild(menu);

    this.activeMenuEl = menu;

    menu.addEventListener('mousedown', () => {
      if (isChoosingFile) isChoosingFile = false;
    });

    this.outsideClickHandler = (e: MouseEvent) => {
      if (isChoosingFile) return;
      if (!menu.contains(e.target as Node)) {
        this.closeMenu();
      }
    };
    // Закрываем по mousedown, но игнорируем событие во время выбора файла.
    setTimeout(() => {
      if (this.outsideClickHandler) {
        document.addEventListener('mousedown', this.outsideClickHandler);
      }
    }, 0);
  }

  private openExportMenu(anchor: HTMLElement): void {
    this.closeMenu();

    const menu = document.createElement('div');
    menu.className = 'sheet-tab-menu export-menu';

    const createItem = (label: string, iconName: IconName, action: () => void): HTMLButtonElement => {
      const btn = document.createElement('button');
      btn.className = 'sheet-tab-menu-item';
      btn.innerHTML = `<span class="ui-icon">${icon(iconName)}</span><span>${label}</span>`;
      btn.addEventListener('click', () => {
        action();
        this.closeMenu();
      });
      return btn;
    };

    menu.appendChild(createItem('Экспорт PDF', 'exportPdf', () => {
      exportPdf(this.engine, this.themeManager);
    }));
    menu.appendChild(createItem('Экспорт DXF', 'exportDxf', () => {
      exportDxf(this.engine);
    }));
    menu.appendChild(createItem('Экспорт SVG', 'exportSvg', () => {
      exportSvg(this.engine);
    }));
    menu.appendChild(createItem('Экспорт PNG', 'exportPng', () => {
      exportPng(this.engine, this.themeManager);
    }));
    menu.appendChild(createItem('Экспорт XLSX', 'exportXlsx', () => {
      exportXlsx(this.engine);
    }));

    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${Math.round(rect.left)}px`;
    menu.style.top = `${Math.round(rect.bottom + 6)}px`;
    document.body.appendChild(menu);

    this.activeMenuEl = menu;

    this.outsideClickHandler = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        this.closeMenu();
      }
    };
    setTimeout(() => {
      if (this.outsideClickHandler) {
        document.addEventListener('mousedown', this.outsideClickHandler, { once: true });
      }
    }, 0);
  }

  private closeMenu(): void {
    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler);
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
    if (this.activeMenuEl) {
      this.activeMenuEl.remove();
      this.activeMenuEl = null;
    }
    this.activeMenuSheetId = null;
  }

  private onSheetChanged(): void {
    this.closeMenu();
    this.engine.setSelectedWall(null);
    this.engine.setSelectedOpening(null);
    this.engine.setSelectedDevice(null);
    this.engine.setSelectedCable(null);
    this.engine.commandManager.clear();
    this.engine.notifyChanged();
    this.refresh();
  }
}
