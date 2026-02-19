# Data Flow & API Endpoints

**Purpose:** Document how data flows through the system for stacks and stack tables.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DOCUMENT LAYER                                │
│                                                                         │
│   Upload → OCR → Document Extraction → extractions.extracted_fields     │
│                         ↓                                               │
│              documents.session_id (for corrections)                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ (documents can be added to stacks)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            STACK LAYER                                  │
│                                                                         │
│   Stack ← stack_documents → Documents (many-to-many)                    │
│     │                                                                   │
│     └── Stack Tables ← stack_table_rows → (one row per document)        │
│              ↓                                                          │
│    stack_tables.session_id (for table corrections)                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow 1: Document Upload & Extraction

**Existing flow - no changes needed.**

```
1. User uploads document
2. Backend: Save to Supabase Storage
3. Backend: Create documents record (status='processing')
4. Backend: Mistral OCR → Save to ocr_results
5. Backend: Claude extraction → Save to extractions
6. Backend: Update documents.session_id with agent session
7. Frontend: Receives update via Supabase Realtime
```

---

## Data Flow 2: Create Stack

```
1. User creates stack (name, description)

   POST /api/stacks
   {
       "name": "Q1 Expenses 2024",
       "description": "Office supplies and operational costs"
   }

2. Backend: Create stacks record

   INSERT INTO stacks (user_id, name, description)
   VALUES ($user_id, 'Q1 Expenses 2024', '...')
   RETURNING id

3. Response: Stack created

   {
       "id": "stack-uuid",
       "name": "Q1 Expenses 2024",
       "status": "active"
   }
```

---

## Data Flow 3: Add Documents to Stack

```
1. User selects documents to add to stack

   POST /api/stacks/{stack_id}/documents
   {
       "document_ids": ["doc-1", "doc-2", "doc-3"]
   }

2. Backend: Create stack_documents records

   INSERT INTO stack_documents (stack_id, document_id)
   VALUES
       ($stack_id, 'doc-1'),
       ($stack_id, 'doc-2'),
       ($stack_id, 'doc-3')
   ON CONFLICT (stack_id, document_id) DO NOTHING

3. Response: Documents added

   {
       "added": 3,
       "stack_id": "stack-uuid"
   }
```

---

## Data Flow 4: Create Stack Table (Auto Mode)

```
1. User creates table in stack

   POST /api/stacks/{stack_id}/tables
   {
       "name": "Master Data",
       "mode": "auto"
   }

2. Backend: Create stack_tables record

   INSERT INTO stack_tables (stack_id, user_id, name, mode, status)
   VALUES ($stack_id, $user_id, 'Master Data', 'auto', 'processing')
   RETURNING id

3. Backend: Start extraction (SSE stream)

   GET /api/stacks/{stack_id}/tables/{table_id}/extract

4. Agent: Reads existing extractions for each document

   For each document in stack:
       extraction = get_extraction(document_id)
       # Agent now has all the extracted data

5. Agent: Proposes columns (auto mode)

   Agent calls: define_columns({
       "columns": [
           {"name": "vendor", "type": "text"},
           {"name": "invoice_date", "type": "date"},
           {"name": "amount", "type": "number"}
       ],
       "reasoning": "Common fields across all invoices"
   })

   Backend saves: stack_tables.columns = [...]

6. Agent: Creates rows for each document

   For each document:
       Agent calls: save_table_row({
           "document_id": "doc-1",
           "vendor": "Acme Corp",
           "invoice_date": "2024-01-15",
           "amount": "1500.00",
           "confidence_scores": {...}
       })

       Backend saves: stack_table_rows record

7. Backend: Update table status and session

   UPDATE stack_tables
   SET status = 'completed', session_id = $session_id
   WHERE id = $table_id

8. SSE Stream Events:

   data: {"type": "status", "message": "Analyzing documents..."}
   data: {"type": "thinking", "text": "I see 5 invoice documents..."}
   data: {"type": "columns_defined", "columns": [...]}
   data: {"type": "row_saved", "document_id": "doc-1", "row": {...}}
   data: {"type": "row_saved", "document_id": "doc-2", "row": {...}}
   data: {"type": "complete", "table_id": "...", "session_id": "...", "row_count": 5}
```

---

## Data Flow 5: Create Stack Table (Custom Mode)

