# Trestle GTM Outreach Playbook

**Status:** v1.0 — 2026-05-29
**For:** a founder running this **around a full-time job** (~3–4 hrs/week for GTM).
**Companion specs:**
- `docs/specs/TRESTLE-ARCHITECTURE.md` — what the product is.
- `docs/superpowers/specs/2026-05-28-trestle-gtm-tier-1-and-2-design.md` — the
  product-side GTM build (audit links, configurable destinations, Stripe billing —
  already implemented).
- Replaces the archived `docs/archive/marketing/MARKETING-STRATEGY-stacks-era.md`
  (stale: Stacks-era freemium/PLG motion).

---

## 1. The model in one sentence

> **Done-for-you document automation for SMBs drowning in paperwork** — we set up
> extraction **processors** for each of their document types, tuned to a **measured
> accuracy**, plugged into the **systems they already use**.

This is a **forward-deployed / productized-service** motion, not self-serve SaaS.
You operate a handful of high-value accounts; the product does the extraction and
the tuning.

### Why this fits

- **Matches the product.** Trestle runs many agents per account, each tuned to one
  document type, each with its own destination adapter + custom tools. "Multiple
  processors per customer" *is* the architecture.
- **Matches a time-poor founder.** Higher ACV ($500–2k setup + $300–1,500/mo per
  processor) ⇒ you need ~5–10 **relationships**, not hundreds of signups.
- **The autoresearch loop is the scaling lever.** A one-person done-for-you motion
  normally drowns in *manual tuning*. The loop (`frontend/lib/harness/loop/`,
  driven by `npm run tune`) automates tuning to a measured number — that's what lets
  one person stand up many processors without it becoming a second full-time job.

---

## 2. Ideal Customer Profile (ICP)

Anchor verticals (deliver to others later):

1. **Construction — subcontractors / specialty trades / GCs**
2. **Property management — residential & commercial**

A good-fit customer has **all** of:

- ✅ **A system data flows into** (a destination): accounting (QuickBooks, Sage,
  Foundation) and/or ops software (Procore, Buildertrend, AppFolio, Buildium, Yardi).
- ✅ **Someone hand-keying today** (office manager / AP clerk / admin) — a
  quantifiable cost you displace.
- ✅ **Recurring multi-doc volume** — hundreds of docs/month across several types.
- ✅ **Existing labelled history** — their past manual entries *are* your ground
  truth, which is what lets you produce a **measured** accuracy audit.
- ✅ **SMB scale** (≈$5M–$100M revenue / 11–200 staff) — big enough to pay, small
  enough to skip procurement.

### Disqualify fast (protect your scarce hours)

- ❌ No system/destination — output has nowhere to land.
- ❌ < ~100 docs/month — setup won't pay back.
- ❌ Nobody currently doing manual entry — no cost to displace, no urgency.
- ❌ Demands SOC2 / on-prem / SSO on day one (out of scope per the GTM spec).
- ❌ Total chaos, no labelled history — can't produce an accuracy number.

---

## 3. The wedge: a free, *measured* accuracy audit

Your differentiator is **proof, not a pitch**: a measured held-out accuracy number
on the prospect's *own* documents. The audit is asynchronous — it sells while you're
at your day job.

- **Demo ≠ Audit.** A self-serve "upload and see output" demo can only show extracted
  values (no ground truth ⇒ no accuracy) and looks like every competitor's free trial.
  The **audit** uses the prospect's labelled history to produce the *measured number*
  that nobody else shows. Lead with the audit.
- **Don't build self-serve intake yet.** Your bottleneck is getting the right people
  to say yes, not time-per-audit (the funnel needs only ~10–15 audits to land pilots).
  Use the existing Tally-form intake → run it manually → send the token-gated audit
  link (`app/audit/[token]`). Automate intake only once inbound exceeds ~10/week.

### Audit fulfillment (per prospect, ~30–60 min)

1. Prospect sends 5–10 sample docs + their past entries for those docs (the labels) +
   which system they use. (Tally form; redacted is fine.)
2. Create an agent, upload samples, run **train + `npm run tune`** to a measured
   held-out accuracy.
3. Generate an audit link; send with a one-line note (see §6, step 4).

---

## 4. Positioning & messaging principle

