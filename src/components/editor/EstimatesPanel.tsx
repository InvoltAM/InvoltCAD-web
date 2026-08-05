'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'
import { ModalPanel } from './ModalPanel'
import { projectSync } from '@/lib/projects/sync'
import { EstimateData, EstimateItemData, EstimateItemType, EstimateStatus, buildEstimateFromSpecification, recalcEstimate, buildInvoiceFromEstimate, generateActDocument, generateContractDocument, generateEstimateDocument, generateSpecDocument } from '@core/estimates/EstimateEngine'
import { buildCableSpecification, buildCableRuns } from '@core/electrical/CableRunEngine'
import { PriceItemData, PriceWorkItemData, PriceLevel, priceForLevel, CATEGORY_NAMES } from '@core/catalogs/PriceCatalog'

type View = 'list' | 'form' | 'document'

export default function EstimatesPanel() {
  const open = useCadStore((s) => s.estimatesOpen)
  const setOpen = useCadStore((s) => s.setEstimatesOpen)
  const { engineRef } = useEditor()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [estimates, setEstimates] = useState<EstimateData[]>([])
  const [catalogItems, setCatalogItems] = useState<PriceItemData[]>([])
  const [workItems, setWorkItems] = useState<PriceWorkItemData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('list')
  const [editing, setEditing] = useState<EstimateData | null>(null)
  const [docContent, setDocContent] = useState('')
  const [docType, setDocType] = useState<'estimate' | 'contract' | 'act' | 'spec'>('estimate')

  useEffect(() => {
    setProjectId(projectSync.getCurrentProjectId())
  }, [open])

  useEffect(() => {
    if (!open || !projectId) return
    load()
  }, [open, projectId])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [estRes, matRes, workRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/estimates`),
        fetch('/api/catalog/items'),
        fetch('/api/catalog/work-items'),
      ])
      if (!estRes.ok) throw new Error(await estRes.text())
      if (!matRes.ok) throw new Error(await matRes.text())
      if (!workRes.ok) throw new Error(await workRes.text())
      setEstimates(await estRes.json())
      setCatalogItems(await matRes.json())
      setWorkItems(await workRes.json())
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const createFromPlan = async () => {
    const plan = engineRef.current?.plan
    if (!plan || !projectId) return
    plan.recalcCableRoutes()
    const runs = buildCableRuns(plan.cables, plan.electrical.circuits ?? [])
    const spec = buildCableSpecification(runs)
    const estimate = buildEstimateFromSpecification(spec, catalogItems, workItems, 'standard', { projectId, name: 'Смета по плану' })
    await saveEstimate(estimate)
  }

  const saveEstimate = async (estimate: EstimateData) => {
    setError(null)
    const isEdit = estimate.id && estimate.id !== 'new'
    const url = isEdit ? `/api/projects/${projectId}/estimates/${estimate.id}` : `/api/projects/${projectId}/estimates`
    const method = isEdit ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(estimate),
    })
    if (!res.ok) {
      setError('Не удалось сохранить смету')
      return
    }
    setView('list')
    setEditing(null)
    load()
  }

  const deleteEstimate = async (id: string) => {
    if (!confirm('Удалить смету?')) return
    const res = await fetch(`/api/projects/${projectId}/estimates/${id}`, { method: 'DELETE' })
    if (!res.ok) setError('Не удалось удалить смету')
    else load()
  }

  const createInvoice = async (estimate: EstimateData) => {
    const number = `СЧ-${String(estimates.length + 1).padStart(3, '0')}`
    const invoice = buildInvoiceFromEstimate(estimate, number)
    const res = await fetch(`/api/projects/${projectId}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoice),
    })
    if (!res.ok) setError('Не удалось создать счёт')
    else setError('Счёт создан')
  }

  const createDocument = async (estimate: EstimateData, type: 'estimate' | 'contract' | 'act' | 'spec') => {
    let content = ''
    let name = ''
    const projectName = 'Проект'
    if (type === 'estimate') { content = generateEstimateDocument(estimate, projectName); name = `КП ${estimate.name}` }
    if (type === 'contract') { content = generateContractDocument(projectName, estimate); name = `Договор ${estimate.name}` }
    if (type === 'act') { content = generateActDocument(projectName, estimate); name = `Акт ${estimate.name}` }
    if (type === 'spec') { content = generateSpecDocument(estimate); name = `Спецификация ${estimate.name}` }
    const res = await fetch(`/api/projects/${projectId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name, content }),
    })
    if (!res.ok) setError('Не удалось создать документ')
    else setError('Документ создан')
  }

  const publishEstimate = async (estimate: EstimateData) => {
    const res = await fetch(`/api/projects/${projectId}/estimates/${estimate.id}/publish`, { method: 'POST' })
    if (!res.ok) {
      setError('Не удалось опубликовать смету')
      return
    }
    const data = await res.json()
    navigator.clipboard.writeText(data.publicUrl)
    setError('Ссылка скопирована в буфер обмена')
    load()
  }

  const unpublishEstimate = async (estimate: EstimateData) => {
    const res = await fetch(`/api/projects/${projectId}/estimates/${estimate.id}/publish`, { method: 'DELETE' })
    if (!res.ok) setError('Не удалось снять с публикации')
    else load()
  }

  const openDocument = (estimate: EstimateData, type: 'estimate' | 'contract' | 'act' | 'spec') => {
    const projectName = 'Проект'
    let content = ''
    if (type === 'estimate') content = generateEstimateDocument(estimate, projectName)
    if (type === 'contract') content = generateContractDocument(projectName, estimate)
    if (type === 'act') content = generateActDocument(projectName, estimate)
    if (type === 'spec') content = generateSpecDocument(estimate)
    setDocContent(content)
    setDocType(type)
    setView('document')
  }

  if (!projectId) {
    return (
      <ModalPanel open={open} onClose={() => setOpen(false)} title="Сметы и КП">
        <div className="text-sm text-gray-600 dark:text-gray-300">Сохраните проект, чтобы работать со сметами.</div>
      </ModalPanel>
    )
  }

  return (
    <ModalPanel open={open} onClose={() => setOpen(false)} title="Сметы и КП">
      <div className="flex h-[60vh] w-[80vw] max-w-3xl flex-col">
        {error && (
          <div className="mb-2 rounded bg-red-100 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>
        )}

        {view === 'list' && (
          <>
            <div className="mb-2 flex items-center space-x-2">
              <button
                onClick={createFromPlan}
                className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600"
              >
                + Смета из плана
              </button>
              <button
                onClick={() => { setEditing(null); setView('form') }}
                className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
              >
                + Пустая смета
              </button>
            </div>
            <div className="flex-1 overflow-auto rounded border border-gray-200 dark:border-gray-700">
              {loading ? (
                <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
              ) : estimates.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Нет смет</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {estimates.map((e) => (
                    <div key={e.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900 dark:text-white">{e.name}</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{(e.total / 100).toFixed(2)} ₽</div>
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Материалы: {(e.totalMaterial / 100).toFixed(2)} ₽ · Работы: {(e.totalWork / 100).toFixed(2)} ₽ · Скидка: {e.discountPercent}% · НДС: {e.vatPercent}% · {statusName(e.status)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <ActionButton onClick={() => { setEditing(e); setView('form') }}>Изменить</ActionButton>
                        <ActionButton onClick={() => createInvoice(e)}>Счёт</ActionButton>
                        <ActionButton onClick={() => openDocument(e, 'estimate')}>КП</ActionButton>
                        <ActionButton onClick={() => openDocument(e, 'contract')}>Договор</ActionButton>
                        <ActionButton onClick={() => openDocument(e, 'act')}>Акт</ActionButton>
                        <ActionButton onClick={() => openDocument(e, 'spec')}>Спецификация</ActionButton>
                        {e.publicSlug ? (
                          <>
                            <ActionButton onClick={() => navigator.clipboard.writeText(`${window.location.origin}/public/estimates/${e.publicSlug}`)}>Копировать ссылку</ActionButton>
                            <ActionButton danger onClick={() => unpublishEstimate(e)}>Снять с публикации</ActionButton>
                          </>
                        ) : (
                          <ActionButton onClick={() => publishEstimate(e)}>Опубликовать</ActionButton>
                        )}
                        <ActionButton danger onClick={() => deleteEstimate(e.id)}>Удалить</ActionButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {view === 'form' && (
          <EstimateForm
            estimate={editing}
            catalogItems={catalogItems}
            workItems={workItems}
            onCancel={() => { setView('list'); setEditing(null) }}
            onSave={saveEstimate}
          />
        )}

        {view === 'document' && (
          <div className="flex flex-1 flex-col space-y-2">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {docType === 'estimate' ? 'Коммерческое предложение' : docType === 'contract' ? 'Договор подряда' : docType === 'act' ? 'Акт выполненных работ' : 'Спецификация'}
            </div>
            <textarea
              readOnly
              value={docContent}
              className="flex-1 rounded border border-gray-300 p-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setView('list')}
                className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
              >
                Закрыть
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(docContent)
                  setError('Текст скопирован')
                }}
                className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600"
              >
                Копировать
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalPanel>
  )
}

function statusName(status: EstimateStatus): string {
  const names: Record<string, string> = { draft: 'Черновик', sent: 'Отправлено', accepted: 'Принято', rejected: 'Отклонено' }
  return names[status] || status
}

function ActionButton({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-2 py-0.5 text-[10px] ${
        danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function EstimateForm({
  estimate,
  catalogItems,
  workItems,
  onCancel,
  onSave,
}: {
  estimate: EstimateData | null
  catalogItems: PriceItemData[]
  workItems: PriceWorkItemData[]
  onCancel: () => void
  onSave: (e: EstimateData) => void
}) {
  const [draft, setDraft] = useState<EstimateData>(() => estimate ?? {
    id: 'new', projectId: '', name: 'Новая смета', priceLevel: 'standard', discountPercent: 0, vatPercent: 0,
    totalMaterial: 0, totalWork: 0, total: 0, status: 'draft', items: [],
  })

  const allItems = useMemo(() => {
    const materials: { id: string; name: string; unit: string; price: number; type: 'material' }[] = catalogItems.map((i) => ({
      id: i.id, name: i.name, unit: i.unit, price: priceForLevel(i, draft.priceLevel), type: 'material',
    }))
    const works: { id: string; name: string; unit: string; price: number; type: 'work' }[] = workItems.map((i) => ({
      id: i.id, name: i.name, unit: i.unit, price: priceForLevel(i, draft.priceLevel), type: 'work',
    }))
    return [...materials, ...works]
  }, [catalogItems, workItems, draft.priceLevel])

  const recalc = (next: EstimateData) => recalcEstimate({ ...next })

  const updateField = (field: keyof EstimateData, value: any) => {
    setDraft((prev) => recalc({ ...prev, [field]: value }))
  }

  const addItem = (itemId: string) => {
    const item = allItems.find((i) => i.id === itemId)
    if (!item) return
    const newItem: EstimateItemData = {
      id: `item-${Date.now()}`,
      itemType: item.type,
      name: item.name,
      unit: item.unit,
      quantity: 1,
      price: item.price,
      total: item.price,
      sortOrder: draft.items.length,
      priceItemId: item.id,
    }
    setDraft((prev) => recalc({ ...prev, items: [...prev.items, newItem] }))
  }

  const updateItem = (index: number, field: keyof EstimateItemData, value: any) => {
    setDraft((prev) => {
      const items = [...prev.items]
      items[index] = { ...items[index], [field]: value }
      if (field === 'quantity' || field === 'price') {
        items[index].total = Math.round(items[index].price * items[index].quantity)
      }
      return recalc({ ...prev, items })
    })
  }

  const removeItem = (index: number) => {
    setDraft((prev) => recalc({ ...prev, items: prev.items.filter((_, i) => i !== index) }))
  }

  return (
    <div className="flex flex-1 flex-col space-y-3 overflow-hidden">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400">Название</label>
          <input
            value={draft.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400">Уровень цен</label>
          <select
            value={draft.priceLevel}
            onChange={(e) => updateField('priceLevel', e.target.value as PriceLevel)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="budget">Бюджет</option>
            <option value="standard">Стандарт</option>
            <option value="premium">Премиум</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400">Скидка, %</label>
          <input
            type="number"
            value={draft.discountPercent}
            onChange={(e) => updateField('discountPercent', Number(e.target.value))}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400">НДС, %</label>
          <input
            type="number"
            value={draft.vatPercent}
            onChange={(e) => updateField('vatPercent', Number(e.target.value))}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-600 dark:text-gray-400">Статус</label>
        <select
          value={draft.status}
          onChange={(e) => updateField('status', e.target.value as EstimateStatus)}
          className="mt-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="draft">Черновик</option>
          <option value="sent">Отправлено</option>
          <option value="accepted">Принято</option>
          <option value="rejected">Отклонено</option>
        </select>
      </div>

      <div className="flex items-center space-x-2">
        <select
          id="add-item"
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          onChange={(e) => { addItem(e.target.value); e.target.value = '' }}
          defaultValue=""
        >
          <option value="" disabled>+ Добавить позицию из каталога</option>
          {allItems.map((i) => (
            <option key={i.id} value={i.id}>
              {CATEGORY_NAMES[i.id.startsWith('builtin') ? 'other' : ''] || ''} {i.name} ({(i.price / 100).toFixed(2)} ₽/{i.unit})
            </option>
          ))}
        </select>
        <button
          onClick={() => setDraft((prev) => recalc({ ...prev, items: [...prev.items, { id: `item-${Date.now()}`, itemType: 'material', name: 'Новая позиция', unit: 'шт', quantity: 1, price: 0, total: 0, sortOrder: prev.items.length }] }))}
          className="rounded bg-gray-200 px-2 py-1 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
        >
          + Вручную
        </button>
      </div>

      <div className="flex-1 overflow-auto rounded border border-gray-200 dark:border-gray-700">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="px-2 py-1">Тип</th>
              <th className="px-2 py-1">Название</th>
              <th className="px-2 py-1">Ед</th>
              <th className="px-2 py-1">Кол-во</th>
              <th className="px-2 py-1">Цена</th>
              <th className="px-2 py-1">Сумма</th>
              <th className="px-2 py-1"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {draft.items.map((item, idx) => (
              <tr key={item.id}>
                <td className="px-2 py-1">
                  <select
                    value={item.itemType}
                    onChange={(e) => updateItem(idx, 'itemType', e.target.value as EstimateItemType)}
                    className="rounded border border-gray-300 px-1 py-0.5 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="material">Материал</option>
                    <option value="work">Работа</option>
                  </select>
                </td>
                <td className="px-2 py-1">
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(idx, 'name', e.target.value)}
                    className="w-full rounded border border-gray-300 px-1 py-0.5 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    value={item.unit}
                    onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                    className="w-16 rounded border border-gray-300 px-1 py-0.5 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                    className="w-16 rounded border border-gray-300 px-1 py-0.5 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    step="0.01"
                    value={(item.price / 100).toFixed(2)}
                    onChange={(e) => updateItem(idx, 'price', Math.round(Number(e.target.value) * 100))}
                    className="w-20 rounded border border-gray-300 px-1 py-0.5 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                </td>
                <td className="px-2 py-1 text-gray-900 dark:text-white">{(item.total / 100).toFixed(2)}</td>
                <td className="px-2 py-1">
                  <button onClick={() => removeItem(idx)} className="text-red-600 hover:underline dark:text-red-400">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between rounded bg-gray-50 p-2 text-sm dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">
          Материалы: {(draft.totalMaterial / 100).toFixed(2)} ₽ · Работы: {(draft.totalWork / 100).toFixed(2)} ₽
        </div>
        <div className="font-bold text-gray-900 dark:text-white">
          Итого: {(draft.total / 100).toFixed(2)} ₽
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <button onClick={onCancel} className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700">Отмена</button>
        <button onClick={() => onSave(draft)} className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600">Сохранить</button>
      </div>
    </div>
  )
}
