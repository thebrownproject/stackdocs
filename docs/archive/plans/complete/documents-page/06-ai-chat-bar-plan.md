# AI Chat Bar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a functional AI chat bar with real-time streaming activity panel to the document detail page.

**Prereq:** `05-ai-chat-bar-design.md` | **This plan:** Tasks 1-8

**Architecture:** Client component with useAgentStream hook handles fetch+ReadableStream to POST /api/agent/correct. Events render in collapsible panel above input. Auto-collapses 3s after completion.

**Tech Stack:** Next.js 16, shadcn/ui (Collapsible, Textarea), Tailwind CSS, fetch streaming API

---

## Task 1: Install Textarea Component

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/components/ui/textarea.tsx`

**Step 1: Install shadcn textarea**

Run:
```bash
cd frontend && npx shadcn@latest add textarea
```

**Step 2: Verify installation**

Run:
```bash
ls frontend/components/ui/textarea.tsx
```
Expected: File exists

**Step 3: Commit**

```bash
git add frontend/components/ui/textarea.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: add shadcn textarea component"
```

---

## Task 2: Create Agent API Helper

**Files:**
- Create: `frontend/lib/agent-api.ts`

**Step 1: Create the API helper**

Create `frontend/lib/agent-api.ts`:

```typescript
/**
 * Agent API helper for streaming corrections.
 *
 * Uses fetch + ReadableStream (not EventSource) because
 * the backend expects POST with FormData.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface AgentEvent {
  type: 'tool' | 'text' | 'complete' | 'error'
  content: string
  timestamp: number
  meta?: {
    extractionId?: string
    sessionId?: string
  }
}

/**
 * Humanize tool names from MCP format.
 * e.g., "mcp__extraction__read_ocr" → "Reading OCR"
 */
function humanizeToolName(toolName: string): string {
  // Strip mcp__extraction__ prefix
  const name = toolName.replace(/^mcp__\w+__/, '')

  // Map known tool names to human-readable labels
  const toolLabels: Record<string, string> = {
    read_ocr: 'Reading OCR',
    read_extraction: 'Reading extraction',
    save_extraction: 'Saving extraction',
    set_field: 'Updating field',
    delete_field: 'Removing field',
    complete: 'Completing',
  }

  return toolLabels[name] || name.replace(/_/g, ' ')
}

/**
 * Process a single SSE data line and emit event.
 */
function processSSELine(
  line: string,
  onEvent: OnEventCallback
): void {
  if (!line.startsWith('data: ')) return

  try {
    const json = JSON.parse(line.slice(6))
    const timestamp = Date.now()

    if ('error' in json) {
      onEvent({
        type: 'error',
        content: String(json.error),
        timestamp,
      })
    } else if ('complete' in json) {
      onEvent({
        type: 'complete',
        content: 'Update complete',
        timestamp,
        meta: {
          extractionId: typeof json.extraction_id === 'string'
            ? json.extraction_id
            : undefined,
          sessionId: typeof json.session_id === 'string'
            ? json.session_id
            : undefined,
        },
      })
    } else if ('tool' in json) {
      onEvent({
        type: 'tool',
        content: humanizeToolName(String(json.tool)),
        timestamp,
      })
    } else if ('text' in json) {
      onEvent({
        type: 'text',
        content: String(json.text),
        timestamp,
      })
    }
  } catch {
    // Ignore malformed JSON
  }
}

export type OnEventCallback = (event: AgentEvent) => void

/**
 * Stream agent correction request.
 *
 * Uses fetch + ReadableStream with proper SSE buffering to handle
 * messages that may be split across TCP chunk boundaries.
 *
 * @param documentId - Document to correct
 * @param instruction - User's correction instruction
 * @param onEvent - Callback for each event
 * @param authToken - Clerk auth token for Authorization header
 * @param signal - AbortController signal for cancellation
 */
