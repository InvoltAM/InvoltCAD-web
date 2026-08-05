'use client'

import { useEffect, useMemo, useState } from 'react'
import { useCadStore } from '@/stores/cadStore'
import { useEditor } from './EditorContext'
import { ModalPanel } from './ModalPanel'
import { projectSync } from '@/lib/projects/sync'
import {
  buildIecLabels,
  layoutLabelsOnA4,
  generateLabelsSvg,
  exportLabelsToCsv,
  DeviceLabel,
} from '@core/marking/IecMarkingEngine'

export default function MarkingPanel() {
  const open = useCadStore((s) => s.markingOpen)
  const setOpen = useCadStore((s) => s.setMarkingOpen)
  const { engineRef } = useEditor()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [labels, setLabels] = useState<DeviceLabel[]>([])
  const [customNumbers, setCustomNumbers] = useState<Record<string, number>>({})
  const [customPrefixes, setCustomPrefixes] = useState<Record<string, string>>({})
  const [selectedKinds, setSelectedKinds] = useState<Set<string>>(new Set(['device', 'cable', 'breaker', 'circuit']))
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    setProjectId(projectSync.getCurrentProjectId())
  }, [open])

  useEffect(() => {
    const plan = engineRef.current?.plan
    if (!plan) return

    const devices = plan.devices.map((d) => ({
      id: d.id,
      type: d.type,
      name: d.name,
      roomName: '',
    }))
    const cables = plan.cables.map((c) => ({ id: c.id, type: c.type, name: `Кабель ${c.type}` }))
    const circuits = (plan.electrical.circuits ?? []).map((c: any) => ({ id: c.id, name: c.name, type: c.type }))
    const board = plan.electrical.distributionBoards?.[0]
    const breakers = (board?.components ?? []).map((c: any) => ({ id: c.id, name: c.name, type: c.type, rating: c.ratingA }))

    const generated = buildIecLabels({
      devices,
      cables,
      circuits,
      breakers,
      startingNumbers: customNumbers,
    })

    // apply custom prefixes
    const withCustomPrefixes = generated.map((label) => {
      const prefix = customPrefixes[label.objectId] ?? label.prefix
      return {
        ...label,
        prefix,
        fullName: `${prefix}${label.number}${label.suffix ?? ''}`,
      }
    })

    setLabels(withCustomPrefixes)
  }, [engineRef, customNumbers, customPrefixes, open])

  const filtered = useMemo(() => labels.filter((l) => selectedKinds.has(l.kind)), [labels, selectedKinds])
  const sheet = useMemo(() => layoutLabelsOnA4(filtered), [filtered])
  const svg = useMemo(() => generateLabelsSvg(sheet), [sheet])
  const csv = useMemo(() => exportLabelsToCsv(filtered), [filtered])

  const toggleKind = (kind: string) => {
    setSelectedKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  const downloadSvg = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `labels-${projectId ?? 'local'}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadCsv = () => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `labels-${projectId ?? 'local'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const printLabels = () => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html>
        <head><title>Этикетки IEC</title></head>
        <body style="margin:0">${svg}</body>
      </html>
    `)
    w.document.close()
    w.print()
  }

  return (
    <ModalPanel open={open} onClose={() => setOpen(false)} title="Маркировка IEC и этикетки">
      <div className="flex h-[60vh] w-[80vw] max-w-3xl flex-col">
        <div className="mb-2 flex flex-wrap gap-2">
          {[
            { key: 'device', label: 'Устройства' },
            { key: 'cable', label: 'Кабели' },
            { key: 'breaker', label: 'Автоматы' },
            { key: 'rcd', label: 'УЗО' },
            { key: 'circuit', label: 'Линии' },
          ].map((k) => (
            <button
              key={k.key}
              onClick={() => toggleKind(k.key)}
              className={`rounded px-2 py-1 text-xs ${
                selectedKinds.has(k.key)
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Всего этикеток: {sheet.labels.length} (A4 {sheet.pageWidthMm}×{sheet.pageHeightMm} мм)
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPreview((p) => !p)} className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
              {preview ? 'Список' : 'Предпросмотр'}
            </button>
            <button onClick={downloadSvg} className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
              SVG
            </button>
            <button onClick={downloadCsv} className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">
              CSV
            </button>
            <button onClick={printLabels} className="rounded bg-orange-500 px-2 py-1 text-xs text-white hover:bg-orange-600">
              Печать
            </button>
          </div>
        </div>

        {preview ? (
          <div className="flex-1 overflow-auto rounded border border-gray-200 bg-white p-2 dark:border-gray-700">
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        ) : (
          <div className="flex-1 overflow-auto rounded border border-gray-200 dark:border-gray-700">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-2 py-1">Тип</th>
                  <th className="px-2 py-1">Полное имя</th>
                  <th className="px-2 py-1">Описание</th>
                  <th className="px-2 py-1">Кол-во</th>
                  <th className="px-2 py-1">Размер</th>
                  <th className="px-2 py-1">Префикс</th>
                  <th className="px-2 py-1">Номер</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((label) => (
                  <tr key={label.id}>
                    <td className="px-2 py-1 capitalize text-gray-600 dark:text-gray-400">{label.kind}</td>
                    <td className="px-2 py-1 font-medium text-gray-900 dark:text-white">{label.fullName}</td>
                    <td className="px-2 py-1 text-gray-600 dark:text-gray-400">{label.description}</td>
                    <td className="px-2 py-1 text-gray-900 dark:text-white">{label.quantity}</td>
                    <td className="px-2 py-1 text-gray-600 dark:text-gray-400">{label.widthMm}×{label.heightMm}</td>
                    <td className="px-2 py-1">
                      <input
                        value={customPrefixes[label.objectId] ?? label.prefix}
                        onChange={(e) => setCustomPrefixes((p) => ({ ...p, [label.objectId]: e.target.value }))}
                        className="w-16 rounded border border-gray-300 px-1 py-0.5 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        value={customNumbers[label.prefix] ?? label.number}
                        onChange={(e) => setCustomNumbers((p) => ({ ...p, [label.prefix]: Number(e.target.value) }))}
                        className="w-16 rounded border border-gray-300 px-1 py-0.5 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModalPanel>
  )
}