**Niche the message, broaden the delivery.**

- **Deliver broad:** stand up several processors per customer (value + stickiness).
- **Message narrow:** lead every outreach with ONE vivid, painful document
  ("still hand-keying *progress claims* / *rent-roll invoices*?"). A specific pain
  converts far better than "we do all your documents." Expand to the rest once you're
  in the door (land-and-expand).

**Document hooks per vertical:**

| Vertical | Lead-with document (the spear) | Then expand to |
|---|---|---|
| Construction subs/GCs | Subcontractor invoices **or** progress claims | lien waivers, COIs, timesheets, POs |
| Property management | AP invoices into AppFolio/Buildium | leases, applications, COIs, maintenance bills |

---

## 5. LinkedIn profile (do this BEFORE any outreach)

Prospects check your profile within seconds of a request. Fix three things:

- **Headline (outcome, not title):**
  *"I help construction & property-management teams kill manual data entry from their
  paperwork — invoices, progress claims, leases, COIs — with a measured accuracy
  guarantee."*
- **Featured:** pin one **anonymised example audit report** so the proof is visible
  without asking.
- **About (3 short blocks):** the pain (hours lost re-keying docs into your
  accounting/PM system) → the offer (free accuracy audit on your own docs) → CTA
  (link to the Tally intake).

---

## 6. The outreach sequence (no hard sell)

Funnel math (sets expectations): ~400–600 *targeted* connection requests (≈10/day) →
~35% accept → ~15% reply → ~10–15 send docs → **3–5 pilots**, over ~8–10 weeks.

1. **Connection request (no pitch).**
   - *Construction:* "Hi [Name] — I work with [trade/construction] firms on automating
     the paperwork side (AP invoices, progress claims, COIs). Always good to connect
     with people running ops in the trade."
   - *Property mgmt:* "Hi [Name] — I help property-management teams cut the manual data
     entry around invoices, leases and COIs. Keen to connect with folks running PM ops."
2. **After they accept, wait. Don't pitch.** Like/comment on one of their posts; be a
   face in their feed for a few days.
3. **Soft offer (day 3–5):**
   "Quick one [Name] — I'm running free accuracy audits this month for a few
   [construction firms / PM teams]. Send me 5–10 sample docs you currently hand-key
   ([subcontractor invoices, progress claims / invoices, leases] — redacted is fine)
   plus how you enter them today, and I'll send back a report showing exactly which
   fields we'd auto-extract, at what accuracy, and where it'd land in
   [QuickBooks/Procore / AppFolio/Buildium]. No cost, no account, no pitch — just
   useful to see. Worth a look?"
4. **They send docs → the audit link does the selling.**
   "Here's your report: [link]. We measured **[X]%** on the fields that matter. Happy
   to set you up on a pilot at [$/mo] if it's useful."

---

## 7. Prospect sourcing (LinkedIn / Sales Navigator filters)

Build a sheet (name, title, company, system, a personal hook). Filters:

- **Industry:** Construction / Real Estate.
- **Company size:** 11–200.
- **Geography:** one metro you can speak to (warm > broad).
- **Titles:** Owner, Office Manager, Controller, AP/Accounting Manager, Operations
  Manager, Director of Operations, Project Coordinator (construction); add Principal /
  Property Manager (PM, smaller firms).
- **Company keywords:** trades (electrical, mechanical, plumbing, concrete, drywall) /
  "property management", "residential", "commercial".
- **Buying signals:** hiring an AP clerk/admin; posts about being swamped; recently
  adopted Procore/AppFolio (process exists, automation gap fresh).

---

## 8. Pricing & packaging (multi-processor)

- **Audit:** free (the wedge).
- **Land with one processor** (the most painful doc): **$500–$1,000 one-time setup**
  + **$300–$750/mo** for that document type.
- **Automation package (expand):** **$1,500 setup** + **$750–$1,500/mo** for up to N
  document types and X docs/month; per-doc overage above the cap (Stripe metering is
  already wired — see GTM spec §5/§9).
- **Land-and-expand:** every additional processor is new MRR with near-zero new sales
  effort because the relationship and the destination wiring already exist.

---

## 9. Weekly cadence (~3.5 hrs, around a job)

