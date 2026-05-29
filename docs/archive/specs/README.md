# Archived Specs (read-only)

These specs predate the **Trestle** pivot and describe the retired
Stackdocs / FastAPI / Mistral-OCR / Stacks product. Kept for historical
reference only — do **not** treat them as current.

| File | What it was |
|---|---|
| `PRD-stackdocs-legacy.md` | Original Stackdocs MVP product requirements (auto/custom extraction, Stacks, CSV/JSON download). |
| `ARCHITECTURE-stackdocs-legacy.md` | Old architecture with a Python FastAPI microservice + Mistral OCR. |
| `SCHEMA-stackdocs-legacy.md` | Pre-Trestle database schema. |

## Current sources of truth

- **Architecture:** `docs/specs/TRESTLE-ARCHITECTURE.md`
- **Schema:** the migrations in `supabase/migrations/` (012+ are the Trestle line)
- **Product / why:** root `README.md` and the GTM specs under
  `docs/superpowers/specs/`
- **Go-to-market:** `docs/marketing/GTM-OUTREACH-PLAYBOOK.md`
