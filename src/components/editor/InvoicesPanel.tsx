'use client'

import { useCadStore } from '@/stores/cadStore'
import { ModalPanel } from './ModalPanel'

export default function InvoicesPanel() {
  const open = useCadStore((s) => s.invoicesOpen)
  const setOpen = useCadStore((s) => s.setInvoicesOpen)

  return (
    <ModalPanel open={open} onClose={() => setOpen(false)} title="Счета">
      <div className="text-sm text-gray-600 dark:text-gray-300">
        <p>Здесь будет создание и история счетов.</p>
      </div>
    </ModalPanel>
  )
}
