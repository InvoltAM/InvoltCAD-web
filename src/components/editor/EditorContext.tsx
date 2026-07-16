'use client'

import { createContext, useContext, ReactNode, RefObject } from 'react'
import { CanvasEngine } from '@core/engine/CanvasEngine'
import { ThemeManager } from '@core/editor/ThemeManager'

interface EditorContextValue {
  engineRef: RefObject<CanvasEngine | null>
  themeManagerRef: RefObject<ThemeManager | null>
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function EditorProvider({
  children,
  engineRef,
  themeManagerRef,
}: {
  children: ReactNode
  engineRef: RefObject<CanvasEngine | null>
  themeManagerRef: RefObject<ThemeManager | null>
}) {
  return (
    <EditorContext.Provider value={{ engineRef, themeManagerRef }}>
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