| When | Time | Do |
|---|---|---|
| Sun (batch) | 90 min | Write 1 post; source 50 prospects into the sheet |
| Mon–Fri | 15 min/day | 10 personalised connection requests; reply to engagers; run any audits that landed |
| Per audit | 30–60 min | Train + tune the agent, send the report link |
| Evenings/lunch | as needed | The rare pilot call |

---

## 10. Content (1 post/week, batched — your product *is* the content)

- **Teardown:** "I ran 40 real subcontractor invoices through AI extraction — here's
  exactly where it broke, and how I got it to 98%."
- **Before/after:** hours/week of hand-keying → minutes; the accuracy climb.
- **Myth-bust:** "AI extraction isn't accurate enough for our books" → show the
  measured number + the human-review-queue safety net for low-confidence items.

You're not posting for reach — you're posting so that when a prospect checks your
profile, the feed confirms you're the real thing.

---

## 11. 30 / 60 / 90

- **Days 1–30:** Reposition profile; build the Tally intake + one anonymised example
  audit; source 150 prospects; start 10 requests/day; ship 2 posts. Goal: **first 3
  audits delivered.**
- **Days 31–60:** Keep the cadence; convert audits → **first 1–2 paid pilots**;
  publish a lightweight case study (hours/$$ saved).
- **Days 61–90:** Expand pilots to a 2nd/3rd processor (land-and-expand); use the
  first case study as social proof in outreach. Goal: **3–5 paying accounts.**

---

## 12. Metrics to watch

- Connection accept rate (target ≥30%) — if low, fix the profile/request copy.
- Reply rate to the soft offer (≥15%) — if low, fix the hook/document specificity.
- Audits → pilot conversion (≥30%) — if low, the accuracy number or pricing is off.
- Time-to-first-value per customer (setup speed) — the autoresearch loop should keep
  this low; if a processor takes too long to tune, that's a product signal.
- MRR per account & expansion rate (processors per account over time).

---

## 13. Tally intake form (copy/paste)

Keep it short — every field is friction. Title: **"Free document accuracy audit."**
Subtitle: *"Send a few sample documents you currently key by hand. I'll send back a
report showing exactly which fields we'd auto-extract and at what accuracy. No
account, no cost."*

| Field | Type | Notes |
|---|---|---|
| Name | short text | required |
| Company | short text | required |
| Work email | email | required |
| What documents do you want audited? | short text | e.g. "subcontractor invoices + progress claims" |
| Which system do you key them into today? | dropdown + "other" | QuickBooks, Sage, Foundation, Procore, Buildertrend, AppFolio, Buildium, Yardi, Xero, Other |
| Roughly how many of these per month? | dropdown | <50 / 50–200 / 200–1,000 / 1,000+ (a qualifier) |
| Who keys them today, and roughly how long does it take? | long text | surfaces the ROI in their words |
| Upload 5–10 sample documents (redacted is fine) | file upload | required |
| Can you also paste/attach how those were entered (the correct values)? | long text / file | optional but ← this is the ground truth that lets you measure accuracy |

The last row is the important one: their past correct entries are the labels. If they
can't provide any, you label a few yourself from the documents before tuning.

---

## 14. The audit deliverable (what you send back)

The report page already renders the numbers (`app/audit/[token]`,
`components/audit/audit-report-view.tsx`): overall accuracy, per-field accuracy, docs
tested, and an interactive review-rate slider. Your job is the **framing around it**.

**Cover note (the message that carries the link):**

> Hi [Name] — here's your accuracy audit: **[link]**
>
> Quick read: across the [N] [document type] you sent, we'd auto-extract
> **[X]%** of fields correctly with zero human touch. The [2–3 weakest fields]
> are the ones worth a human glance — the slider on the report lets you set the
> confidence cut-off and see exactly what share would route to review vs. straight
> through.
>
> In practice that means the ~[hours]/week your team spends keying these drops to a
> quick review of the uncertain ones, landing straight in [their system]. If it's
> useful, I can stand this up as a live processor on a pilot — [setup] + [$/mo].
> Happy to walk through it whenever.

**ROI math to include (use their own numbers from the form):**
`docs/month × minutes/doc ÷ 60 = hours/month saved`, then `× loaded hourly cost`.
Even at a conservative rate this is almost always a multiple of your monthly price —
state it plainly.