export async function streamAgentCorrection(
  documentId: string,
  instruction: string,
  onEvent: OnEventCallback,
  authToken: string,
  signal?: AbortSignal
): Promise<void> {
  const formData = new FormData()
  formData.append('document_id', documentId)
  formData.append('instruction', instruction)

  const response = await fetch(`${API_URL}/api/agent/correct`, {
    method: 'POST',
    body: formData,
    signal,
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })

  if (!response.ok) {
    // Try to parse JSON error for better messages
    let errorMessage = `Request failed: ${response.status}`
    try {
      const errorData = await response.json()
      errorMessage = errorData.detail || errorData.message || errorMessage
    } catch {
      const errorText = await response.text()
      errorMessage = errorText || errorMessage
    }
    throw new Error(errorMessage)
  }

  if (!response.body) {
    throw new Error('No response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = '' // Accumulate chunks to handle split messages

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      buffer += text

      // Split by SSE message boundary (double newline)
      const messages = buffer.split('\n\n')

      // Keep last incomplete message in buffer
      buffer = messages.pop() || ''

      // Process complete messages
      for (const message of messages) {
        if (!message.trim()) continue

        const lines = message.split('\n')
        for (const line of lines) {
          processSSELine(line, onEvent)
        }
      }
    }

    // Process any remaining buffered data
    if (buffer.trim()) {
      const lines = buffer.split('\n')
      for (const line of lines) {
        processSSELine(line, onEvent)
      }
    }
  } finally {
    reader.releaseLock()
  }
}
```

**Step 2: Commit**

```bash
git add frontend/lib/agent-api.ts
git commit -m "feat: add agent API helper with SSE streaming"
```

---

## Task 3: Create useAgentStream Hook

**Files:**
- Create: `frontend/hooks/use-agent-stream.ts`

**Step 1: Create the streaming hook**

Create `frontend/hooks/use-agent-stream.ts`:

```typescript
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { streamAgentCorrection, AgentEvent } from '@/lib/agent-api'

export type AgentStatus = 'idle' | 'streaming' | 'complete' | 'error'

export interface UseAgentStreamReturn {
  status: AgentStatus
  events: AgentEvent[]
  error: string | null
  submit: (instruction: string) => void
  reset: () => void
}

export function useAgentStream(documentId: string): UseAgentStreamReturn {
  const { getToken } = useAuth()
  const [status, setStatus] = useState<AgentStatus>('idle')
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup on unmount - abort any in-flight request
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const reset = useCallback(() => {
    // Abort any in-flight request
    abortControllerRef.current?.abort()
    abortControllerRef.current = null

    setStatus('idle')
    setEvents([])
    setError(null)
  }, [])

  const submit = useCallback(
    async (instruction: string) => {
      // Reset state
      setStatus('streaming')
      setEvents([])
      setError(null)

      // Create new abort controller
      abortControllerRef.current = new AbortController()

      // Track if we received a complete event
      let receivedComplete = false

      const handleEvent = (event: AgentEvent) => {
        if (event.type === 'error') {
          setError(event.content)
          setStatus('error')
        } else if (event.type === 'complete') {
          receivedComplete = true
          setStatus('complete')
          // Add complete event to list for display
          setEvents((prev) => [...prev, event])
        } else {
          setEvents((prev) => [...prev, event])
        }
      }

      try {
        // Get auth token
        const token = await getToken()
        if (!token) {
          throw new Error('Authentication required. Please sign in and try again.')
        }

        await streamAgentCorrection(
          documentId,
          instruction,
          handleEvent,
          token,
          abortControllerRef.current.signal
        )

        // Only set complete if we're still streaming and received complete event
        // This prevents false "complete" status if errors occurred during parsing
        if (!receivedComplete) {
          setStatus((current) => {
            if (current === 'streaming') {
              return 'complete'
            }
            return current // Preserve error state
          })
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }

        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        setStatus('error')
      }
    },
    [documentId, getToken]
  )

  return {
    status,
    events,
    error,
    submit,
    reset,
  }
}
```

**Step 2: Commit**

```bash
git add frontend/hooks/use-agent-stream.ts
git commit -m "feat: add useAgentStream hook for SSE streaming"
```

---

## Task 4: Create AI Activity Panel Component

**Files:**
- Create: `frontend/components/documents/ai-activity-panel.tsx`

**Step 1: Create the activity panel**

Create `frontend/components/documents/ai-activity-panel.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Check, ChevronDown, Loader2, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentEvent } from '@/lib/agent-api'
import type { AgentStatus } from '@/hooks/use-agent-stream'

