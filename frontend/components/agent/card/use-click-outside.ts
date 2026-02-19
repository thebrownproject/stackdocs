// frontend/components/agent/card/use-click-outside.ts
'use client'

import { useEffect, useRef, type RefObject } from 'react'

/**
 * Hook to detect clicks outside of a referenced element and Escape key presses.
 * Used to collapse the agent card when clicking elsewhere or pressing Escape.
 *
 * FIX #4: Uses useRef pattern for handler to prevent stale closures.
 * The handler can be passed without useCallback - the ref ensures
 * the latest handler is always called.
 *
 * FIX #10: Also listens for Escape key to dismiss.
 *
 * @param handler - Callback when click outside or Escape is detected
 * @param enabled - Whether the listener is active (default: true)
 * @returns Ref to attach to the element
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const ref = useClickOutside(() => setOpen(false), isOpen)
 *   return <div ref={ref}>Content</div>
 * }
 * ```
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  handler: () => void,
  enabled: boolean = true
): RefObject<T | null> {
  const ref = useRef<T>(null)
  // FIX #4: Store handler in ref to avoid stale closures
  const handlerRef = useRef(handler)

  // Update handler ref on each render (no deps needed)
  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (!enabled) return

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node

      // Ignore clicks on the element or its children
      if (ref.current && !ref.current.contains(target)) {
        // Ignore clicks on modals/dialogs (they have their own click handling)
        const isInModal = (target as HTMLElement).closest?.(
          '[role="dialog"], [role="alertdialog"], [data-radix-portal]'
        )
        if (!isInModal) {
          handlerRef.current()
        }
      }
    }

    // FIX #10: Handle Escape key to dismiss
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        handlerRef.current()
      }
    }

    // Use mousedown for faster response (before click completes)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [enabled]) // FIX #4: Only `enabled` in deps - handler accessed via ref

  return ref
}
