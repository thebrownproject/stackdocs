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