interface AiActivityPanelProps {
  status: AgentStatus
  events: AgentEvent[]
  error: string | null
  onClose: () => void
}

export function AiActivityPanel({
  status,
  events,
  error,
  onClose,
}: AiActivityPanelProps) {
  const [isOpen, setIsOpen] = useState(true)

  // Auto-collapse 3s after completion
  useEffect(() => {
    if (status === 'complete') {
      const timer = setTimeout(() => {
        setIsOpen(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [status])

  // Expand when streaming starts
  useEffect(() => {
    if (status === 'streaming') {
      setIsOpen(true)
    }
  }, [status])

  // Don't render if idle
  if (status === 'idle') {
    return null
  }

  const isStreaming = status === 'streaming'
  const isComplete = status === 'complete'
  const isError = status === 'error'

  // Filter events for display
  const toolEvents = events.filter((e) => e.type === 'tool')
  const textEvents = events.filter((e) => e.type === 'text')

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-xl border border-border bg-background shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <CollapsibleTrigger asChild disabled={isStreaming}>
            <button
              className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity disabled:cursor-not-allowed"
              aria-expanded={isOpen}
            >
              {isStreaming && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              {isComplete && <Check className="size-4 text-green-500" />}
              {isError && <AlertCircle className="size-4 text-destructive" />}

              <span>
                {isStreaming && 'Processing...'}
                {isComplete && 'Update complete'}
                {isError && 'Error'}
              </span>

              <ChevronDown
                className={cn(
                  'size-4 text-muted-foreground transition-transform duration-150',
                  isOpen && 'rotate-180'
                )}
              />
            </button>
          </CollapsibleTrigger>

          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onClose}
            aria-label="Close activity panel"
          >
            <X className="size-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3 max-h-64 overflow-y-auto">
            {/* Error message */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Tool events with checkmarks */}
            {toolEvents.length > 0 && (
              <div className="space-y-1.5">
                {toolEvents.map((event, i) => (
                  <div
                    key={`tool-${i}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in duration-150"
                  >
                    <Check className="size-3.5 text-green-500 shrink-0" />
                    <span>{event.content}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Text events with bullets */}
            {textEvents.length > 0 && (
              <div className="space-y-1.5">
                {textEvents.map((event, i) => (
                  <div
                    key={`text-${i}`}
                    className="flex items-start gap-2 text-sm animate-in fade-in duration-150"
                  >
                    <span className="text-muted-foreground shrink-0">•</span>
                    <span className="text-foreground">{event.content}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state while streaming */}
            {isStreaming && events.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Connecting to agent...
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/ai-activity-panel.tsx
git commit -m "feat: add AiActivityPanel component with collapsible UI"
```

---

## Task 5: Create AI Chat Bar Component

**Files:**
- Create: `frontend/components/documents/ai-chat-bar.tsx`

**Step 1: Create the chat bar**

Create `frontend/components/documents/ai-chat-bar.tsx`:

```tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { AiActivityPanel } from './ai-activity-panel'
import { useAgentStream } from '@/hooks/use-agent-stream'
import { cn } from '@/lib/utils'

interface AiChatBarProps {
  documentId: string
}

export function AiChatBar({ documentId }: AiChatBarProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { status, events, error, submit, reset } = useAgentStream(documentId)

  const isDisabled = status === 'streaming'

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px` // max 4 lines
    }
  }, [message])

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim()
    if (!trimmed || isDisabled) return

    submit(trimmed)
    setMessage('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [message, isDisabled, submit])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-3">
      {/* Activity Panel */}
      <AiActivityPanel
        status={status}
        events={events}
        error={error}
        onClose={reset}
      />

      {/* Chat Input */}
      <div
        className={cn(
          'rounded-lg border border-border bg-background px-3 py-2.5 transition-all duration-150',
          'focus-within:ring-2 focus-within:ring-ring/20 focus-within:border-foreground/20',
          isDisabled && 'opacity-50'
        )}
      >
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI to correct or refine extraction..."
          aria-label="AI chat input"
          aria-describedby="chat-hint"
          disabled={isDisabled}
          rows={1}
          className="min-h-0 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground"
        />
        <span id="chat-hint" className="sr-only">
          Press Enter to send, Shift+Enter for new line
        </span>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add frontend/components/documents/ai-chat-bar.tsx
git commit -m "feat: add AiChatBar component with textarea input"
```

---

## Task 6: Integrate Chat Bar into Document Detail Page

**Files:**
- Modify: `frontend/app/(app)/documents/[id]/page.tsx`

**Step 1: Update the page to use AiChatBar**

Replace the current inline chat stub with the new component.

In `frontend/app/(app)/documents/[id]/page.tsx`, make these changes:

1. Add import at top:
```tsx
import { AiChatBar } from '@/components/documents/ai-chat-bar'
```

2. Remove the `Input` import (no longer needed)

3. Replace the entire `{/* AI Chat Bar - inline at bottom */}` section (lines 58-72) with:
```tsx
      {/* AI Chat Bar - fixed at bottom */}
      <div className="fixed bottom-0 inset-x-0 p-4 pointer-events-none z-50">
        <div className="mx-auto max-w-2xl pointer-events-auto">
          <AiChatBar documentId={document.id} />
        </div>
      </div>

      {/* Spacer for fixed chat bar */}
      <div className="h-24 shrink-0" />
```

**Step 2: Verify the page renders**

Run:
```bash
cd frontend && npm run dev
```

Navigate to http://localhost:3000/documents/[any-id] - should see the new chat bar fixed at bottom.

**Step 3: Commit**

```bash
git add frontend/app/\(app\)/documents/\[id\]/page.tsx
git commit -m "feat: integrate AiChatBar into document detail page"
```

---

## Task 7: Verify Auth Integration

**Files:** None (verification only)

Auth is already integrated into Tasks 2 and 3:
- `agent-api.ts` accepts `authToken` parameter and sends `Authorization: Bearer` header
- `use-agent-stream.ts` uses `useAuth()` from Clerk to get token before streaming

**Step 1: Verify the integration compiles**

Run:
```bash
cd frontend && npm run build
```

Expected: No TypeScript errors related to auth.

**Step 2: Check auth flow in code**

Verify in `frontend/hooks/use-agent-stream.ts`:
- `useAuth()` is imported from `@clerk/nextjs`
- `getToken()` is called before `streamAgentCorrection()`
- Token is passed as 4th argument to `streamAgentCorrection()`

Verify in `frontend/lib/agent-api.ts`:
- `authToken: string` is the 4th parameter
- `Authorization: Bearer ${authToken}` header is set

No commit needed - auth was integrated in Tasks 2-3.

---

## Task 8: Test End-to-End Flow

**Files:** None (manual testing)

**Step 1: Start dev servers**

Terminal 1 (backend):
```bash
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
```

Terminal 2 (frontend):
```bash
cd frontend && npm run dev
```

**Step 2: Test the flow**

1. Navigate to http://localhost:3000/documents
2. Upload a document (or use existing one with extraction)
3. Click into document detail page
4. Type a correction in the chat bar: "Change the vendor name to Acme Corp"
5. Press Enter

**Expected behavior:**
- Activity panel expands showing "Processing..."
- Tool events appear with green checkmarks
- Text responses appear with bullet points
- Panel shows "Update complete" when done
- Panel auto-collapses after 3 seconds
- Clicking the panel header re-expands it
- Clicking × dismisses the panel

**Step 3: Verify error handling**

1. Stop the backend server
2. Try submitting a message
3. Should see error state in panel

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found in e2e testing"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Install textarea | `components/ui/textarea.tsx` |
| 2 | Agent API helper | `lib/agent-api.ts` |
| 3 | useAgentStream hook | `hooks/use-agent-stream.ts` |
| 4 | Activity panel | `components/documents/ai-activity-panel.tsx` |
| 5 | Chat bar | `components/documents/ai-chat-bar.tsx` |
| 6 | Page integration | `app/(app)/documents/[id]/page.tsx` |
| 7 | Auth header | `lib/agent-api.ts`, `hooks/use-agent-stream.ts` |
| 8 | E2E testing | Manual |
