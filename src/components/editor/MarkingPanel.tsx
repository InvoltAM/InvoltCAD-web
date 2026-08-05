'use client'

import { useCadStore } from '@/stores/cadStore'
import { ModalPanel } from './ModalPanel'

export default function MarkingPanel() {
  const open = useCadStore((s) => s.markingOpen)
  const setOpen = useCadStore((s) => s.setMarkingOpen)

  return (
    <ModalPanel open={open} onClose={() => setOpen(false)} title="Маркировка IEC">
      <div className="text-sm text-gray-600 dark:text-gray-300">
        <p>Здесь будет генерация маркировки автоматов и печать этикеток.</p>
      </div>
    </ModalPanel>
  )
}
