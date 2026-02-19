'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Responsive,
  useContainerWidth,
  getCompactor,
  type Layout,
  type LayoutItem,
  type ResponsiveLayouts,
} from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { Badge } from '@/components/ui/badge'
import type { Block } from '@/types/ws-protocol'
import { CardRenderer } from './card-renderer'
import * as Icons from '@/components/icons'

export interface GridCard {
  id: string
  title: string
  blocks: Block[]
}

export interface GridLayoutSpikeProps {
  cards?: GridCard[]
  onCardClose?: (cardId: string) => void
}

const BREAKPOINTS = { lg: 1200, md: 768, sm: 0 }
const COLS = { lg: 3, md: 2, sm: 1 }
const ROW_HEIGHT = 150
const MARGIN: [number, number] = [20, 20]
const DEFAULT_CARD_H = 3


/** Place a new card in the next available grid slot. */
function autoPlaceGrid(existingLayout: LayoutItem[], cols: number): { x: number; y: number } {
  if (existingLayout.length === 0) return { x: 0, y: 0 }
  // Find the bottom of the current layout
  let maxBottom = 0
  for (const item of existingLayout) {
    maxBottom = Math.max(maxBottom, item.y + item.h)
  }
  // Try to fit in existing row gaps first (left to right scan of bottom row)
  const bottomRow = existingLayout.filter((item) => item.y + item.h === maxBottom)
  const occupiedCols = new Set(bottomRow.flatMap((item) => Array.from({ length: item.w }, (_, i) => item.x + i)))
  for (let x = 0; x <= cols - 1; x++) {
    if (!occupiedCols.has(x)) return { x, y: maxBottom - DEFAULT_CARD_H }
  }
  // No gap — place below everything
  return { x: 0, y: maxBottom }
}

export function GridLayoutSpike({ cards = [], onCardClose }: GridLayoutSpikeProps) {
  const { width, containerRef, mounted } = useContainerWidth()
  const [layouts, setLayouts] = useState<ResponsiveLayouts>({})
  const [breakpoint, setBreakpoint] = useState('lg')
  const layoutRef = useRef<LayoutItem[]>([])

  // Sync cards → layouts: add layout items for new cards, remove stale ones
  useEffect(() => {
    if (cards.length === 0) {
      setLayouts({})
      layoutRef.current = []
      return
    }

    const cardIds = new Set(cards.map((c) => c.id))
    const currentLayout = layoutRef.current

    // Keep existing positions for known cards, add new ones
    const kept = currentLayout.filter((item) => cardIds.has(item.i))
    const knownIds = new Set(kept.map((item) => item.i))
    const cols = COLS[breakpoint as keyof typeof COLS] ?? 3

    const newItems: LayoutItem[] = []
    for (const card of cards) {
      if (!knownIds.has(card.id)) {
        const pos = autoPlaceGrid([...kept, ...newItems], cols)
        newItems.push({ i: card.id, x: pos.x, y: pos.y, w: 1, h: DEFAULT_CARD_H, minW: 1, minH: 2 })
      }
    }

    const merged = [...kept, ...newItems]
    layoutRef.current = merged
    setLayouts({ lg: merged, md: merged, sm: merged })
  }, [cards])

  const handleLayoutChange = useCallback(
    (_layout: Layout, allLayouts: ResponsiveLayouts) => {
      // Only update ref — Responsive manages its own internal state.
      // setLayouts lives exclusively in the useEffect above to avoid render loops.
      const current = allLayouts[breakpoint] ?? _layout
      layoutRef.current = [...current]
    },
    [breakpoint],
  )

  const hasCards = cards.length > 0

  return (
    <div className="flex h-full flex-col">
      {/* Status bar */}
      <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2">
        <span className="text-xs font-medium uppercase text-muted-foreground">
          {hasCards ? 'canvas' : 'grid spike'}
        </span>
        <Badge variant="outline" className="text-[10px]">
          {cards.length} card{cards.length !== 1 ? 's' : ''}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          bp: {breakpoint}
        </Badge>
      </div>

      {!hasCards ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Cards will appear here when the agent creates them
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto p-4 [&_.react-draggable-dragging]:!opacity-40 [&_.react-grid-item.resizing]:!opacity-40 [&_.react-grid-item.resizing]:!select-none [&_.react-grid-placeholder]:!rounded-xl [&_.react-grid-placeholder]:!border-2 [&_.react-grid-placeholder]:!border-dashed [&_.react-grid-placeholder]:!border-primary/30 [&_.react-grid-placeholder]:!bg-transparent [&_.react-grid-placeholder]:!opacity-100"
        >
          {mounted && (
            <Responsive
              width={width}
              breakpoints={BREAKPOINTS}
              cols={COLS}
              layouts={layouts}
              rowHeight={ROW_HEIGHT}
              compactor={getCompactor(null, false, true)}
              margin={MARGIN}
              dragConfig={{ handle: '.drag-handle' }}
              onLayoutChange={handleLayoutChange}
              onBreakpointChange={(bp: string) => setBreakpoint(bp)}
            >
              {cards.map((card) => (
                <div key={card.id}>
                  <div className="flex h-full flex-col rounded-xl border bg-card shadow-sm">
                    <div className="drag-handle flex items-center justify-between border-b px-3 py-2">
                      <span className="truncate text-sm font-medium">{card.title}</span>
                      {onCardClose && (
                        <button
                          className="ml-2 flex-none rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => onCardClose(card.id)}
                        >
                          <Icons.X className="size-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex-1 overflow-auto p-3">
                      <CardRenderer blocks={card.blocks} />
                    </div>
                  </div>
                </div>
              ))}
            </Responsive>
          )}
        </div>
      )}
    </div>
  )
}
