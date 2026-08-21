'use client'

import { useRouter } from 'next/navigation'
import { icon } from './icons'

export default function EditorMenuButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push('/')}
      className="editor-menu-button"
      title="В меню"
    >
      <span className="ui-icon" dangerouslySetInnerHTML={{ __html: icon('menu') }} />
      <span>Меню</span>
    </button>
  )
}
