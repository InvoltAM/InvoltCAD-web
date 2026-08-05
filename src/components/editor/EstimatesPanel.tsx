'use client'

import { useCadStore } from '@/stores/cadStore'
import { ModalPanel } from './ModalPanel'

export default function EstimatesPanel() {
  const open = useCadStore((s) => s.estimatesOpen)
  const setOpen = useCadStore((s) => s.setEstimatesOpen)

  return (
    <ModalPanel open={open} onClose={() => setOpen(false)} title="Сметы и КП">
      <div className="text-sm text-gray-600 dark:text-gray-300">
        <p>Здесь будет формирование смет и коммерческих предложений.</p>
      </div>
    </ModalPanel>
  )
}
