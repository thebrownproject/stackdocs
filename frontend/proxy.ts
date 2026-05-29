import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import type { NextRequest, NextFetchEvent } from 'next/server'
import { assertDemoModeSafe, isDemoMode } from './lib/demo-mode'

assertDemoModeSafe()

const isPublicRoute = createRouteMatcher([
  '/',
  '/pricing',
  '/about',
  '/contact',
  '/api/webhooks/clerk',
  '/api/webhooks/stripe',
  '/audit(.*)',
  // Embeddable inference endpoint — authenticated by agent API key, not Clerk.
  '/api/extract',
])

export function proxy(req: NextRequest, event: NextFetchEvent) {
  return clerkMiddleware(async (auth, request) => {
    if (!isPublicRoute(request) && !isDemoMode) {
      await auth.protect()
    }
  })(req, event)
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
