// frontend/components/agent/flows/documents/upload/steps/upload-metadata.tsx
'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StackPickerContent } from '@/components/shared/stack-picker-content'
import * as Icons from '@/components/icons'
import type { UploadFlowData } from '../../../../stores/agent-store'

interface UploadMetadataProps {
  data: UploadFlowData
  onUpdate: (data: Partial<UploadFlowData>) => void
  onSave: () => void
  onRegenerate: () => void
  isSaving: boolean
  isRegenerating: boolean
}

export function UploadMetadata({
  data,
  onUpdate,
  onSave,
  onRegenerate,
  isSaving,
  isRegenerating,
}: UploadMetadataProps) {
  const [newTag, setNewTag] = useState('')
  const [stackPickerOpen, setStackPickerOpen] = useState(false)

  const handleAddTag = useCallback(() => {
    const tag = newTag.trim().toLowerCase()
    if (tag && !data.tags.includes(tag)) {
      onUpdate({ tags: [...data.tags, tag] })
    }
    setNewTag('')
  }, [newTag, data.tags, onUpdate])

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    onUpdate({ tags: data.tags.filter((t) => t !== tagToRemove) })
  }, [data.tags, onUpdate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }, [handleAddTag])

  const handleSelectStack = useCallback((stackId: string, stackName: string) => {
    // Toggle: if same stack selected, deselect
    if (data.stackId === stackId) {
      onUpdate({ stackId: null, stackName: null })
    } else {
      onUpdate({ stackId, stackName })
    }
    setStackPickerOpen(false)
  }, [data.stackId, onUpdate])

  const handleClearStack = useCallback(() => {
    onUpdate({ stackId: null, stackName: null })
  }, [onUpdate])

  return (
    <div className="space-y-4">
      {/* Display Name */}
      <div className="space-y-1.5">
        <label htmlFor="display-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="display-name"
          value={data.displayName}
          onChange={(e) => onUpdate({ displayName: e.target.value })}
          placeholder="Document name"
        />
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Tags</label>
        <div className="flex flex-wrap gap-1.5">
          {data.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Remove ${tag} tag`}
              >
                <Icons.X className="size-3" />
              </button>
            </Badge>
          ))}
          <div className="flex items-center gap-1">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add tag..."
              className="h-6 w-24 text-xs"
              aria-label="New tag name"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={handleAddTag}
              disabled={!newTag.trim()}
              aria-label="Add tag"
            >
              <Icons.Plus className="size-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-1.5">
        <label htmlFor="summary" className="text-sm font-medium">
          Summary
        </label>
        <Textarea
          id="summary"
          value={data.summary}
          onChange={(e) => onUpdate({ summary: e.target.value })}
          placeholder="Brief description of the document"
          className="min-h-16 resize-none"
          rows={2}
        />
      </div>

      {/* Stack Assignment */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          Add to Stack <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        {data.stackId ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <Icons.Stack className="size-3" />
              {data.stackName}
              <button
                type="button"
                onClick={handleClearStack}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label="Remove stack assignment"
              >
                <Icons.X className="size-3" />
              </button>
            </Badge>
          </div>
        ) : (
          <DropdownMenu open={stackPickerOpen} onOpenChange={setStackPickerOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="text-muted-foreground">Select a stack...</span>
                <Icons.ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
              <StackPickerContent
                onSelectStack={handleSelectStack}
                isOpen={stackPickerOpen}
                showStackIcon
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Error display */}
      {data.metadataError && (
        <p className="text-sm text-destructive">{data.metadataError}</p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          onClick={onRegenerate}
          disabled={isRegenerating || isSaving}
        >
          {isRegenerating ? (
            <>
              <Icons.Loader2 className="size-4 animate-spin mr-2" />
              Regenerating...
            </>
          ) : (
            <>
              <Icons.Refresh className="size-4 mr-2" />
              Regenerate
            </>
          )}
        </Button>
        <Button
          onClick={onSave}
          disabled={isSaving || isRegenerating || !data.displayName.trim()}
        >
          {isSaving ? (
            <>
              <Icons.Loader2 className="size-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            'Save Document'
          )}
        </Button>
      </div>
    </div>
  )
}
