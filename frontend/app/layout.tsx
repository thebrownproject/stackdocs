import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { shadcn } from '@clerk/themes'
import NextTopLoader from 'nextjs-toploader'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const inter = Inter({
  variable: '--font-inter-variable',
  subsets: ['latin'],
})

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-berkeley-mono',
  weight: '400',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Stackdocs',
  description: 'Document data extraction with AI',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: shadcn,
        elements: {
          userButtonPopoverRootBox: {
            pointerEvents: 'auto',
          },
        },
      }}
      signInFallbackRedirectUrl="/documents"
      signUpFallbackRedirectUrl="/documents"
    >
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.variable} ${ibmPlexMono.variable} antialiased`}>
          <NextTopLoader
            color="var(--primary)"
            height={2}
            showSpinner={false}
            shadow={false}
            zIndex={9999}
          />
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