```
1. User creates table with specific columns

   POST /api/stacks/{stack_id}/tables
   {
       "name": "Invoice Summary",
       "mode": "custom",
       "custom_columns": ["vendor", "date", "total"]
   }

2. Backend: Create stack_tables record with columns pre-set

   INSERT INTO stack_tables (stack_id, user_id, name, mode, custom_columns, columns, status)
   VALUES (
       $stack_id,
       $user_id,
       'Invoice Summary',
       'custom',
       ARRAY['vendor', 'date', 'total'],
       '[{"name": "vendor", "type": "text"}, {"name": "date", "type": "text"}, {"name": "total", "type": "text"}]',
       'processing'
   )

3. Agent: Receives columns upfront (no define_columns step)

   Prompt includes: "Extract these columns: vendor, date, total"

4. Agent: Creates rows using exact column names

   Tool schema enforces: document_id, vendor, date, total

5. Same completion flow as auto mode
```

---

## Data Flow 6: Correction (Single Row)

```
1. User sees error, types correction in agent chat

   POST /api/stacks/{stack_id}/tables/{table_id}/correct
   {
       "instruction": "The vendor for invoice_march.pdf should be Acme Inc, not Acme Corp"
   }

2. Backend: Get session_id from stack_tables

   SELECT session_id FROM stack_tables WHERE id = $table_id

3. Backend: Resume agent session (SSE stream)

   Agent receives instruction with full session context
   (remembers the table, columns, and all rows it created)

4. Agent: Calls update_table_row

   update_table_row({
       "document_id": "invoice_march",
       "updates": {"vendor": "Acme Inc"}
   })

5. Backend: Update single row

   UPDATE stack_table_rows
   SET row_data = row_data || '{"vendor": "Acme Inc"}',
       updated_at = NOW()
   WHERE table_id = $table_id AND document_id = 'invoice_march'

6. SSE Stream Events:

   data: {"type": "status", "message": "Resuming session..."}
   data: {"type": "thinking", "text": "I'll update the vendor for invoice_march.pdf..."}
   data: {"type": "row_updated", "document_id": "invoice_march", "updates": {"vendor": "Acme Inc"}}
   data: {"type": "complete", "updated_count": 1}
```

---

## Data Flow 7: Bulk Correction

```
1. User requests bulk change

   POST /api/stacks/{stack_id}/tables/{table_id}/correct
   {
       "instruction": "Change all vendors named 'Acme Corp' to 'Acme Inc'"
   }

2. Agent: Calls bulk_update_rows

   bulk_update_rows({
       "column": "vendor",
       "match_value": "Acme Corp",
       "new_value": "Acme Inc"
   })

3. Backend: Update all matching rows

   UPDATE stack_table_rows
   SET row_data = jsonb_set(row_data, '{vendor}', '"Acme Inc"'),
       updated_at = NOW()
   WHERE table_id = $table_id
   AND row_data->>'vendor' = 'Acme Corp'
   RETURNING id

4. SSE Stream Events:

   data: {"type": "thinking", "text": "I'll find all rows with vendor 'Acme Corp'..."}
   data: {"type": "bulk_update", "column": "vendor", "old": "Acme Corp", "new": "Acme Inc", "count": 3}
   data: {"type": "complete", "updated_count": 3}
```

---

## Data Flow 8: Regenerate Single Row

If a row has errors that need re-extraction from source:

```
1. User requests re-extraction

   POST /api/stacks/{stack_id}/tables/{table_id}/rows/{row_id}/regenerate

2. Backend: Get source document and extraction

   SELECT e.extracted_fields, d.id as document_id
   FROM stack_table_rows r
   JOIN documents d ON d.id = r.document_id
   JOIN extractions e ON e.document_id = d.id
   WHERE r.id = $row_id
   ORDER BY e.created_at DESC
   LIMIT 1

3. Agent: Re-extracts row using table columns

   Reads: extraction.extracted_fields
   Columns: stack_tables.columns
   Tool: save_table_row with enforced schema

4. Backend: Replace row data

   UPDATE stack_table_rows
   SET row_data = $new_data,
       confidence_scores = $new_scores,
       updated_at = NOW()
   WHERE id = $row_id
```

---

## API Endpoints Summary

### Stacks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stacks` | List user's stacks |
| POST | `/api/stacks` | Create new stack |
| GET | `/api/stacks/{id}` | Get stack details |
| PATCH | `/api/stacks/{id}` | Update stack |
| DELETE | `/api/stacks/{id}` | Delete stack |

### Stack Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stacks/{id}/documents` | List documents in stack |
| POST | `/api/stacks/{id}/documents` | Add documents to stack |
| DELETE | `/api/stacks/{id}/documents/{doc_id}` | Remove document from stack |

