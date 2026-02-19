import Link from 'next/link'
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
} from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Stackdocs</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Document data extraction with AI
        </p>
      </div>

      <div className="flex gap-4">
        <SignedIn>
          <Button asChild>
            <Link href="/documents">Go to Documents</Link>
          </Button>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <Button variant="outline">Sign In</Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button>Get Started</Button>
          </SignUpButton>
        </SignedOut>
      </div>
    </div>
  )
}
