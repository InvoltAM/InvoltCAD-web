'use client'

import { useEffect, useState } from 'react'
import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'
import { ModalPanel } from './ModalPanel'
import { projectSync } from '@/lib/projects/sync'
import { InvoiceData } from '@core/estimates/EstimateEngine'

export default function InvoicesPanel() {
  const open = useCadStore((s) => s.invoicesOpen)
  const setOpen = useCadStore((s) => s.setInvoicesOpen)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<InvoiceData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<InvoiceData | null>(null)

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
      const res = await fetch(`/api/projects/${projectId}/invoices`)
      if (!res.ok) throw new Error(await res.text())
      setInvoices(await res.json())
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const saveInvoice = async (invoice: InvoiceData) => {
    setError(null)
    const isEdit = invoice.id && invoice.id !== 'new'
    const url = isEdit ? `/api/projects/${projectId}/invoices/${invoice.id}` : `/api/projects/${projectId}/invoices`
    const method = isEdit ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoice),
    })
    if (!res.ok) {
      setError('Не удалось сохранить счёт')
      return
    }
    setEditing(null)
    load()
  }

  const deleteInvoice = async (id: string) => {
    if (!confirm('Удалить счёт?')) return
    const res = await fetch(`/api/projects/${projectId}/invoices/${id}`, { method: 'DELETE' })
    if (!res.ok) setError('Не удалось удалить счёт')
    else load()
  }

  if (!projectId) {
    return (
      <ModalPanel open={open} onClose={() => setOpen(false)} title="Счета">
        <div className="text-sm text-gray-600 dark:text-gray-300">Сохраните проект, чтобы работать со счетами.</div>
      </ModalPanel>
    )
  }

  return (
    <ModalPanel open={open} onClose={() => setOpen(false)} title="Счета">
      <div className="flex h-[60vh] w-[80vw] max-w-2xl flex-col">
        {error && <div className="mb-2 rounded bg-red-100 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

        {editing ? (
          <InvoiceForm invoice={editing} onCancel={() => setEditing(null)} onSave={saveInvoice} />
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={() => setEditing({ id: 'new', projectId: projectId!, number: `СЧ-${String(invoices.length + 1).padStart(3, '0')}`, amount: 0, currency: 'RUB', vatPercent: 0, vatAmount: 0, status: 'draft' })}
                className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600"
              >
                + Новый счёт
              </button>
            </div>
            <div className="flex-1 overflow-auto rounded border border-gray-200 dark:border-gray-700">
              {loading ? (
                <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
              ) : invoices.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Нет счетов</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900 dark:text-white">{inv.number}</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{(inv.amount / 100).toFixed(2)} ₽</div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        НДС {inv.vatPercent}% · {statusName(inv.status)} · {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('ru-RU') : 'без срока'}
                      </div>
                      <div className="mt-2 flex gap-1">
                        <button onClick={() => setEditing(inv)} className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Изменить</button>
                        <button onClick={() => deleteInvoice(inv.id)} className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20">Удалить</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ModalPanel>
  )
}

function statusName(status: string): string {
  const names: Record<string, string> = { draft: 'Черновик', sent: 'Выставлен', paid: 'Оплачен', cancelled: 'Отменён' }
  return names[status] || status
}

function InvoiceForm({ invoice, onCancel, onSave }: { invoice: InvoiceData; onCancel: () => void; onSave: (i: InvoiceData) => void }) {
  const [draft, setDraft] = useState<InvoiceData>(invoice)

  const update = (field: keyof InvoiceData, value: any) => {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="flex flex-col space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400">Номер</label>
          <input value={draft.number} onChange={(e) => update('number', e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400">Сумма, ₽</label>
          <input type="number" step="0.01" value={(draft.amount / 100).toFixed(2)} onChange={(e) => update('amount', Math.round(Number(e.target.value) * 100))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400">НДС, %</label>
          <input type="number" value={draft.vatPercent} onChange={(e) => update('vatPercent', Number(e.target.value))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400">Сумма НДС, ₽</label>
          <input type="number" step="0.01" value={(draft.vatAmount / 100).toFixed(2)} onChange={(e) => update('vatAmount', Math.round(Number(e.target.value) * 100))} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400">Срок оплаты</label>
          <input type="date" value={draft.dueDate ? new Date(draft.dueDate).toISOString().split('T')[0] : ''} onChange={(e) => update('dueDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400">Статус</label>
          <select value={draft.status} onChange={(e) => update('status', e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="draft">Черновик</option>
            <option value="sent">Выставлен</option>
            <option value="paid">Оплачен</option>
            <option value="cancelled">Отменён</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end space-x-2">
        <button onClick={onCancel} className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700">Отмена</button>
        <button onClick={() => onSave(draft)} className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600">Сохранить</button>
      </div>
    </div>
  )
}