### Stack Tables

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stacks/{id}/tables` | List tables in stack |
| POST | `/api/stacks/{id}/tables` | Create new table |
| GET | `/api/stacks/{id}/tables/{table_id}` | Get table with rows |
| DELETE | `/api/stacks/{id}/tables/{table_id}` | Delete table |

### Stack Table Extraction (SSE)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/stacks/{id}/tables/{table_id}/extract` | Extract data (SSE stream) |
| POST | `/api/stacks/{id}/tables/{table_id}/correct` | Correction via agent (SSE stream) |
| POST | `/api/stacks/{id}/tables/{table_id}/rows/{row_id}/regenerate` | Regenerate single row |

### Stack Table Rows

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stacks/{id}/tables/{table_id}/rows` | Get all rows |
| PATCH | `/api/stacks/{id}/tables/{table_id}/rows/{row_id}` | Manual row edit |
| DELETE | `/api/stacks/{id}/tables/{table_id}/rows/{row_id}` | Delete row |

---

## Frontend Query Patterns

### Get Stack with Document Count

```sql
SELECT
    s.*,
    COUNT(sd.document_id) as document_count
FROM stacks s
LEFT JOIN stack_documents sd ON sd.stack_id = s.id
WHERE s.user_id = $user_id
GROUP BY s.id
ORDER BY s.created_at DESC;
```

### Get Stack Table with Rows

```sql
SELECT
    st.*,
    json_agg(
        json_build_object(
            'id', str.id,
            'document_id', str.document_id,
            'filename', d.filename,
            'row_data', str.row_data,
            'confidence_scores', str.confidence_scores
        ) ORDER BY d.filename
    ) as rows
FROM stack_tables st
LEFT JOIN stack_table_rows str ON str.table_id = st.id
LEFT JOIN documents d ON d.id = str.document_id
WHERE st.id = $table_id
GROUP BY st.id;
```

### Get Document with Its Stacks

```sql
SELECT
    d.*,
    COALESCE(
        json_agg(
            json_build_object('id', s.id, 'name', s.name)
        ) FILTER (WHERE s.id IS NOT NULL),
        '[]'
    ) as stacks
FROM documents d
LEFT JOIN stack_documents sd ON sd.document_id = d.id
LEFT JOIN stacks s ON s.id = sd.stack_id
WHERE d.id = $document_id
GROUP BY d.id;
```

---

## Session Persistence Summary

| Level | Session Storage | Purpose |
|-------|-----------------|---------|
| Document | `documents.session_id` | Correct document extraction |
| Document | `extractions.session_id` | Track which session produced extraction |
| Stack Table | `stack_tables.session_id` | Correct table rows |

Sessions enable the agent to:
- Remember what it extracted
- Understand correction context
- Make targeted updates
- Maintain conversation continuity

---

## Export Patterns

JSONB storage doesn't limit export formats. Flatten on read:

### Export Stack Table as CSV

```sql
-- Dynamically flatten JSONB to columns
SELECT
    d.filename as "Document",
    r.row_data->>'vendor' as "Vendor",
    r.row_data->>'date' as "Date",
    r.row_data->>'amount' as "Amount"
FROM stack_table_rows r
JOIN documents d ON d.id = r.document_id
WHERE r.table_id = $table_id
ORDER BY d.filename;
```

### Dynamic Column Export (Python)

```python
async def export_table_csv(table_id: str) -> str:
    # Get column definitions
    table = await get_table(table_id)
    columns = table.columns  # [{"name": "vendor"}, {"name": "date"}, ...]

    # Get rows
    rows = await get_table_rows(table_id)

    # Build CSV
    output = StringIO()
    writer = csv.writer(output)

    # Header row
    header = ["Document"] + [col["name"] for col in columns]
    writer.writerow(header)

    # Data rows
    for row in rows:
        data = [row.document.filename]
        for col in columns:
            data.append(row.row_data.get(col["name"], ""))
        writer.writerow(data)

    return output.getvalue()
```

### Export Formats (Future)

| Format | Implementation |
|--------|----------------|
| CSV | Flatten JSONB → columns |
| Excel | Use openpyxl, same flattening |
| JSON | Already in correct format |
| Google Sheets | API push flattened data |
| Xero/QuickBooks | Map columns to integration schema |

**Key insight:** Storage format (JSONB) ≠ Export format.
JSONB gives schema flexibility; export flattens to user's desired format.