---

## 15. Objection handling

| Objection | Response |
|---|---|
| "We already use Hubdoc/Dext." | "Those nail standard receipt headers. They don't do line items or your non-standard docs — and Xero has said they're not building line-item extraction. Your audit shows the accuracy on exactly the fields they miss." |
| "How do I know it won't make mistakes?" | "You get a measured accuracy number up front, not a promise — and anything below your confidence threshold routes to a human review queue instead of going through silently. You decide the threshold." |
| "Is my data safe?" | "Documents are processed per-extraction and not used to train any shared model; your tuned agent is yours. Send redacted samples for the audit if you prefer." |
| "We don't have time to set this up." | "That's the point — it's done-for-you. You send samples once; I stand up the processor and wire it into [system]. Your team's only ongoing task is reviewing the low-confidence tail." |
| "It's too expensive." | "Compare it to the [hours]/week you're paying someone to key these — the audit's ROI math shows it pays back in [weeks]. And we can start with just your most painful document." |
| "Can it handle our weird format?" | "That's the whole design — the agent is tuned to *your* documents, not a generic template. The audit is run on your actual formats, so the number you see is real." |

---

## 16. Vertical briefs

### 16a. Construction — subcontractors / specialty trades / GCs

- **Who feels the pain:** office manager / AP clerk / project coordinator keying
  paperwork into accounting (QuickBooks, Sage, Foundation) and/or PM software
  (Procore, Buildertrend).
- **The spear document:** subcontractor invoices **or** progress claims (line-item
  heavy, every sub formats differently → templates fail).
- **Expand to:** lien waivers, certificates of insurance (COIs), material receipts,
  POs, timesheets.
- **Why now:** thin admin teams, rising volume, and Procore/Buildertrend adoption
  means the *destination* exists but the data-entry gap is wide open.
- **Language that lands:** "still hand-keying sub invoices and progress claims?",
  "lien waiver and COI tracking eating your admin time?", "get the line items into
  [system] without typing them."

### 16b. Property management (residential & commercial)

- **Who feels the pain:** AP/accounting manager and property managers keying into
  AppFolio / Buildium / Yardi.
- **The spear document:** AP invoices (utilities, vendors, maintenance) into the PM
  system.
- **Expand to:** leases (abstraction), rental applications, COIs, maintenance bills,
  owner statements.
- **Why now:** PM firms run on tight margins and high doc volume across many
  properties; the systems are in place but invoice/lease entry is still manual.
- **Language that lands:** "invoices piling up outside AppFolio/Buildium?", "lease
  abstraction still done by hand?", "COIs from every vendor in a different format?"

---

## 17. First-post outlines (LinkedIn, ~1/week)

**Post A — the teardown (best first post):**
1. Hook: "I ran 40 real subcontractor invoices through AI extraction. Here's where
   it broke."
2. 3 concrete failure modes (merged line items, handwritten totals, weird date
   formats).
3. What fixed each (a tuned rule, a verification tool, a confidence threshold).
4. The result: measured accuracy climbed from X% → Y%.
5. Soft CTA: "If you key these by hand, I'll run a free audit on yours — comment
   'audit' or DM me."

**Post B — the ROI reframe:**
- One customer/example: hours/week of keying → minutes of review; the $ math.
- Point: the cost isn't the software, it's the salary hours you're already spending.

**Post C — the trust/safety angle:**
- "AI extraction isn't accurate enough for our books" is half right.
- Explain the measured-accuracy + human-review-queue design: nothing uncertain goes
  through silently. That's what makes it safe for finance docs.

---

## 18. Pilot onboarding checklist (forward-deployed setup)

Once a prospect says yes:

1. Create their agent(s) — one per document type (start with the spear).
2. Collect 10–30 labelled samples per processor (their history = labels).
3. Run train + `npm run tune` to a measured held-out accuracy; confirm it clears the
   gate (per-field floors + review-rate ceiling).
4. Configure the destination (Google Sheet / email / webhook) into their system.
5. Set the confidence threshold with them (review-rate vs. straight-through trade-off).
6. Send a handful of live docs; confirm they land correctly + the review queue works.
7. Turn on billing (Stripe), agree the cap/overage, and schedule a 2-week check-in to
   expand to the next document type.
