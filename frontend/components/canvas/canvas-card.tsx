'use client'

import { memo } from 'react'
import { NodeResizer, type NodeProps, type Node } from '@xyflow/react'
import type { Block } from '@/types/ws-protocol'
import { CardRenderer } from './card-renderer'
import * as Icons from '@/components/icons'

export type CanvasCardData = {
  title: string
  blocks: Block[]
  onClose?: (cardId: string) => void
}

export type CanvasCardNode = Node<CanvasCardData, 'canvasCard'>

function CanvasCardComponent({ id, data, selected }: NodeProps<CanvasCardNode>) {
  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={120}
        isVisible={selected ?? false}
        lineClassName="!border-primary"
        handleClassName="!size-2 !rounded-sm !border-primary !bg-primary"
      />
      <div className="flex h-full flex-col rounded-xl border bg-card text-card-foreground shadow-sm">
        {/* Title bar — drag handle */}
        <div className="drag-handle flex items-center justify-between border-b px-3 py-2">
          <span className="truncate text-sm font-medium">{data.title}</span>
          <button
            className="ml-2 flex-none rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              data.onClose?.(id)
            }}
          >
            <Icons.X className="size-3.5" />
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-auto p-3">
          <CardRenderer blocks={data.blocks} />
        </div>
      </div>
    </>
  )
}

export const CanvasCard = memo(CanvasCardComponent)
