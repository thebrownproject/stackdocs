# Example Accuracy Audit (anonymised), for the LinkedIn "Featured" section

This is a worked example of the report a prospect receives. Use it two ways:

1. **As the Featured asset on your LinkedIn profile.** Run a real audit (live app,
   `app/audit/[token]`), screenshot it, blur any client-identifying detail, and pin
   the image. This markdown is the script for what that screenshot should contain.
2. **As the reference for what a "good" audit looks like** before you send one.

The numbers below mirror the in-app demo audit (construction AP invoices + progress
claims) so the example matches what the live report renders. Swap in real figures
once you have them.

---

## Stackdocs accuracy audit
**Prepared for:** [Company], commercial construction
**Documents:** Subcontractor invoices + progress claims
**Date:** [date]
**Verdict:** Ready to deploy

### Headline numbers

| Metric | Result |
|---|---|
| Held-out accuracy | **95.0%** |
| Documents tested | 12 (held out, never seen during tuning) |
| Estimated review rate | **17%** at a 0.70 confidence threshold |

> "Held-out" means the agent was tuned on one set of your documents and then scored
> on a *different* set it had never seen, so the number reflects real performance on
> new documents, not memorised answers.

### Per-field accuracy

| Field | Type | Passed | Accuracy |
|---|---|---|---|
| vendor | exact | 12/12 | 100% |
| invoice_number | exact | 11/12 | 91.7% |
| issued_date | date | 12/12 | 100% |
| total | numeric | 12/12 | 100% |
| payment_terms | fuzzy | 10/12 | 83.3% |

### What this means for you

- The fields that drive your books (vendor, total, date) come through at or near
  **100%**, so they can flow straight into [QuickBooks / Procore] with no human touch.
- `invoice_number` and `payment_terms` are the two worth a quick human glance. With
  the confidence threshold at 0.70, about **17%** of documents route to a review
  queue and the rest go straight through.
- In practice, the roughly **[X] hours/week** your team spends keying these drops to
  a short review of only the uncertain ones.

### Representative sample (one of the 12)

**acme-invoice-1048.pdf** (100% of fields correct)

| Field | Expected | Extracted | Result |
|---|---|---|---|
| vendor | Acme Supplies | Acme Supplies | pass |
| invoice_number | INV-1048 | INV-1048 | pass |
| issued_date | 2026-05-12 | 12 May 2026 | pass |
| total | $4,820.00 | 4820 | pass |
| payment_terms | 14 days from invoice date | payment due within 14 days | pass |

(The scorers normalise formats, so "12 May 2026" matches "2026-05-12" and "4820"
matches "$4,820.00". You are scored on the value being correct, not the formatting.)

---

## How to produce the real version

1. Get 8 to 12 sample documents from a prospect (or use your own labelled set).
2. Create an agent, upload the samples, run `npm run tune` to a measured held-out
   accuracy (see GTM playbook §18).
3. Generate an audit link from the completed eval run (audit links panel in the
   agent console). Set an expiry and the prospect's name/company.
4. Open the link, screenshot the report, blur client-identifying fields, and pin it
   to your LinkedIn Featured section.

> Tip for the Featured asset: a real screenshot of the live report builds far more
> trust than a mockup. The interactive review-rate slider on the live page is the
> part prospects play with the most, so capture it set to a sensible threshold.
