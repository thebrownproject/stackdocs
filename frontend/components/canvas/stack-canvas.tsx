'use client'

import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type NodeTypes,
  type OnNodesChange,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { CanvasCard, type CanvasCardNode } from './canvas-card'

const GRID_SIZE = 20

const nodeTypes: NodeTypes = {
  canvasCard: CanvasCard,
}

/**
 * Auto-placement: find a position that doesn't overlap existing cards.
 * Places cards in a row, wrapping when exceeding viewport width estimate.
 */
function autoPlace(existingNodes: Node[]): { x: number; y: number } {
  if (existingNodes.length === 0) {
    return { x: 40, y: 40 }
  }

  // Find rightmost edge of existing cards
  let maxRight = 0
  let maxRightY = 40

  for (const node of existingNodes) {
    const width = (node.measured?.width ?? node.width ?? 320)
    const right = (node.position?.x ?? 0) + width
    if (right > maxRight) {
      maxRight = right
      maxRightY = node.position?.y ?? 40
    }
  }

  // Place to the right with a gap, snapped to grid
  const x = Math.round((maxRight + 40) / GRID_SIZE) * GRID_SIZE
  const y = Math.round(maxRightY / GRID_SIZE) * GRID_SIZE

  return { x, y }
}

export interface StackCanvasProps {
  cards: CanvasCardNode[]
  onNodesChange?: OnNodesChange<CanvasCardNode>
  onCardClose?: (cardId: string) => void
}

export function StackCanvas({ cards, onNodesChange, onCardClose }: StackCanvasProps) {
  // Inject onClose callback into card data
  const nodesWithCallbacks = useMemo(() => {
    return cards.map((card) => ({
      ...card,
      dragHandle: '.drag-handle',
      data: {
        ...card.data,
        onClose: onCardClose,
      },
    }))
  }, [cards, onCardClose])

  return (
    <div className="size-full">
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={[]}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        snapToGrid
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
        selectionKeyCode={null}
      >
        <Background variant={BackgroundVariant.Dots} gap={GRID_SIZE} size={1} />
      </ReactFlow>
    </div>
  )
}

// Re-export for convenience
export { autoPlace, GRID_SIZE }
export type { CanvasCardNode } from './canvas-card'
export type { CanvasCardData } from './canvas-card'
