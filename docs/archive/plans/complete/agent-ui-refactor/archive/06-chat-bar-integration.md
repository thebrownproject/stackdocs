# Chat Bar Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate the dynamic chat bar with stack operations for AI-first UX.

**Architecture:** Stack-context aware chat bar that shows status, handles agent SSE streams, and provides action buttons.

**Tech Stack:** React, SSE EventSource, Zustand or Context for state

---

## Task 1: Create Stack Agent Hook

**Files:**
- Create: `frontend/hooks/use-stack-agent.ts`

**Step 1: Implement SSE streaming hook for stack operations**

```typescript
// frontend/hooks/use-stack-agent.ts
'use client'

import { useState, useCallback, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'

interface AgentEvent {
  text?: string
  tool?: string
  input?: Record<string, unknown>
  complete?: boolean
  error?: string
  table_id?: string
  session_id?: string
}

interface UseStackAgentOptions {
  onText?: (text: string) => void
  onTool?: (tool: string, input: Record<string, unknown>) => void
  onComplete?: (tableId: string, sessionId?: string) => void
  onError?: (error: string) => void
}

type AgentStatus = 'idle' | 'connecting' | 'processing' | 'complete' | 'error'

export function useStackAgent(options: UseStackAgentOptions = {}) {
  const { getToken } = useAuth()
  const [status, setStatus] = useState<AgentStatus>('idle')
  const [currentTool, setCurrentTool] = useState<string | null>(null)
  const [progress, setProgress] = useState<string[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)

  const extractTable = useCallback(async (stackId: string, tableId: string) => {
    setStatus('connecting')
    setProgress([])
    setCurrentTool(null)

    abortControllerRef.current = new AbortController()

    try {
      const token = await getToken()
      const formData = new FormData()

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/stack/${stackId}/tables/${tableId}/extract`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
          signal: abortControllerRef.current.signal,
        }
      )

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      setStatus('processing')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No response body')

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const event: AgentEvent = JSON.parse(line.slice(6))

            if (event.text) {
              setProgress(prev => [...prev, event.text!])
              options.onText?.(event.text)
            }
            if (event.tool) {
              setCurrentTool(event.tool)
              setProgress(prev => [...prev, `Using ${event.tool}...`])
              options.onTool?.(event.tool, event.input || {})
            }
            if (event.complete) {
              setStatus('complete')
              setCurrentTool(null)
              options.onComplete?.(event.table_id!, event.session_id)
            }
            if (event.error) {
              setStatus('error')
              options.onError?.(event.error)
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setStatus('error')
        options.onError?.((error as Error).message)
      }
    }
  }, [getToken, options])

  const correctTable = useCallback(async (
    stackId: string,
    tableId: string,
    instruction: string
  ) => {
    setStatus('connecting')
    setProgress([])

    abortControllerRef.current = new AbortController()

    try {
      const token = await getToken()
      const formData = new FormData()
      formData.append('instruction', instruction)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/stack/${stackId}/tables/${tableId}/correct`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
          signal: abortControllerRef.current.signal,
        }
      )

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      setStatus('processing')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No response body')

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const event: AgentEvent = JSON.parse(line.slice(6))
            if (event.text) options.onText?.(event.text)
            if (event.complete) {
              setStatus('complete')
              options.onComplete?.(event.table_id!, event.session_id)
            }
            if (event.error) {
              setStatus('error')
              options.onError?.(event.error)
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setStatus('error')
        options.onError?.((error as Error).message)
      }
    }
  }, [getToken, options])

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    setStatus('idle')
    setProgress([])
    setCurrentTool(null)
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setProgress([])
    setCurrentTool(null)
  }, [])

  return { status, currentTool, progress, extractTable, correctTable, cancel, reset }
}
```

**Step 2: Commit**

```bash
git add frontend/hooks/use-stack-agent.ts
git commit -m "feat(frontend): add stack agent SSE hook"
```

---

## Task 2: Create Stack Chat Bar Component

**Files:**
- Create: `frontend/components/stacks/stack-chat-bar.tsx`

**Step 1: Implement dynamic chat bar for stacks**

```typescript
// frontend/components/stacks/stack-chat-bar.tsx
'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import * as Icons from '@/components/icons'
import { useStackAgent } from '@/hooks/use-stack-agent'

interface StackChatBarProps {
  stackId: string
  activeTableId?: string
  onExtractionComplete?: () => void
}

export function StackChatBar({ stackId, activeTableId, onExtractionComplete }: StackChatBarProps) {
  const [input, setInput] = React.useState('')
  const [showPopup, setShowPopup] = React.useState(false)

  const { status, currentTool, progress, extractTable, correctTable, cancel, reset } = useStackAgent({
    onComplete: () => {
      onExtractionComplete?.()
      setTimeout(() => setShowPopup(false), 3000)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !activeTableId) return
    setShowPopup(true)
    correctTable(stackId, activeTableId, input.trim())
    setInput('')
  }

  const isProcessing = status === 'connecting' || status === 'processing'

  const barText = React.useMemo(() => {
    switch (status) {
      case 'connecting': return 'Connecting to agent...'
      case 'processing': return currentTool ? `Running ${currentTool}...` : 'Processing...'
      case 'complete': return 'Done!'
      case 'error': return 'Something went wrong'
      default: return 'How can I help you today?'
    }
  }, [status, currentTool])

  return (
    <div className="relative">
      {/* Popup */}
      {showPopup && (
        <div className="absolute bottom-full left-0 right-0 mb-2 mx-4">
          <div className="bg-background border rounded-lg shadow-lg p-4 max-h-[300px] overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-sm">
                {status === 'complete' ? 'Complete' : 'Processing'}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="size-6" onClick={() => setShowPopup(false)}>
                  <Icons.ChevronDown className="size-4" />
                </Button>
                {isProcessing && (
                  <Button variant="ghost" size="icon" className="size-6" onClick={cancel}>
                    <Icons.X className="size-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              {progress.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icons.Check className="size-3 text-green-500" />
                  <span>{step}</span>
                </div>
              ))}
              {isProcessing && (
                <div className="flex items-center gap-2 text-sm">
                  <Icons.Loader className="size-3 animate-spin" />
                  <span>{currentTool ? `Using ${currentTool}...` : 'Processing...'}</span>
                </div>
              )}
            </div>

            {status === 'complete' && (
              <div className="mt-3 pt-3 border-t">
                <Button size="sm" variant="outline" onClick={() => setShowPopup(false)}>Close</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat bar */}
      <div className={cn("flex items-center gap-3 px-4 py-3 border-t bg-background", isProcessing && "bg-muted/50")}>
        <div className="flex-1">
          {isProcessing ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icons.Loader className="size-4 animate-spin" />
              <span>{barText}</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <Icons.Sparkles className="size-4 text-muted-foreground" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={barText}
                className="border-0 shadow-none focus-visible:ring-0 px-0"
                disabled={!activeTableId}
              />
            </form>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          onClick={isProcessing ? () => setShowPopup(true) : handleSubmit}
          disabled={!activeTableId && !isProcessing}
        >
          {isProcessing ? <Icons.ChevronUp className="size-4" /> : <Icons.Send className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/stacks/stack-chat-bar.tsx
git commit -m "feat(frontend): add stack chat bar component"
```

---

## Task 3: Integrate Chat Bar with Stack Detail

**Files:**
- Modify: `frontend/components/stacks/stack-detail-client.tsx`

**Step 1: Add chat bar to layout**

```typescript
// In stack-detail-client.tsx, add import:
import { StackChatBar } from './stack-chat-bar'

// At the bottom of the component, before closing </div>:
<StackChatBar
  stackId={stack.id}
  activeTableId={activeTable?.id}
  onExtractionComplete={() => router.refresh()}
/>
```

**Step 2: Commit**

```bash
git add frontend/components/stacks/stack-detail-client.tsx
git commit -m "feat(frontend): integrate chat bar with stack detail"
```

---

## Task 4: Create Table Dialog

**Files:**
- Create: `frontend/components/stacks/create-table-dialog.tsx`

**Step 1: Implement create table dialog**

```typescript
// frontend/components/stacks/create-table-dialog.tsx
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import * as Icons from '@/components/icons'

interface CreateTableDialogProps {
  stackId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateTableDialog({ stackId, open, onOpenChange }: CreateTableDialogProps) {
  const router = useRouter()
  const [name, setName] = React.useState('')
  const [mode, setMode] = React.useState<'auto' | 'custom'>('auto')
  const [customColumns, setCustomColumns] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('mode', mode)
      if (mode === 'custom' && customColumns.trim()) {
        const cols = customColumns.split(',').map(c => c.trim()).filter(Boolean)
        formData.append('custom_columns', JSON.stringify(cols))
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stack/${stackId}/create-table`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Failed to create table')
      const { table_id } = await response.json()

      onOpenChange(false)
      router.push(`/stacks/${stackId}?tab=table&table=${table_id}`)
      router.refresh()
    } catch (error) {
      console.error('Error creating table:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Table</DialogTitle>
          <DialogDescription>Create a new table to extract data from documents in this stack.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Table Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Invoice Data" />
          </div>

          <div className="space-y-2">
            <Label>Extraction Mode</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'auto' | 'custom')}>
              <div className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="auto" id="auto" className="mt-1" />
                <div>
                  <Label htmlFor="auto" className="font-medium cursor-pointer">Auto Extract</Label>
                  <p className="text-sm text-muted-foreground">AI analyzes documents and determines columns</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="custom" id="custom" className="mt-1" />
                <div>
                  <Label htmlFor="custom" className="font-medium cursor-pointer">Custom Fields</Label>
                  <p className="text-sm text-muted-foreground">Specify exactly which fields to extract</p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {mode === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="columns">Column Names</Label>
              <Textarea id="columns" value={customColumns} onChange={(e) => setCustomColumns(e.target.value)} placeholder="Vendor, Date, Amount" rows={3} />
              <p className="text-xs text-muted-foreground">Comma-separated list</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? <><Icons.Loader className="size-4 animate-spin mr-2" />Creating...</> : 'Create Table'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Wire up in stack-detail-client.tsx**

```typescript
// Add state:
const [showCreateTable, setShowCreateTable] = React.useState(false)

// Update + button onClick:
onClick={() => setShowCreateTable(true)}

// Add dialog before closing tag:
<CreateTableDialog stackId={stack.id} open={showCreateTable} onOpenChange={setShowCreateTable} />
```

**Step 3: Commit**

```bash
git add frontend/components/stacks/create-table-dialog.tsx frontend/components/stacks/stack-detail-client.tsx
git commit -m "feat(frontend): add create table dialog"
```

---

## Task 5: Update Component Exports

**Files:**
- Modify: `frontend/components/stacks/index.ts`

**Step 1: Add new exports**

```typescript
export { StackDetailClient } from './stack-detail-client'
export { StackDocumentsTab } from './stack-documents-tab'
export { StackTableView } from './stack-table-view'
export { StackChatBar } from './stack-chat-bar'
export { CreateTableDialog } from './create-table-dialog'
```

**Step 2: Commit**

```bash
git add frontend/components/stacks/index.ts
git commit -m "feat(stacks): update component exports"
```
