# Agent Tools for Stacks

**Purpose:** Define the Claude Agent SDK tools for stack table extraction and correction.

**Key Principle:** Dynamic tool schemas enforce column consistency - the agent MUST use exact column names defined in `stack_tables.columns`.

---

## Tool Categories

### 1. Document-Level Tools (Existing)
Used for single document extraction and correction.

### 2. Stack Table Tools (New)
Used for multi-document table extraction and row-level corrections.

---

## Document-Level Tools

### `save_extracted_data`

Existing tool for document extraction. No changes needed.

```python
@tool(
    "save_extracted_data",
    "Save the extracted structured data from the document",
    {"extracted_fields": dict, "confidence_scores": dict}
)
async def save_extracted_data(args: dict) -> dict:
    # Saves to extractions table
    return {"content": [{"type": "text", "text": "Extraction saved"}]}
```

---

## Stack Table Tools

### Tool 1: `define_columns` (Auto Mode)

Used when `stack_tables.mode = 'auto'`. Agent analyzes documents and proposes column structure.

```python
@tool(
    "define_columns",
    "Define the columns for the stack table based on document analysis",
    {
        "columns": list,  # [{"name": "vendor", "type": "text"}, ...]
        "reasoning": str  # Why these columns were chosen
    }
)
async def define_columns(args: dict) -> dict:
    """
    Agent calls this after analyzing all documents in the stack.
    Sets stack_tables.columns and prepares for row extraction.
    """
    columns = args["columns"]
    # Validate column structure
    # Save to stack_tables.columns
    # Return confirmation
    return {
        "content": [{
            "type": "text",
            "text": f"Defined {len(columns)} columns: {[c['name'] for c in columns]}"
        }]
    }
```

**Example Agent Call:**
```json
{
    "columns": [
        {"name": "vendor", "type": "text"},
        {"name": "invoice_date", "type": "date"},
        {"name": "amount", "type": "number"},
        {"name": "description", "type": "text"}
    ],
    "reasoning": "Based on analyzing 5 invoice documents, these are the common fields present in all documents."
}
```

---

### Tool 2: `save_table_row` (Dynamic Schema)

**This is the key tool.** Schema is generated dynamically from `stack_tables.columns`.

```python
def create_save_row_tool(columns: list[dict]) -> callable:
    """
    Dynamically create a tool with schema matching the table columns.

    Args:
        columns: List of column definitions from stack_tables.columns
                 e.g., [{"name": "vendor", "type": "text"}, ...]

    Returns:
        A tool function with enforced parameter schema
    """

    # Build parameter schema from columns
    param_schema = {
        "document_id": str,  # Always required - which doc this row is from
    }

    for col in columns:
        # All columns are strings in the tool (agent outputs text)
        # Type coercion happens in validation layer
        param_schema[col["name"]] = str

    # Add confidence scores (optional)
    param_schema["confidence_scores"] = dict

    @tool(
        "save_table_row",
        f"Save a row to the stack table. Columns: {[c['name'] for c in columns]}",
        param_schema
    )
    async def save_table_row(args: dict) -> dict:
        document_id = args.pop("document_id")
        confidence_scores = args.pop("confidence_scores", {})

        # Remaining args are the row data
        row_data = args

        # Validate all columns are present
        for col in columns:
            if col["name"] not in row_data:
                row_data[col["name"]] = None  # Set missing to null

        # Save to stack_table_rows
        # ...

        return {
            "content": [{
                "type": "text",
                "text": f"Saved row for document {document_id}"
            }]
        }

    return save_table_row
```

**Example Generated Schema (for invoice table):**
```python
# If columns = [{"name": "vendor"}, {"name": "date"}, {"name": "amount"}]
# Generated tool schema:
{
    "document_id": str,
    "vendor": str,
    "date": str,
    "amount": str,
    "confidence_scores": dict
}
```

**Example Agent Call:**
```json
{
    "document_id": "abc-123",
    "vendor": "Acme Corporation",
    "date": "2024-01-15",
    "amount": "1500.00",
    "confidence_scores": {
        "vendor": 0.95,
        "date": 0.98,
        "amount": 0.92
    }
}
```

---

### Tool 3: `update_table_row`

For corrections - update specific cells in a row.

```python
def create_update_row_tool(columns: list[dict]) -> callable:
    """
    Dynamically create an update tool matching table columns.
    """

    # Valid column names for validation
    valid_columns = {col["name"] for col in columns}

    @tool(
        "update_table_row",
        f"Update specific fields in a table row. Valid columns: {list(valid_columns)}",
        {
            "document_id": str,  # Which row to update
            "updates": dict,     # {"column_name": "new_value", ...}
        }
    )
    async def update_table_row(args: dict) -> dict:
        document_id = args["document_id"]
        updates = args["updates"]

        # Validate column names
        invalid_cols = set(updates.keys()) - valid_columns
        if invalid_cols:
            return {
                "content": [{
                    "type": "text",
                    "text": f"Error: Invalid columns: {invalid_cols}. Valid columns are: {valid_columns}"
                }]
            }

        # Update the row
        # UPDATE stack_table_rows
        # SET row_data = row_data || $updates, updated_at = NOW()
        # WHERE table_id = $table_id AND document_id = $document_id

        return {
            "content": [{
                "type": "text",
                "text": f"Updated {list(updates.keys())} for document {document_id}"
            }]
        }

    return update_table_row
```

