'use client'

import { useCadStore } from '@/stores/cadStore'
import { ModalPanel } from './ModalPanel'

export default function AutomationPanel() {
  const open = useCadStore((s) => s.automationOpen)
  const setOpen = useCadStore((s) => s.setAutomationOpen)

  return (
    <ModalPanel open={open} onClose={() => setOpen(false)} title="Wirenboard / Умный дом">
      <div className="text-sm text-gray-600 dark:text-gray-300">
        <p>Здесь будет генерация конфигураций Wirenboard и Home Assistant.</p>
      </div>
    </ModalPanel>
  )
}
