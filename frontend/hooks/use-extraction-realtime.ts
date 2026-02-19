'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

export interface ExtractionUpdate {
  extracted_fields: Record<string, unknown>
  confidence_scores: Record<string, number>
}

interface UseExtractionRealtimeOptions {
  documentId: string
  onUpdate: (extraction: ExtractionUpdate) => void
}

export function useExtractionRealtime({
  documentId,
  onUpdate,
}: UseExtractionRealtimeOptions): { status: RealtimeStatus } {
  const { getToken } = useAuth()
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const channelRef = useRef<RealtimeChannel | null>(null)
  const onUpdateRef = useRef(onUpdate)

  // Keep onUpdate ref current to avoid stale closures
  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    let mounted = true
    let supabaseClient: ReturnType<typeof createClerkSupabaseClient> | null = null
    let refreshInterval: NodeJS.Timeout | null = null

    const setupRealtime = async () => {
      const token = await getToken()

      // Don't continue if unmounted during token fetch
      if (!mounted) return

      supabaseClient = createClerkSupabaseClient(() => getToken())

      if (token) {
        supabaseClient.realtime.setAuth(token)
      }

      const channel = supabaseClient
        .channel(`extraction:${documentId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'extractions',
            filter: `document_id=eq.${documentId}`,
          },
          (payload) => {
            // DEBUG: Log all incoming realtime events
            console.log('[Realtime Debug] Received UPDATE event:', {
              eventType: payload.eventType,
              table: payload.table,
              hasNew: !!payload.new,
              status: (payload.new as Record<string, unknown>)?.status,
              fieldCount: Object.keys((payload.new as Record<string, unknown>)?.extracted_fields || {}).length,
            })

            if (!mounted) return

            const newData = payload.new
            if (!newData || typeof newData !== 'object') {
              console.warn('[Realtime Debug] Invalid payload, skipping')
              return
            }

            const extracted_fields = (newData as Record<string, unknown>).extracted_fields as Record<string, unknown> | undefined
            const confidence_scores = (newData as Record<string, unknown>).confidence_scores as Record<string, number> | undefined

            console.log('[Realtime Debug] Calling onUpdate with fields:', Object.keys(extracted_fields || {}))
            onUpdateRef.current({
              extracted_fields: extracted_fields || {},
              confidence_scores: confidence_scores || {},
            })
          }
        )
        .subscribe((status, err) => {
          if (!mounted) return

          // DEBUG: Log all subscription state changes
          console.log(`[Realtime Debug] Channel status: ${status}`, err ? `Error: ${err.message}` : '')

          if (status === 'SUBSCRIBED') {
            setStatus('connected')
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`[Realtime Debug] Channel failed: ${status}`, err)
            setStatus('disconnected')
          }
        })

      if (!mounted) {
        channel.unsubscribe()
        return
      }

      channelRef.current = channel

      // Refresh auth every 50 seconds (before Clerk's 60s expiry)
      refreshInterval = setInterval(async () => {
        if (!mounted) return
        try {
          const newToken = await getToken()
          if (newToken && supabaseClient) {
            supabaseClient.realtime.setAuth(newToken)
            console.log('[Realtime Debug] Token refreshed successfully')
          } else {
            console.warn('[Realtime Debug] Token refresh failed - no token returned')
          }
        } catch (err) {
          console.error('[Realtime Debug] Token refresh error:', err)
        }
      }, 50000)
    }

    setupRealtime()

    return () => {
      mounted = false
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
    }
  }, [documentId, getToken])

  return { status }
}
