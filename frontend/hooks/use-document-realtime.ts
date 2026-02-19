'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@clerk/nextjs'
import { createClerkSupabaseClient } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

export type DocumentStatus = 'uploading' | 'processing' | 'ocr_complete' | 'failed'

export interface DocumentUpdate {
  status: DocumentStatus
  display_name: string | null
  tags: string[] | null
  summary: string | null
}

interface UseDocumentRealtimeOptions {
  documentId: string | null
  onUpdate: (update: DocumentUpdate) => void
  enabled?: boolean
}

export function useDocumentRealtime({
  documentId,
  onUpdate,
  enabled = true,
}: UseDocumentRealtimeOptions): { status: RealtimeStatus } {
  const { getToken } = useAuth()
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const channelRef = useRef<RealtimeChannel | null>(null)
  const onUpdateRef = useRef(onUpdate)

  // Keep onUpdate ref current to avoid stale closures
  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    // Skip if no documentId or disabled
    if (!documentId || !enabled) {
      setStatus('disconnected')
      return
    }

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
        .channel(`document:${documentId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'documents',
            filter: `id=eq.${documentId}`,
          },
          (payload) => {
            if (!mounted) return

            const newData = payload.new
            if (!newData || typeof newData !== 'object') return

            const record = newData as Record<string, unknown>
            onUpdateRef.current({
              status: record.status as DocumentStatus,
              display_name: record.display_name as string | null,
              tags: record.tags as string[] | null,
              summary: record.summary as string | null,
            })
          }
        )
        .subscribe((subscribeStatus, err) => {
          if (!mounted) return

          if (subscribeStatus === 'SUBSCRIBED') {
            setStatus('connected')
          } else if (
            subscribeStatus === 'CLOSED' ||
            subscribeStatus === 'CHANNEL_ERROR' ||
            subscribeStatus === 'TIMED_OUT'
          ) {
            console.error(`[Realtime] Document channel failed: ${subscribeStatus}`, err)
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
          }
        } catch (err) {
          console.error('[Realtime] Token refresh error:', err)
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
  }, [documentId, enabled, getToken])

  return { status }
}
