# Tally "Free Accuracy Audit" Form, Setup Guide

The intake form is the front door of the GTM motion: a prospect sends a few
documents, you run an audit, you send back a measured-accuracy report. The code
side is already wired (`NEXT_PUBLIC_AUDIT_INTAKE_URL`); this guide is the part that
needs a human with a Tally login.

## Why Tally (vs. building intake in-app)

Per the GTM spec, intake is deliberately a no-code external form for v1: zero new
code to maintain, ships today, and defers in-app intake until inbound volume proves
it out. Don't build a self-serve upload page yet.

## Step 1: Create the form

1. Sign in at <https://tally.so> (free tier is fine).
2. New form. Title: **"Free document accuracy audit"**.
3. Add a description block at the top:
   > Send a few documents you currently key by hand. We'll send back a report
   > showing exactly which fields we'd auto-extract and at what accuracy. No
   > account, no cost.

## Step 2: Add these fields (order matters, keep it short)

| # | Field label | Tally block type | Required | Notes |
|---|---|---|---|---|
| 1 | Name | Short answer | Yes | |
| 2 | Company | Short answer | Yes | |
| 3 | Work email | Email | Yes | |
| 4 | What documents do you want audited? | Short answer | Yes | e.g. "subcontractor invoices + progress claims" |
| 5 | Which system do you key them into today? | Dropdown | Yes | options below |
| 6 | Roughly how many of these per month? | Multiple choice | Yes | `<50` / `50-200` / `200-1,000` / `1,000+` (qualifier) |
| 7 | Who keys them today, and how long does it take? | Long answer | No | surfaces ROI in their words |
| 8 | Upload 5-10 sample documents (redacted is fine) | File upload | Yes | allow multiple; pdf/png/jpg/docx/xlsx/csv |
| 9 | Can you also share how those were entered (the correct values)? | File upload or Long answer | No | this is the ground truth that lets you measure accuracy |

**Dropdown options for #5:** QuickBooks, Sage, Foundation, Procore, Buildertrend,
AppFolio, Buildium, Yardi, Xero, Other.

> Field #9 is the important one. Their past correct entries are the labels that make
> the audit a *measured* number instead of just a demo. If they can't provide any,
> you label a few yourself from the documents before tuning.

## Step 3: Settings

- **Notifications:** email yourself on every submission (Tally > form settings >
  Notifications, send to `fraserbrown@live.com`). This is the trigger for your
  manual audit workflow.
- **File upload limits:** raise the per-file size if available (loss runs / invoices
  can be a few MB).
- **Spam:** turn on Tally's built-in captcha if you start getting junk.
- (Optional later) Connect Tally to Google Sheets / email so submissions log
  automatically.

## Step 4: Wire the URL into the site

1. In Tally: **Share > Link** copy the public URL (looks like `https://tally.so/r/XXXXXX`).
2. Set the env var (local `.env.local` and your Vercel project settings):
   ```
   NEXT_PUBLIC_AUDIT_INTAKE_URL=https://tally.so/r/XXXXXX
   ```
3. Redeploy. The landing page's "Get a free accuracy audit" buttons now link
   straight to the form. (When the var is unset, they fall back to the sign-up modal,
   so the site is never broken.)

## Step 5: Verify

- Load the landing page; click "Get a free accuracy audit" and confirm it opens the
  Tally form.
- Submit a test entry with a sample file; confirm you get the email notification and
  the file downloads.

## What happens next (your manual workflow per submission)

See GTM playbook §3 (audit fulfillment), §14 (the deliverable + cover note), and §18
(pilot onboarding). In short: create an agent, upload their samples, run
`npm run tune` to a measured accuracy, generate an audit link (`app/audit/[token]`),
and send it with the cover note.
