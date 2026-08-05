'use client'

import { useCadStore } from '@/stores/cadStore'
import { ModalPanel } from './ModalPanel'

export default function TemplatesPanel() {
  const open = useCadStore((s) => s.templatesOpen)
  const setOpen = useCadStore((s) => s.setTemplatesOpen)

  return (
    <ModalPanel open={open} onClose={() => setOpen(false)} title="Шаблоны проектов">
      <div className="text-sm text-gray-600 dark:text-gray-300">
        <p>Здесь будут шаблоны типовых объектов и комнат.</p>
      </div>
    </ModalPanel>
  )
}
