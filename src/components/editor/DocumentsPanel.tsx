'use client'

import { useCadStore } from '@/stores/cadStore'
import { ModalPanel } from './ModalPanel'

export default function DocumentsPanel() {
  const open = useCadStore((s) => s.documentsOpen)
  const setOpen = useCadStore((s) => s.setDocumentsOpen)

  return (
    <ModalPanel open={open} onClose={() => setOpen(false)} title="Договоры и акты">
      <div className="text-sm text-gray-600 dark:text-gray-300">
        <p>Здесь будут договоры, акты и другие документы.</p>
      </div>
    </ModalPanel>
  )
}
