'use client'

import { createContext, useContext, useRef, useState, useCallback, useMemo, ReactNode } from 'react'
import type { ImperativePanelHandle } from 'react-resizable-panels'

// Tab persistence uses a separate key from the panel layout
// The panel layout (width/collapsed) is handled by react-resizable-panels autoSaveId
const TAB_STORAGE_KEY = 'stackdocs-preview-tab'
const PANEL_STORAGE_KEY = 'react-resizable-panels:stackdocs-preview-panel'

// Read initial collapsed state from localStorage synchronously to avoid flash
function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const saved = localStorage.getItem(PANEL_STORAGE_KEY)
    if (saved) {
      const state = JSON.parse(saved)
      const panelKey = Object.keys(state)[0]
      if (panelKey && state[panelKey]?.layout) {
        const layout = state[panelKey].layout as number[]
        // Preview panel is the second panel - collapsed if size is 0
        return layout.length === 2 && layout[1] === 0
      }
    }
  } catch {
    // Invalid JSON, use default
  }
  return false
}

// Read initial tab from localStorage synchronously
function getInitialTab(): 'pdf' | 'text' {
  if (typeof window === 'undefined') return 'pdf'
  const saved = localStorage.getItem(TAB_STORAGE_KEY)
  if (saved === 'pdf' || saved === 'text') return saved
  if (saved === 'visual') return 'text' // migrate old value
  return 'pdf'
}

interface PreviewPanelContextValue {
  panelRef: React.RefObject<ImperativePanelHandle | null>
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  toggle: () => void
  activeTab: 'pdf' | 'text'
  setActiveTab: (tab: 'pdf' | 'text') => void
}

const PreviewPanelContext = createContext<PreviewPanelContextValue | null>(null)

export function PreviewPanelProvider({ children }: { children: ReactNode }) {
  const panelRef = useRef<ImperativePanelHandle | null>(null)

  // Initialize from localStorage synchronously to avoid flash
  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsed)
  const [activeTab, setActiveTabState] = useState<'pdf' | 'text'>(getInitialTab)

  const setActiveTab = useCallback((tab: 'pdf' | 'text') => {
    setActiveTabState(tab)
    localStorage.setItem(TAB_STORAGE_KEY, tab)
  }, [])

  const toggle = useCallback(() => {
    const panel = panelRef.current
    if (!panel) return

    if (panel.isCollapsed()) {
      panel.expand()
    } else {
      panel.collapse()
    }
  }, [panelRef])

  const contextValue = useMemo(() => ({
    panelRef,
    isCollapsed,
    setIsCollapsed,
    toggle,
    activeTab,
    setActiveTab,
  }), [panelRef, isCollapsed, setIsCollapsed, toggle, activeTab, setActiveTab])

  return (
    <PreviewPanelContext.Provider value={contextValue}>
      {children}
    </PreviewPanelContext.Provider>
  )
}

export function usePreviewPanel() {
  const context = useContext(PreviewPanelContext)
  if (!context) {
    throw new Error('usePreviewPanel must be used within PreviewPanelProvider')
  }
  return context
}
