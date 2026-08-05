'use client'

import { useCadStore } from '@/stores/cadStore'
import { ModalPanel } from './ModalPanel'

export default function RoomsPanel() {
  const open = useCadStore((s) => s.roomsOpen)
  const setOpen = useCadStore((s) => s.setRoomsOpen)

  return (
    <ModalPanel open={open} onClose={() => setOpen(false)} title="Комнаты и потребители">
      <div className="text-sm text-gray-600 dark:text-gray-300">
        <p>Здесь будет управление комнатами, потребителями и группировка линий щита.</p>
      </div>
    </ModalPanel>
  )
}
