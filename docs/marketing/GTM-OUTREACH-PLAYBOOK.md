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
