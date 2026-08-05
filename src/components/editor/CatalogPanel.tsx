'use client'

import { useCadStore } from '@/stores/cadStore'
import { ModalPanel } from './ModalPanel'

export default function CatalogPanel() {
  const open = useCadStore((s) => s.catalogOpen)
  const setOpen = useCadStore((s) => s.setCatalogOpen)

  return (
    <ModalPanel open={open} onClose={() => setOpen(false)} title="Каталог материалов и работ">
      <div className="text-sm text-gray-600 dark:text-gray-300">
        <p>Здесь будет каталог материалов, работ и импорт прайс-листов.</p>
      </div>
    </ModalPanel>
  )
}
