// frontend/components/agent/card/agent-status-bar.tsx
'use client'

import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAgentStore, useAgentStatus, useAgentExpanded, type AgentStatus } from '../stores/agent-store'
import { springConfig } from '../flows/types'

interface AgentStatusBarProps {
  /** Whether a flow is active */
  hasFlow: boolean
  /** Flow-specific icon (overrides status icon when flow active) */
  flowIcon?: React.ComponentType<{ className?: string }>
  /** Whether back button should be shown */
  showBack?: boolean
  /** Handler for back button */
  onBack?: () => void
  /** Handler called when close is requested (may trigger confirmation) */
  onCloseRequest?: () => void
}

export function AgentStatusBar({
  hasFlow,
  flowIcon: FlowIcon,
  showBack,
  onBack,
  onCloseRequest,
}: AgentStatusBarProps) {
  const [message, setMessage] = useState('')
  const { status, statusText } = useAgentStatus()
  const isExpanded = useAgentExpanded()
  const toggle = useAgentStore((s) => s.toggle)

  const isDisabled = status === 'processing'
  const isIdle = !hasFlow && status === 'idle'

  // FIX #12: Use object maps for icons/classes
  const StatusIcon = hasFlow && FlowIcon ? FlowIcon : STATUS_ICONS[status]
  const statusIconClass = STATUS_ICON_CLASSES[status]

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim()
    if (!trimmed || isDisabled) return
    // TODO: Natural language processing (post-MVP)
    setMessage('')
  }, [message, isDisabled])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isDisabled) {
      e.preventDefault()
      handleSubmit()
    }
  }, [isDisabled, handleSubmit])

  const handleChevronClick = useCallback(() => {
    toggle()
  }, [toggle])

  const handleCloseClick = useCallback(() => {
    if (onCloseRequest) {
      onCloseRequest()
    }
  }, [onCloseRequest])

  return (
    <div className="flex items-center gap-2 px-3 py-3">
      {/* Back button (when in flow and showBack is true) */}
      <AnimatePresence mode="wait">
        {showBack && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={springConfig}
          >
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={onBack}
            >
              <Icons.ChevronLeft className="size-4" />
              <span className="sr-only">Go back</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status icon */}
      <motion.div
        layout
        transition={springConfig}
        className="shrink-0"
      >
        <StatusIcon
          className={cn(
            'size-4 transition-colors',
            statusIconClass,
            status === 'processing' && 'animate-spin'
          )}
        />
      </motion.div>

      {/* Input / Status text */}
      <div className="flex-1 min-w-0">
        {isIdle ? (
          <Tooltip delayDuration={500} open={!message ? undefined : false}>
            <TooltipTrigger asChild>
              <Input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={statusText}
                aria-label="AI chat input"
                disabled={isDisabled}
                className="border-none !bg-transparent shadow-none focus-visible:ring-0 !text-base text-foreground placeholder:text-muted-foreground"
              />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              sideOffset={8}
              className="text-center max-w-[280px]"
            >
              Ask your AI agent to help with documents
            </TooltipContent>
          </Tooltip>
        ) : (
          <motion.span
            key={statusText}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-muted-foreground truncate block"
          >
            {statusText}
          </motion.span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Expand/Collapse chevron */}
        <Tooltip delayDuration={500}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={handleChevronClick}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={springConfig}
              >
                <Icons.ChevronDown className="size-4" />
              </motion.div>
              <span className="sr-only">{isExpanded ? 'Collapse' : 'Expand'}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isExpanded ? 'Collapse' : 'Expand'}
          </TooltipContent>
        </Tooltip>

        {/* Close button (only when flow active) */}
        <AnimatePresence mode="wait">
          {hasFlow && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={springConfig}
            >
              <Tooltip delayDuration={500}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={handleCloseClick}
                  >
                    <Icons.X className="size-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Close</TooltipContent>
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// FIX #12: Use object maps instead of switch statements
// More concise, TypeScript will error if a status is missing
const STATUS_ICONS: Record<AgentStatus, React.ComponentType<{ className?: string }>> = {
  processing: Icons.Loader2,
  waiting: Icons.QuestionMark,
  complete: Icons.Check,
  error: Icons.X,
  idle: Icons.Stack,
}

const STATUS_ICON_CLASSES: Record<AgentStatus, string> = {
  processing: 'text-muted-foreground',
  waiting: 'text-muted-foreground',
  complete: 'text-green-500',
  error: 'text-destructive',
  idle: 'text-muted-foreground',
}
