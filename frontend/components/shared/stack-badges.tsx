import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import type { StackSummary } from '@/types/stacks'

interface StackBadgesProps {
  stacks: StackSummary[]
  maxVisible?: number
}

export function StackBadges({ stacks, maxVisible = 2 }: StackBadgesProps) {
  if (stacks.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>
  }

  const visible = stacks.slice(0, maxVisible)
  const overflow = stacks.length - maxVisible

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((stack) => (
        <Badge key={stack.id} asChild variant="secondary" className="text-xs">
          <Link href={`/stacks/${stack.id}`} onClick={(e) => e.stopPropagation()}>
            {stack.name}
          </Link>
        </Badge>
      ))}
      {overflow > 0 && (
        <Badge variant="outline" className="text-xs">
          +{overflow}
        </Badge>
      )}
    </div>
  )
}
