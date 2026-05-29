import Link from "next/link";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

// Where "Get a free accuracy audit" points. Set NEXT_PUBLIC_AUDIT_INTAKE_URL to
// your Tally intake form; falls back to the sign-up flow when unset.
const AUDIT_INTAKE_URL = process.env.NEXT_PUBLIC_AUDIT_INTAKE_URL;

function Check() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className="mt-0.5 size-4 shrink-0 text-primary"
    >
      <path
        d="M4 10.5l3.5 3.5L16 5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AuditCta({ className }: { className?: string }) {
  if (AUDIT_INTAKE_URL) {
    return (
      <Button asChild className={className}>
        <a href={AUDIT_INTAKE_URL}>Get a free accuracy audit</a>
      </Button>
    );
  }
  return (
    <SignUpButton mode="modal">
      <Button className={className}>Get a free accuracy audit</Button>
    </SignUpButton>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">Stackdocs</span>
        <nav className="flex items-center gap-2">
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </SignInButton>
            <AuditCta className="hidden sm:inline-flex" />
          </SignedOut>
          <SignedIn>
            <Button asChild size="sm">
              <Link href="/agents">Go to dashboard</Link>
            </Button>
          </SignedIn>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-20 text-center sm:pt-24">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">
          Tuned agents for your stack of documents
        </p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
          Your stack of documents,
          <br className="hidden sm:block" /> processed at high accuracy.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-light-steel)]">
          Stackdocs builds an extraction{" "}
          <span className="text-foreground">agent tuned to your documents</span>,
          processing them at high, measured accuracy and feeding the data straight
          into the systems you already use. No rules to write, no manual data entry.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <AuditCta className="w-full sm:w-auto" />
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="#how">How it works</Link>
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Built for teams drowning in paperwork. Lands in QuickBooks, Procore,
          AppFolio &amp; more.
        </p>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            From a pile of paperwork to a measured processor
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Send your samples",
                body: "Hand over a few documents you currently key by hand, plus how they were entered. That history becomes the ground truth.",
              },
              {
                step: "02",
                title: "We tune a processor",
                body: "An eval harness tunes an agent to your documents and reports a held-out accuracy number: the real score on documents it never saw.",
              },
              {
                step: "03",
                title: "Documents flow in",
                body: "High-confidence extractions land straight in your system. The uncertain tail routes to human review, so nothing wrong slips through silently.",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="rounded-xl border border-border bg-background p-6"
              >
                <div className="text-sm font-semibold text-primary">{s.step}</div>
                <h3 className="mt-3 text-lg font-medium">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Built for paperwork-heavy teams
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-[var(--color-light-steel)]">
          You already have the systems. We remove the manual data entry between the
          documents and the software.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {[
            {
              title: "Construction & trades",
              body: "Subcontractor invoices, progress claims, lien waivers, COIs and timesheets, straight into QuickBooks, Sage, Foundation, Procore or Buildertrend.",
            },
            {
              title: "Property management",
              body: "AP invoices, leases, rental applications, COIs and maintenance bills, straight into AppFolio, Buildium or Yardi.",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-border bg-card p-7"
            >
              <h3 className="text-xl font-medium">{c.title}</h3>
              <p className="mt-3 text-[var(--color-light-steel)]">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why different */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Not another generic OCR tool
          </h2>
          <div className="mx-auto mt-10 grid max-w-3xl gap-5">
            {[
              {
                title: "Line items and your formats, not just headers",
                body: "Generic capture tools read vendor, date and total. Stackdocs is tuned to your actual documents, including line items and non-standard layouts they choke on.",
              },
              {
                title: "A measured number, not a promise",
                body: "You see held-out accuracy on your own documents before you commit, and you set the confidence threshold for what goes straight through.",
              },
              {
                title: "Human review for the uncertain tail",
                body: "Anything below your threshold routes to a review queue instead of going through silently. That's what makes it safe for finance documents.",
              },
            ].map((f) => (
              <div key={f.title} className="flex gap-3">
                <Check />
                <div>
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          See your accuracy number, free.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[var(--color-light-steel)]">
          Send a few documents you key by hand. We&apos;ll send back a report showing
          exactly which fields we&apos;d auto-extract and at what accuracy. No account,
          no cost.
        </p>
        <div className="mt-8 flex justify-center">
          <AuditCta />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <span>Stackdocs · measured-accuracy document extraction</span>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="hover:text-foreground">Sign in</button>
            </SignInButton>
          </SignedOut>
        </div>
      </footer>
    </div>
  );
}
