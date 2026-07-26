'use client'

import { createContext, useContext, ReactNode, RefObject } from 'react'
import { CanvasEngine } from '@core/engine/CanvasEngine'
import { ThemeManager } from '@core/editor/ThemeManager'
import { PanelManager } from '@/components/editor/PanelManager'

interface EditorContextValue {
  engineRef: RefObject<CanvasEngine | null>
  themeManagerRef: RefObject<ThemeManager | null>
  panelManagerRef: RefObject<PanelManager | null>
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function EditorProvider({
  children,
  engineRef,
  themeManagerRef,
  panelManagerRef,
}: {
  children: ReactNode
  engineRef: RefObject<CanvasEngine | null>
  themeManagerRef: RefObject<ThemeManager | null>
  panelManagerRef: RefObject<PanelManager | null>
}) {
  return (
    <EditorContext.Provider value={{ engineRef, themeManagerRef, panelManagerRef }}>
      {children}
    </EditorContext.Provider>
  )
}

export function useEditor() {
  const ctx = useContext(EditorContext)
  if (!ctx) {
    throw new Error('useEditor must be used within EditorProvider')
  }
  return ctx
}