**Example Agent Call (correction):**
```json
{
    "document_id": "abc-123",
    "updates": {
        "vendor": "Acme Inc"
    }
}
```

---

### Tool 4: `bulk_update_rows`

For bulk corrections (e.g., "change all Acme Corp to Acme Inc").

```python
@tool(
    "bulk_update_rows",
    "Update multiple rows matching a condition",
    {
        "column": str,           # Which column to match
        "match_value": str,      # Value to find
        "new_value": str,        # Value to set
    }
)
async def bulk_update_rows(args: dict) -> dict:
    column = args["column"]
    match_value = args["match_value"]
    new_value = args["new_value"]

    # UPDATE stack_table_rows
    # SET row_data = jsonb_set(row_data, '{column}', '"new_value"')
    # WHERE table_id = $table_id
    # AND row_data->>$column = $match_value

    # Return count of updated rows
    return {
        "content": [{
            "type": "text",
            "text": f"Updated {count} rows: {column} '{match_value}' → '{new_value}'"
        }]
    }
```

**Example Agent Call:**
```json
{
    "column": "vendor",
    "match_value": "Acme Corp",
    "new_value": "Acme Inc"
}
```

---

### Tool 5: `read_document_extraction`

Agent reads existing document extraction to populate table rows.

```python
@tool(
    "read_document_extraction",
    "Read the existing extraction for a document",
    {"document_id": str}
)
async def read_document_extraction(args: dict) -> dict:
    document_id = args["document_id"]

    # Get latest extraction for this document
    extraction = get_latest_extraction(document_id)

    return {
        "content": [{
            "type": "text",
            "text": json.dumps(extraction.extracted_fields)
        }]
    }
```

---

## Tool Usage Flow

### Initial Extraction (Auto Mode)

```
1. Agent receives: "Extract data from 5 invoices in Q1 Expenses stack"

2. Agent calls read_document_extraction for each document
   → Gets existing extractions

3. Agent calls define_columns
   → Proposes columns based on common fields
   → Columns saved to stack_tables.columns

4. For each document, agent calls save_table_row
   → Tool schema enforces exact column names
   → Rows saved to stack_table_rows
```

### Initial Extraction (Custom Mode)

```
1. User specifies: columns = ["vendor", "date", "amount"]
   → Saved to stack_tables.custom_columns and stack_tables.columns

2. Agent receives columns upfront (no define_columns step)

3. For each document, agent calls save_table_row
   → Must use exactly: vendor, date, amount
```

### Correction Flow

```
1. User: "The vendor for invoice_march.pdf should be Acme Inc"

2. Agent resumes session (has table context)

3. Agent calls update_table_row
   → {"document_id": "invoice_march", "updates": {"vendor": "Acme Inc"}}

4. Single row updated, others untouched
```

### Bulk Correction Flow

```
1. User: "Change all vendors named 'Acme Corp' to 'Acme Inc'"

2. Agent calls bulk_update_rows
   → {"column": "vendor", "match_value": "Acme Corp", "new_value": "Acme Inc"}

3. All matching rows updated
```

---

## Validation Layer

Even with tool schema enforcement, add backend validation:

```python
def validate_row_data(row_data: dict, columns: list[dict]) -> dict:
    """
    Ensure row_data matches column schema.

    - Missing columns → set to None
    - Extra columns → remove
    - Type coercion → attempt conversion
    """
    validated = {}
    column_names = {col["name"] for col in columns}

    for col in columns:
        name = col["name"]
        col_type = col.get("type", "text")
        value = row_data.get(name)

        # Type coercion
        if value is not None:
            if col_type == "number":
                try:
                    value = float(value.replace(",", "").replace("$", ""))
                except:
                    pass  # Keep as string if conversion fails
            elif col_type == "date":
                # Normalize date format if needed
                pass

        validated[name] = value

    return validated
```

---

## Error Handling

### Invalid Column Name

If agent tries to use wrong column name, tool call fails:

```
Agent: save_table_row(document_id="abc", vendor_name="Acme")
                                         ^^^^^^^^^^^
Error: Unknown parameter 'vendor_name'. Valid parameters: document_id, vendor, date, amount
```

Agent will see error and retry with correct column name.

### Missing Required Field

If agent omits a column, validation sets it to null:

```
Agent: save_table_row(document_id="abc", vendor="Acme")
       # Missing: date, amount

Result: row_data = {"vendor": "Acme", "date": null, "amount": null}
```

Row is saved, but with null values. Agent or user can correct later.

---

## Summary

| Tool | Purpose | Dynamic Schema |
|------|---------|----------------|
| `define_columns` | Auto mode - agent proposes columns | No |
| `save_table_row` | Save row with exact columns | **Yes** |
| `update_table_row` | Correct specific cells | **Yes** |
| `bulk_update_rows` | Bulk corrections | Validates against columns |
| `read_document_extraction` | Read existing doc extraction | No |

The dynamic schema generation is the key to reliability - agent cannot hallucinate column names.
