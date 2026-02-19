// frontend/components/agent/card/flow-error-boundary.tsx
'use client'

import { Component, type ReactNode } from 'react'
import * as Icons from '@/components/icons'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * FIX #11: Error boundary to catch crashes in flow step components.
 * Without this, a broken step would crash the entire agent card.
 */
export class FlowErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <Icons.X className="size-5 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium">Something went wrong</p>
            <p className="text-xs text-muted-foreground mt-1">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
