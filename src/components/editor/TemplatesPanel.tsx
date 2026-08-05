/* eslint-disable react-hooks/immutability -- редактор работает через мутации плана по дизайну */
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'
import { ModalPanel } from './ModalPanel'
import {
  builtinTemplates,
  createTemplateFromPlan,
  applyTemplateToPlan,
  exportTemplateToJson,
  importTemplateFromJson,
  ProjectTemplateData,
} from '@core/templates/TemplateEngine'

type TabKey = 'templates' | 'devices'

const TEMPLATE_TYPES = [
  { value: 'project', label: 'Проект' },
  { value: 'room', label: 'Комната' },
  { value: 'device', label: 'Устройство' },
] as const

export default function TemplatesPanel() {
  const open = useCadStore((s) => s.templatesOpen)
  const setOpen = useCadStore((s) => s.setTemplatesOpen)
  const { engineRef } = useEditor()
  const plan = engineRef.current?.plan

  const [tab, setTab] = useState<TabKey>('templates')
  const [templates, setTemplates] = useState<ProjectTemplateData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', category: '', templateType: 'project' as const })
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState<{ message: string; ok: boolean } | null>(null)
  const [applyMode, setApplyMode] = useState<'replace' | 'merge'>('replace')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    loadTemplates()
  }, [open])

  const loadTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error(await res.text())
      setTemplates(await res.json())
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const refresh = () => {
    engineRef.current?.notifyChanged()
    engineRef.current?.requestRender()
  }

  const handleSaveCurrent = async () => {
    if (!plan || !form.name.trim()) return
    setError(null)
    try {
      const template = createTemplateFromPlan(plan, form.templateType as any, form.name.trim(), form.description.trim(), form.category.trim() || 'other')
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          category: template.category,
          templateType: template.templateType,
          data: template.data,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setForm({ name: '', description: '', category: '', templateType: 'project' })
      loadTemplates()
    } catch (e: any) {
      setError(e?.message || 'Ошибка сохранения')
    }
  }

  const handleApply = (template: ProjectTemplateData) => {
    if (!plan) return
    try {
      applyTemplateToPlan(plan, template, { mode: applyMode })
      useCadStore.getState().clearSelection()
      refresh()
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Ошибка применения шаблона')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить шаблон?')) return
    setError(null)
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      loadTemplates()
    } catch (e: any) {
      setError(e?.message || 'Ошибка удаления')
    }
  }

  const handleExport = (template: ProjectTemplateData) => {
    const json = exportTemplateToJson(template)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${template.name || 'template'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = async (file: File) => {
    setError(null)
    try {
      const text = await file.text()
      const template = importTemplateFromJson(text)
      if (!plan) throw new Error('Нет активного плана')
      applyTemplateToPlan(plan, template, { mode: applyMode })
      useCadStore.getState().clearSelection()
      refresh()
      setImportResult({ message: `Шаблон «${template.name}» загружен`, ok: true })
    } catch (e: any) {
      setImportResult({ message: e?.message || 'Ошибка импорта', ok: false })
    }
  }

  const handleImportCsv = async () => {
    setError(null)
    setImportResult(null)
    try {
      const res = await fetch('/api/catalog/devices/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: importText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка импорта')
      setImportResult({
        message: `Импортировано ${data.created} устройств. ${data.errors?.length ? `Ошибок: ${data.errors.length}` : ''}`,
        ok: data.errors.length === 0,
      })
      if (data.errors.length > 0) {
        console.error(data.errors)
      }
      setImportText('')
    } catch (e: any) {
      setImportResult({ message: e?.message || 'Ошибка импорта', ok: false })
    }
  }

  const builtin = useMemo(() => builtinTemplates(), [])
  const userTemplates = useMemo(() => templates.filter((t) => !t.isBuiltin), [templates])
  const allTemplates = useMemo(() => [...builtin, ...userTemplates], [builtin, userTemplates])

  const filteredByType = useMemo(() => {
    if (tab === 'devices') return []
    return allTemplates
  }, [allTemplates, tab])

  return (
    <ModalPanel open={open} onClose={() => setOpen(false)} title="Шаблоны и каталоги">
      <div className="flex h-[60vh] w-[80vw] max-w-3xl flex-col">
        <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
          <div className="flex space-x-1">
            <TabButton active={tab === 'templates'} onClick={() => setTab('templates')} label="Шаблоны" />
            <TabButton active={tab === 'devices'} onClick={() => setTab('devices')} label="Импорт устройств" />
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <label className="text-gray-500 dark:text-gray-400">Режим загрузки</label>
            <select
              value={applyMode}
              onChange={(e) => setApplyMode(e.target.value as 'replace' | 'merge')}
              className="rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="replace">Заменить</option>
              <option value="merge">Добавить</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-2 rounded bg-red-100 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        {importResult && (
          <div className={`mb-2 rounded px-3 py-2 text-xs ${importResult.ok ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
            {importResult.message}
          </div>
        )}

        {tab === 'templates' && (
          <>
            <div className="mb-3 rounded border border-gray-200 p-3 dark:border-gray-700">
              <div className="mb-2 text-sm font-medium text-gray-900 dark:text-white">Сохранить текущий план как шаблон</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Название"
                  className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Категория"
                  className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                <select
                  value={form.templateType}
                  onChange={(e) => setForm({ ...form, templateType: e.target.value as any })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  {TEMPLATE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Описание"
                  className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div className="mt-2 flex items-center space-x-2">
                <button
                  onClick={handleSaveCurrent}
                  disabled={!plan || !form.name.trim()}
                  className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  Сохранить
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImportFile(file)
                    if (e.target) e.target.value = ''
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
                >
                  Импорт JSON
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto rounded border border-gray-200 dark:border-gray-700">
              {loading ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
              ) : filteredByType.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Нет шаблонов</div>
              ) : (
                <div className="space-y-1 p-2">
                  {filteredByType.map((template) => (
                    <div key={template.id} className="flex items-center justify-between rounded border border-gray-100 p-2 dark:border-gray-800">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{template.name}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                          {template.templateType === 'project' ? 'Проект' : template.templateType === 'room' ? 'Комната' : 'Устройство'}
                          {template.category ? ` · ${template.category}` : ''}
                          {template.isBuiltin ? ' · встроенный' : ' · пользовательский'}
                        </div>
                        {template.description && (
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">{template.description}</div>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleApply(template)}
                          className="rounded bg-orange-500 px-2 py-1 text-xs text-white hover:bg-orange-600"
                        >
                          Загрузить
                        </button>
                        <button
                          onClick={() => handleExport(template)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
                        >
                          Экспорт
                        </button>
                        {!template.isBuiltin && (
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            Удалить
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'devices' && (
          <div className="flex flex-1 flex-col space-y-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Формат CSV (разделитель — точка с запятой): category;deviceType;name;nameRu;width;height;price;svg;properties(JSON)
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="flex-1 rounded border border-gray-300 p-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              placeholder={`socket;wall;Socket;Розетка;50;50;150;&lt;svg...&gt;\nswitch;wall;Switch;Выключатель;50;50;120;`}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => { setImportText(''); setImportResult(null) }}
                className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
              >
                Очистить
              </button>
              <button
                onClick={handleImportCsv}
                disabled={!importText.trim()}
                className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600 disabled:opacity-50"
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
