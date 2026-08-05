'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'
import { ModalPanel } from './ModalPanel'
import { projectSync } from '@/lib/projects/sync'
import { AutomationConfigData, AutomationDeviceMapping, AutomationPlatform, generateAutomationConfig, buildAutomationMappingsFromPlan } from '@core/automation/AutomationEngine'

type View = 'list' | 'editor'

const TYPE_OPTIONS: { value: AutomationDeviceMapping['mappedType']; label: string }[] = [
  { value: 'switch', label: 'Выключатель/Реле' },
  { value: 'light', label: 'Свет' },
  { value: 'dimmer', label: 'Диммер' },
  { value: 'rgb', label: 'RGB' },
  { value: 'sensor', label: 'Датчик' },
  { value: 'thermostat', label: 'Термостат' },
]

export default function AutomationPanel() {
  const open = useCadStore((s) => s.automationOpen)
  const setOpen = useCadStore((s) => s.setAutomationOpen)
  const { engineRef } = useEditor()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [configs, setConfigs] = useState<AutomationConfigData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('list')
  const [editing, setEditing] = useState<AutomationConfigData | null>(null)
  const [platform, setPlatform] = useState<AutomationPlatform>('wirenboard')
  const [name, setName] = useState('')
  const [mappings, setMappings] = useState<AutomationDeviceMapping[]>([])

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
      const res = await fetch(`/api/projects/${projectId}/automation`)
      if (!res.ok) throw new Error(await res.text())
      setConfigs(await res.json())
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const generateFromPlan = () => {
    const plan = engineRef.current?.plan
    if (!plan) return
    const devices = plan.devices.map((d) => ({ id: d.id, type: d.type, name: d.name, roomName: '' }))
    const circuits = (plan.electrical.circuits ?? []).map((c: any) => ({ id: c.id, name: c.name, type: c.type }))
    setMappings(buildAutomationMappingsFromPlan(devices, circuits))
  }

  const script = useMemo(() => generateAutomationConfig(platform, mappings), [platform, mappings])

  const saveConfig = async () => {
    if (!projectId) return
    const payload: AutomationConfigData = {
      id: editing?.id ?? 'new',
      projectId,
      platform,
      name: name || 'Конфиг автоматизации',
      devices: mappings,
      script,
    }
    const isEdit = editing && editing.id !== 'new'
    const url = isEdit ? `/api/projects/${projectId}/automation/${editing.id}` : `/api/projects/${projectId}/automation`
    const method = isEdit ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      setError('Не удалось сохранить конфиг')
      return
    }
    setView('list')
    setEditing(null)
    load()
  }

  const deleteConfig = async (id: string) => {
    if (!confirm('Удалить конфиг?')) return
    const res = await fetch(`/api/projects/${projectId}/automation/${id}`, { method: 'DELETE' })
    if (!res.ok) setError('Не удалось удалить конфиг')
    else load()
  }

  const download = () => {
    const ext = platform === 'wirenboard' ? 'js' : 'yaml'
    const blob = new Blob([script], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `automation-${platform}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const startNew = () => {
    setEditing(null)
    setPlatform('wirenboard')
    setName('')
    setMappings([])
    setView('editor')
  }

  const startEdit = (config: AutomationConfigData) => {
    setEditing(config)
    setPlatform(config.platform)
    setName(config.name)
    setMappings(config.devices)
    setView('editor')
  }

  const updateMapping = (index: number, field: keyof AutomationDeviceMapping, value: any) => {
    setMappings((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  if (!projectId) {
    return (
      <ModalPanel open={open} onClose={() => setOpen(false)} title="Автоматизация">
        <div className="text-sm text-gray-600 dark:text-gray-300">Сохраните проект, чтобы работать с конфигами автоматизации.</div>
      </ModalPanel>
    )
  }

  return (
    <ModalPanel open={open} onClose={() => setOpen(false)} title="Автоматизация">
      <div className="flex h-[60vh] w-[80vw] max-w-3xl flex-col">
        {error && <div className="mb-2 rounded bg-red-100 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>}

        {view === 'list' ? (
          <>
            <div className="mb-2">
              <button onClick={startNew} className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600">+ Новый конфиг</button>
            </div>
            <div className="flex-1 overflow-auto rounded border border-gray-200 dark:border-gray-700">
              {loading ? (
                <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Загрузка...</div>
              ) : configs.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Нет конфигов</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {configs.map((c) => (
                    <div key={c.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900 dark:text-white">{c.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{c.platform === 'wirenboard' ? 'Wirenboard' : 'Home Assistant'}</div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Устройств: {c.devices.length}</div>
                      <div className="mt-2 flex gap-1">
                        <button onClick={() => startEdit(c)} className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">Изменить</button>
                        <button onClick={() => deleteConfig(c.id)} className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20">Удалить</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col space-y-3 overflow-hidden">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400">Название</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400">Платформа</label>
                <select value={platform} onChange={(e) => setPlatform(e.target.value as AutomationPlatform)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  <option value="wirenboard">Wirenboard</option>
                  <option value="homeassistant">Home Assistant</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={generateFromPlan} className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600">Заполнить из плана</button>
              <button onClick={download} className="rounded bg-gray-200 px-3 py-1 text-sm text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">Скачать {platform === 'wirenboard' ? '.js' : '.yaml'}</button>
            </div>

            <div className="flex-1 overflow-auto rounded border border-gray-200 dark:border-gray-700">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-2 py-1">Устройство</th>
                    <th className="px-2 py-1">Тип</th>
                    <th className="px-2 py-1">Канал</th>
                    <th className="px-2 py-1">Адрес</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {mappings.map((m, idx) => (
                    <tr key={m.id}>
                      <td className="px-2 py-1 text-gray-900 dark:text-white">{m.deviceName}</td>
                      <td className="px-2 py-1">
                        <select value={m.mappedType} onChange={(e) => updateMapping(idx, 'mappedType', e.target.value)} className="rounded border border-gray-300 px-1 py-0.5 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                          {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" value={m.channel} onChange={(e) => updateMapping(idx, 'channel', Number(e.target.value))} className="w-16 rounded border border-gray-300 px-1 py-0.5 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                      </td>
                      <td className="px-2 py-1">
                        <input value={m.address || ''} onChange={(e) => updateMapping(idx, 'address', e.target.value)} className="w-20 rounded border border-gray-300 px-1 py-0.5 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex-1 overflow-hidden rounded border border-gray-200 dark:border-gray-700">
              <textarea
                readOnly
                value={script}
                className="h-full w-full resize-none rounded bg-gray-50 p-2 font-mono text-xs dark:bg-gray-900 dark:text-gray-300"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setView('list')} className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700">Отмена</button>
              <button onClick={saveConfig} className="rounded bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600">Сохранить</button>
            </div>
          </div>
        )}
      </div>
    </ModalPanel>
  )
}
