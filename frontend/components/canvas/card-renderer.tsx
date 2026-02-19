'use client'

import type { Block } from '@/types/ws-protocol'

/**
 * Renders an array of blocks top-to-bottom inside a canvas card.
 * Unknown block types render a fallback instead of crashing.
 *
 * Block components are intentionally inline here for now — they'll be
 * extracted to individual files in the m7b.4.3 (MVP block components) task.
 */

function FallbackBlock({ type }: { type: string }) {
  return (
    <div className="rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
      Unknown block type: {type}
    </div>
  )
}

function PlaceholderBlock({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading':
      return (
        <div>
          <h3 className="text-sm font-semibold">{block.text}</h3>
          {block.subtitle && (
            <p className="text-xs text-muted-foreground">{block.subtitle}</p>
          )}
        </div>
      )
    case 'text':
      return <p className="text-sm whitespace-pre-wrap">{block.content}</p>
    case 'stat':
      return (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{block.value}</span>
          <span className="text-xs text-muted-foreground">{block.label}</span>
          {block.trend && (
            <span className="text-xs text-muted-foreground">{block.trend}</span>
          )}
        </div>
      )
    case 'key-value':
      return (
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {block.pairs.map((pair, i) => (
            <div key={i} className="contents">
              <span className="text-muted-foreground">{pair.label}</span>
              <span>{pair.value}</span>
            </div>
          ))}
        </div>
      )
    case 'table':
      return (
        <div className="overflow-auto text-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                {block.columns.map((col) => (
                  <th key={col} className="px-2 py-1 text-left text-xs font-medium text-muted-foreground">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  {block.columns.map((col) => (
                    <td key={col} className="px-2 py-1">
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'badge':
      return (
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
          block.variant === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
          block.variant === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
          block.variant === 'destructive' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
          'bg-muted text-muted-foreground'
        }`}>
          {block.text}
        </span>
      )
    case 'progress':
      return (
        <div className="space-y-1">
          {block.label && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{block.label}</span>
              <span>{block.value}%</span>
            </div>
          )}
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, block.value))}%` }}
            />
          </div>
        </div>
      )
    case 'separator':
      return <hr className="border-border" />
    default:
      return <FallbackBlock type={(block as { type: string }).type} />
  }
}

export function CardRenderer({ blocks }: { blocks: Block[] }) {
  if (blocks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">Empty card</p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block) => (
        <PlaceholderBlock key={block.id} block={block} />
      ))}
    </div>
  )
}
