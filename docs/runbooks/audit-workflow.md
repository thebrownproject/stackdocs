# Accuracy Audit Workflow

Use this flow for the free audit GTM motion.

1. Receive a prospect submission from Tally.
2. Create a prospect agent in Trestle for the document type.
3. Upload 10 to 30 sample files with an expected-output CSV.
4. Train the agent.
5. Copy the generated audit link.
6. Email the prospect with the link and propose a paid pilot if the verdict is pilot-ready.

## Tally Setup

TODO: Add the production Tally URL.

Required fields:

- Name
- Company
- Work email
- Document type description
- Sample documents, multi-file upload
- Expected outputs CSV
- Notes

## CSV Format

The first column must be `filename`. Every other column becomes a target field.

```csv
filename,vendor,total,issued_date
invoice-001.pdf,Acme Corp,1250.50,2026-04-15
invoice-002.pdf,Globex,99.99,2026-04-20
```
