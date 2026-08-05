'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCadStore } from '@/stores/cadStore'
import { ModalPanel } from './ModalPanel'
import { PriceItemData, PriceWorkItemData, PriceLevel, CATEGORY_NAMES, formatPriceRubKopecks, parsePriceRubKopecks } from '@core/catalogs/PriceCatalog'

type TabKey = 'materials' | 'works'
type ViewMode = 'list' | 'form' | 'import'

export default function CatalogPanel() {
  const open = useCadStore((s) => s.catalogOpen)
  const setOpen = useCadStore((s) => s.setCatalogOpen)
  const [tab, setTab] = useState<TabKey>('materials')
  const [level, setLevel] = useState<PriceLevel>('standard')
  const [items, setItems] = useState<PriceItemData[]>([])
  const [works, setWorks] = useState<PriceWorkItemData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('list')
  const [editing, setEditing] = useState<PriceItemData | PriceWorkItemData | null>(null)
  const [importText, setImportText] = useState('')
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    load()
  }, [open, tab])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      if (tab === 'materials') {
        const res = await fetch('/api/catalog/items')
        if (!res.ok) throw new Error(await res.text())
        setItems(await res.json())
      } else {
        const res = await fetch('/api/catalog/work-items')
        if (!res.ok) throw new Error(await res.text())
        setWorks(await res.json())
      }
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const currentList = useMemo(() => {
    const list = tab === 'materials' ? items : works
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter((i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
  }, [items, works, tab, search])

  const grouped = useMemo(() => {
    const map = new Map<string, (PriceItemData | PriceWorkItemData)[]>()
    for (const item of currentList) {
      const cat = item.category
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(item)
    }
    return Array.from(map.entries()).sort((a, b) => (CATEGORY_NAMES[a[0]] ?? a[0]).localeCompare(CATEGORY_NAMES[b[0]] ?? b[0]))
  }, [currentList])

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить позицию?')) return
    const endpoint = tab === 'materials' ? `/api/catalog/items/${id}` : `/api/catalog/work-items/${id}`
    const res = await fetch(endpoint, { method: 'DELETE' })
    if (!res.ok) {
      setError('Не удалось удалить позицию')
      return
    }
    load()
  }

  const handleSave = async (data: FormData) => {
    const payload = formToPayload(data, tab)
    const isEdit = editing && !editing.isBuiltin
    const endpoint = isEdit
      ? tab === 'materials'
        ? `/api/catalog/items/${editing.id}`
        : `/api/catalog/work-items/${editing.id}`
      : tab === 'materials'
        ? '/api/catalog/items'
        : '/api/catalog/work-items'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      setError('Не удалось сохранить позицию')
      return
    }
    setView('list')
    setEditing(null)
    load()
  }

  const handleImport = async () => {
    setImportErrors([])
    const lines = importText.split('\n').map((l) => l.trim()).filter(Boolean)
    const errors: string[] = []
    let saved = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const parts = line.split(';')
      if (parts.length < 6) {
        errors.push(`Строка ${i + 1}: нужно 6–7 полей (категория;название;ед;бюджет;стандарт;премиум;описание)`)
        continue
      }
      const [category, name, unit, budget, standard, premium, description] = parts
      if (!name || !category) {
        errors.push(`Строка ${i + 1}: пустая категория или название`)
        continue
      }
      const payload = {
        category: category.trim(),
        name: name.trim(),
        unit: unit.trim() || 'шт',
        priceBudget: Number(budget) || 0,
        priceStandard: Number(standard) || 0,
        pricePremium: Number(premium) || 0,
        description: description?.trim() || undefined,
      }
      const endpoint = tab === 'materials' ? '/api/catalog/items' : '/api/catalog/work-items'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) saved++
      else errors.push(`Строка ${i + 1}: ошибка сервера`)
    }

    if (errors.length === 0) {
      setView('list')
      setImportText('')
      load()
    } else {
      setImportErrors(errors)
      if (saved > 0) load()
    }
  }

  return (
    <ModalPanel open={open} onClose={() => setOpen(false)} title="Каталог материалов и работ">
      <div className="flex h-[60vh] w-[80vw] max-w-3xl flex-col">
        <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
          <div className="flex space-x-1">
            <TabButton active={tab === 'materials'} onClick={() => setTab('materials')} label="Материалы" />
            <TabButton active={tab === 'works'} onClick={() => setTab('works')} label="Работы" />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">Уровень цен</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as PriceLevel)}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="budget">Бюджет</option>
              <option value="standard">Стандарт</option>
              <option value="premium">Премиум</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-2 rounded bg-red-100 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        {view === 'list' && (
          <>
            <div className="mb-2 flex items-center space-x-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск..."
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <button
                onClick={() => { setEditing(null); setView('form') }}
                className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600"
              >
                + Добавить
              </button>
              <button
                onClick={() => setView('import')}
                className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
              >
                Импорт CSV
              </button>
            </div>

            <div className="flex-1 overflow-auto rounded border border-gray-200 dark:border-gray-700">
              {loading ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
              ) : grouped.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Нет позиций</div>
              ) : (
                <div className="space-y-1 p-2">
                  {grouped.map(([category, catItems]) => (
                    <div key={category}>
                      <div className="sticky top-0 bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {CATEGORY_NAMES[category] ?? category}
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {catItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between px-2 py-1.5 text-sm">
                            <div className="flex-1">
                              <div className="text-gray-900 dark:text-white">{item.name}</div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                {item.unit}
                                {'vendor' in item && item.vendor ? ` · ${item.vendor}` : ''}
                                {'sku' in item && item.sku ? ` · ${item.sku}` : ''}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-gray-900 dark:text-white">{formatPriceRubKopecks(priceForLevel(item, level))}</div>
                              {!item.isBuiltin && (
                                <div className="space-x-1">
                                  <button
                                    onClick={() => { setEditing(item); setView('form') }}
                                    className="text-[10px] text-orange-600 hover:underline dark:text-orange-400"
                                  >
                                    Изменить
                                  </button>
                                  <button
                                    onClick={() => handleDelete(item.id)}
                                    className="text-[10px] text-red-600 hover:underline dark:text-red-400"
                                  >
                                    Удалить
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {view === 'form' && (
          <CatalogForm
            tab={tab}
            level={level}
            item={editing}
            onCancel={() => { setView('list'); setEditing(null) }}
            onSave={handleSave}
          />
        )}

        {view === 'import' && (
          <div className="flex flex-1 flex-col space-y-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Формат CSV (разделитель — точка с запятой): категория;название;единица;цена бюджет;цена стандарт;цена премиум;описание
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="flex-1 rounded border border-gray-300 p-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              placeholder="cable;ВВГнг(А)-LS 3x2,5;м;65;95;140&#10;device-install;Установка розетки;шт;400;550;800"
            />
            {importErrors.length > 0 && (
              <div className="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                {importErrors.map((e, i) => <div key={i}>• {e}</div>)}
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => { setView('list'); setImportText(''); setImportErrors([]) }}
                className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
              >
                Отмена
              </button>
              <button
                onClick={handleImport}
                className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600"
              >
                Импортировать
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalPanel>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-1 text-sm ${
        active
          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  )
}

function priceForLevel(item: PriceItemData | PriceWorkItemData, level: PriceLevel): number {
  if (level === 'budget') return item.priceBudget
  if (level === 'premium') return item.pricePremium
  return item.priceStandard
}

function formToPayload(data: FormData, tab: TabKey): Record<string, any> {
  const prefix = tab === 'materials' ? '' : ''
  const category = data.get(`${prefix}category`) as string
  const name = data.get(`${prefix}name`) as string
  const unit = data.get(`${prefix}unit`) as string
  const budget = parsePriceRubKopecks(data.get(`${prefix}priceBudget`) as string)
  const standard = parsePriceRubKopecks(data.get(`${prefix}priceStandard`) as string)
  const premium = parsePriceRubKopecks(data.get(`${prefix}pricePremium`) as string)
  const vendor = data.get(`${prefix}vendor`) as string
  const sku = data.get(`${prefix}sku`) as string
  const description = data.get(`${prefix}description`) as string
  return {
    category,
    name,
    unit,
    priceBudget: budget / 100,
    priceStandard: standard / 100,
    pricePremium: premium / 100,
    vendor: vendor || undefined,
    sku: sku || undefined,
    description: description || undefined,
  }
}

function CatalogForm({
  tab,
  level,
  item,
  onCancel,
  onSave,
}: {
  tab: TabKey
  level: PriceLevel
  item: PriceItemData | PriceWorkItemData | null
  onCancel: () => void
  onSave: (data: FormData) => void
}) {
  const isBuiltin = item?.isBuiltin ?? false
  const formRef = (form: HTMLFormElement | null) => {
    if (!form || !item) return
    const set = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null
      if (el) el.value = value
    }
    set('category', item.category)
    set('name', item.name)
    set('unit', item.unit)
    set('priceBudget', (item.priceBudget / 100).toString())
    set('priceStandard', (item.priceStandard / 100).toString())
    set('pricePremium', (item.pricePremium / 100).toString())
    if ('vendor' in item) set('vendor', item.vendor || '')
    if ('sku' in item) set('sku', item.sku || '')
    set('description', item.description || '')
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => { e.preventDefault(); onSave(new FormData(e.currentTarget)) }}
      className="flex flex-1 flex-col space-y-3 overflow-auto"
    >
      <div className="text-sm font-medium text-gray-900 dark:text-white">
        {item ? (isBuiltin ? 'Просмотр встроенной позиции' : 'Редактирование позиции') : 'Новая позиция'}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field name="category" label="Категория (ключ)" required disabled={isBuiltin} />
        <Field name="name" label="Название" required disabled={isBuiltin} />
        <Field name="unit" label="Единица" required disabled={isBuiltin} />
        {tab === 'materials' && (
          <>
            <Field name="vendor" label="Производитель" disabled={isBuiltin} />
            <Field name="sku" label="Артикул / SKU" disabled={isBuiltin} />
          </>
        )}
        <Field name="priceBudget" label="Цена бюджет, ₽" required disabled={isBuiltin} />
        <Field name="priceStandard" label="Цена стандарт, ₽" required disabled={isBuiltin} />
        <Field name="pricePremium" label="Цена премиум, ₽" required disabled={isBuiltin} />
      </div>

      <div>
        <label className="block text-xs text-gray-600 dark:text-gray-400">Описание</label>
        <textarea
          name="description"
          disabled={isBuiltin}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          rows={3}
        />
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        Текущий уровень цен для просмотра: <strong>{level === 'budget' ? 'Бюджет' : level === 'premium' ? 'Премиум' : 'Стандарт'}</strong>
      </div>

      <div className="flex justify-end space-x-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
        >
          Отмена
        </button>
        {!isBuiltin && (
          <button
            type="submit"
            className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600"
          >
            Сохранить
          </button>
        )}
      </div>
    </form>
  )
}

function Field({ name, label, required, disabled }: { name: string; label: string; required?: boolean; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 dark:text-gray-400">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        name={name}
        required={required}
        disabled={disabled}
        className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white disabled:opacity-60"
      />
    </div>
  )
}
