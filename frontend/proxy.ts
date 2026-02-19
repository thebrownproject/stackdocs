import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import type { NextRequest, NextFetchEvent } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/pricing',
  '/about',
  '/contact',
  '/api/webhooks/clerk',
])

export function proxy(req: NextRequest, event: NextFetchEvent) {
  return clerkMiddleware(async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect()
    }
  })(req, event)
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
