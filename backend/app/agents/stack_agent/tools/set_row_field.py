"""
Tool: set_row_field (WRITE)

Sets a specific field in a row using JSON path notation.
Uses Postgres jsonb_set() for surgical updates to row_data.

Examples:
- path="vendor" → sets top-level field
- path="metadata.source" → sets nested field
"""
