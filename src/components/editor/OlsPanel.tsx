'use client'

import { useEffect, useMemo, useState } from 'react'
import { useEditor } from './EditorContext'
import { Plan } from '@core/model/Plan'
import { generateOls } from '@core/ols/olsGenerator'

export default function OlsPanel() {
  const { engineRef } = useEditor()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPlan(engineRef.current?.plan ?? null)
    }, 0)
    return () => clearTimeout(timer)
  }, [engineRef])

  const ols = useMemo(() => {
    if (!plan) return null
    return generateOls(plan)
  }, [plan])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute right-[600px] top-3 z-20 rounded-lg border border-gray-200 bg-white p-2 shadow-md dark:border-gray-700 dark:bg-gray-800 md:block"
        title="Однолинейная схема"
      >
        ⚡
      </button>
    )
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35" onClick={() => setOpen(false)}>
      <div
        className="h-[80vh] w-[90vw] max-w-4xl rounded-lg bg-white p-4 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">Однолинейная схема</span>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        <div className="h-[calc(100%-48px)] overflow-auto rounded border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-900">
          {ols ? (
            <svg width="100%" height="100%" viewBox="0 0 900 600">
              {/* Ребра */}
              {ols.edges.map((edge) => {
                const fromNode = ols.nodes.find((n) => n.id === edge.from)
                const toNode = ols.nodes.find((n) => n.id === edge.to)
                if (!fromNode || !toNode) return null

                return (
                  <line
                    key={edge.id}
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke={edge.cableType === 'power' ? '#ef4444' : edge.cableType === 'lighting' ? '#f59e0b' : '#10b981'}
                    strokeWidth="2"
                  />
                )
              })}

              {/* Узлы */}
              {ols.nodes.map((node) => (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <rect
                    x="-40"
                    y="-20"
                    width="80"
                    height="40"
                    rx="4"
                    fill={node.type === 'input' ? '#dc2626' : node.type === 'panel' ? '#2563eb' : node.type === 'group' ? '#f59e0b' : '#6b7280'}
                  />
                  <text
                    x="0"
                    y="5"
                    textAnchor="middle"
                    fill="white"
                    fontSize="12"
                    fontWeight="600"
                  >
                    {node.label}
                  </text>
                </g>
              ))}
            </svg>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
              Нет данных для схемы
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
