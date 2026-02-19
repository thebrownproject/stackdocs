"use client"

import * as Icons from "@/components/icons"

interface FilterPillProps {
  icon: React.ReactNode
  label: string
  onRemove: () => void
}

export function FilterPill({ icon, label, onRemove }: FilterPillProps) {
  return (
    <span className="inline-flex items-center h-7 pl-2 pr-1 text-xs rounded-md border bg-secondary/50 gap-1">
      <span className="inline-flex items-center size-3.5 [&>svg]:size-full">{icon}</span>
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="size-5 hover:bg-muted rounded grid place-items-center"
      >
        <Icons.X className="size-3" />
      </button>
    </span>
  )
}
