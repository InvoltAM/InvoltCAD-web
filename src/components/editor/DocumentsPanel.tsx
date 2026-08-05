'use client'

import { useEffect, useState } from 'react'
import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'
import { ModalPanel } from './ModalPanel'
import { projectSync } from '@/lib/projects/sync'
import { DocumentData } from '@core/estimates/EstimateEngine'

const DOC_TYPE_NAMES: Record<string, string> = {
  contract: 'Договор подряда',
  act: 'Акт выполненных работ',
  invoice: 'Счёт',
  estimate: 'Коммерческое предложение',
  spec: 'Спецификация',
}

export default function DocumentsPanel() {
  const open = useCadStore((s) => s.documentsOpen)
  const setOpen = useCadStore((s) => s.setDocumentsOpen)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<DocumentData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<DocumentData | null>(null)

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
      const res = await fetch(`/api/projects/${projectId}/documents`)
      if (!res.ok) throw new Error(await res.text())
      setDocuments(await res.json())
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const saveDocument = async (doc: DocumentData) => {
    setError(null)
    const isEdit = doc.id && doc.id !== 'new'
    const url = isEdit ? `/api/projects/${projectId}/documents/${doc.id}` : `/api/projects/${projectId}/documents`
    const method = isEdit ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    })
    if (!res.ok) {
      setError('Не удалось сохранить документ')
      return
    }
    setEditing(null)
    load()
  }

  const deleteDocument = async (id: string) => {
    if (!confirm('Удалить документ?')) return
    const res = await fetch(`/api/projects/${projectId}/documents/${id}`, { method: 'DELETE' })
    if (!res.ok) setError('Не удалось удалить документ')
    else load()
  }

  if (!projectId) {
    return (
      <ModalPanel open={open} onClose={() => setOpen(false)} title="Договоры и акты">
        <div className="text-sm text-gray-600 dark:text-gray-300">Сохраните проект, чтобы работать с документами.</div>
      </ModalPanel>
    )
  }

  return (
    <ModalPanel open={open} onClose={() => setOpen(false)} title="Договоры и акты">
      <div className="flex h-[60vh] w-[80vw] max-w-2xl flex-col">
        {error && <div className="mb-2 rounded bg-red-100 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

        {editing ? (
          <DocumentForm doc={editing} onCancel={() => setEditing(null)} onSave={saveDocument} />
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={() => setEditing({ id: 'new', projectId: projectId!, type: 'contract', name: 'Новый документ', status: 'draft', content: '' })}
                className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600"
              >
                + Новый документ
              </button>
            </div>
            <div className="flex-1 overflow-auto rounded border border-gray-200 dark:border-gray-700">
              {loading ? (
                <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
              ) : documents.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Нет документов</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {documents.map((doc) => (
                    <div key={doc.id} className="p-3">
                      <div className="font-medium text-gray-900 dark:text-white">{doc.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {DOC_TYPE_NAMES[doc.type] || doc.type} · {doc.status} · {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('ru-RU') : ''}
                      </div>
                      <div className="mt-2 flex gap-1">
                        <button onClick={() => setEditing(doc)} className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Изменить</button>
                        <button onClick={() => deleteDocument(doc.id)} className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20">Удалить</button>
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

function DocumentForm({ doc, onCancel, onSave }: { doc: DocumentData; onCancel: () => void; onSave: (d: DocumentData) => void }) {
  const [draft, setDraft] = useState<DocumentData>(doc)

  const update = (field: keyof DocumentData, value: any) => {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="flex flex-1 flex-col space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400">Название</label>
          <input value={draft.name} onChange={(e) => update('name', e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400">Тип</label>
          <select value={draft.type} onChange={(e) => update('type', e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value="contract">Договор подряда</option>
            <option value="act">Акт выполненных работ</option>
            <option value="invoice">Счёт</option>
            <option value="estimate">Коммерческое предложение</option>
            <option value="spec">Спецификация</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-600 dark:text-gray-400">Содержание</label>
        <textarea
          value={draft.content || ''}
          onChange={(e) => update('content', e.target.value)}
          className="mt-1 h-64 w-full rounded border border-gray-300 p-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </div>
      <div className="flex justify-end space-x-2">
        <button onClick={onCancel} className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700">Отмена</button>
        <button onClick={() => onSave(draft)} className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600">Сохранить</button>
      </div>
    </div>
  )
}
