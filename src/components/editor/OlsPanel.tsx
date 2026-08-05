/* eslint-disable react-hooks/immutability -- редактор работает через мутации плана по дизайну */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useEditor } from './EditorContext'
import { useCadStore } from '@/stores/cadStore'
import { Plan } from '@core/model/Plan'
import { buildDistributionBoard, DistributionBoardData } from '@core/electrical/BoardEngine'
import { generateBoardSvg, generateOlsFromCircuits } from '@core/electrical/BoardSvgScheme'
import { CircuitData } from '@core/electrical/RoomConsumerEngine'

export default function OlsPanel() {
  const { engineRef } = useEditor()
  const [plan, setPlan] = useState<Plan | null>(null)
  const open = useCadStore((s) => s.olsOpen)
  const setOpen = useCadStore((s) => s.setOlsOpen)
  const theme = useCadStore((s) => s.theme)
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPlan(engineRef.current?.plan ?? null)
    }, 0)
    return () => clearTimeout(timer)
  }, [engineRef])

  const circuits = (plan?.electrical.circuits as CircuitData[]) || []
  const board = (plan?.electrical.distributionBoards?.[0] as DistributionBoardData | undefined) || null

  const svg = useMemo(() => {
    if (board) return generateBoardSvg(board, { dark: theme === 'dark' })
    if (circuits.length > 0) return generateOlsFromCircuits(circuits, { dark: theme === 'dark' })
    return null
  }, [board, circuits, theme, forceUpdate])

  const refresh = () => {
    forceUpdate((n) => n + 1)
    engineRef.current?.notifyChanged()
    engineRef.current?.requestRender()
  }

  const handleBuildBoard = () => {
    if (!plan) return
    if (circuits.length === 0) {
      alert('Сначала сгруппируйте потребителей в линии (Комнаты и потребители → Автогруппировать линии)')
      return
    }
    const newBoard = buildDistributionBoard(circuits, { phases: 'single', withMainRcd: true })
    plan.electrical.distributionBoards = [newBoard]
    refresh()
  }

  const handleExportSvg = () => {
    if (!svg) return
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'involtcad-ols.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/35" onClick={() => setOpen(false)}>
      <div
        className="flex h-[80vh] w-[90vw] max-w-5xl flex-col rounded-lg bg-white p-4 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">Однолинейная схема / Щит</span>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            onClick={handleBuildBoard}
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm text-white hover:bg-orange-600"
          >
            ⚡ Автособрать щит
          </button>
          <button
            onClick={handleExportSvg}
            disabled={!svg}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Экспорт SVG
          </button>
        </div>

        <div className="flex-1 overflow-auto rounded border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-900">
          {svg ? (
            <div className="min-h-full min-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
              <p>Нет данных для схемы.</p>
              <p className="text-sm">Сначала сгруппируйте потребителей в линии, затем нажмите «Автособрать щит».</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
