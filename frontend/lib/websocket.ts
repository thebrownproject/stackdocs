import type {
  BrowserToSpriteMessage,
  SpriteToBrowserMessage,
  MessageType,
  SystemMessage,
} from '@/types/ws-protocol'
import { parseMessage, isSystemMessage } from '@/types/ws-protocol'

// =============================================================================
// Types
// =============================================================================

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'sprite_waking'
  | 'connected'
  | 'error'

export type MessageHandler = (message: SpriteToBrowserMessage) => void

export interface WebSocketManagerOptions {
  stackId: string
  getToken: () => Promise<string | null>
  onStatusChange: (status: ConnectionStatus, error?: string) => void
  onMessage: (message: SpriteToBrowserMessage) => void
  url?: string
}

// =============================================================================
// Constants
// =============================================================================

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'wss://ws.stackdocs.io'
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000
const BACKOFF_MULTIPLIER = 2

// =============================================================================
// WebSocket Connection Manager
// =============================================================================

export class WebSocketManager {
  private ws: WebSocket | null = null
  private options: WebSocketManagerOptions
  private backoffMs = INITIAL_BACKOFF_MS
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false
  private handlers = new Map<MessageType, Set<MessageHandler>>()
  private _status: ConnectionStatus = 'disconnected'

  constructor(options: WebSocketManagerOptions) {
    this.options = options
  }

  get status(): ConnectionStatus {
    return this._status
  }

  /** Connect to the Bridge WebSocket. */
  connect(): void {
    if (this.ws) return
    this.intentionalClose = false
    this.setStatus('connecting')

    const url = `${this.options.url ?? WS_BASE_URL}/ws/${this.options.stackId}`
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.authenticate()
    }

    this.ws.onmessage = (event) => {
      this.handleRawMessage(event.data as string)
    }

    this.ws.onclose = () => {
      this.ws = null
      if (!this.intentionalClose) {
        this.setStatus('disconnected')
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      // onclose fires after onerror, so reconnect is handled there
    }
  }

  /** Disconnect and stop reconnection attempts. */
  disconnect(): void {
    this.intentionalClose = true
    this.clearReconnectTimer()
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    this.setStatus('disconnected')
  }

  /** Send a typed protocol message to the Sprite. */
  send(message: Omit<BrowserToSpriteMessage, 'id' | 'timestamp'>): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false

    const full = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    this.ws.send(JSON.stringify(full))
    return true
  }

  /** Register a handler for a specific message type. */
  on(type: MessageType, handler: MessageHandler): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler)

    return () => {
      set!.delete(handler)
      if (set!.size === 0) this.handlers.delete(type)
    }
  }

  /** Remove all handlers and disconnect. */
  destroy(): void {
    this.disconnect()
    this.handlers.clear()
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async authenticate(): Promise<void> {
    this.setStatus('authenticating')
    const token = await this.options.getToken()
    if (!token) {
      this.setStatus('error', 'Failed to get auth token')
      this.ws?.close(4001, 'No auth token')
      return
    }

    const authMsg = {
      type: 'auth' as const,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      payload: { token },
    }
    this.ws?.send(JSON.stringify(authMsg))
  }

  private handleRawMessage(data: string): void {
    const message = parseMessage(data)
    if (!message) return

    // Track connection status from system messages
    if (isSystemMessage(message)) {
      this.handleSystemMessage(message)
    }

    // Dispatch to type-specific handlers
    const handlers = this.handlers.get(message.type as MessageType)
    if (handlers) {
      for (const handler of handlers) {
        handler(message as SpriteToBrowserMessage)
      }
    }

    // Always call the global onMessage callback
    this.options.onMessage(message as SpriteToBrowserMessage)
  }

  private handleSystemMessage(msg: SystemMessage): void {
    switch (msg.payload.event) {
      case 'connected':
        // Auth succeeded, waiting for Sprite
        break
      case 'sprite_waking':
        this.setStatus('sprite_waking')
        break
      case 'sprite_ready':
        this.setStatus('connected')
        this.backoffMs = INITIAL_BACKOFF_MS
        break
      case 'error':
        // Only transition to error state if we're not already connected.
        // Non-fatal errors (e.g. Sprite rejecting keepalive pings) shouldn't
        // brick an active connection.
        if (this._status !== 'connected') {
          this.setStatus('error', msg.payload.message)
        }
        break
    }
  }

  private setStatus(status: ConnectionStatus, error?: string): void {
    this._status = status
    this.options.onStatusChange(status, error)
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer()
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, this.backoffMs)

    this.backoffMs = Math.min(this.backoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
