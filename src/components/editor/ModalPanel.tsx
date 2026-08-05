'use client'

import { useCadStore } from '@/stores/cadStore'

interface ModalPanelProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function ModalPanel({ open, onClose, title, children }: ModalPanelProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/35"
      onClick={onClose}
    >
      <div
        className="absolute left-1/2 top-1/2 flex max-h-[80vh] w-[calc(100%-32px)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-white p-4 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">{title}</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
