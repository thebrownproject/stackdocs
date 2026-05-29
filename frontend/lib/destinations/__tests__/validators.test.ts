import { describe, expect, it } from "vitest";
import { destinationConfig } from "../validators";
import { renderTemplate } from "../template";

describe("destinationConfig", () => {
  it("accepts valid webhook config", () => {
    expect(
      destinationConfig.safeParse({
        kind: "webhook",
        config: { url: "https://example.com/hook", headers: { Authorization: "Bearer token" } },
      }).success,
    ).toBe(true);
  });

  it("rejects invalid Google Sheets column mappings", () => {
    expect(
      destinationConfig.safeParse({
        kind: "google_sheets",
        config: {
          spreadsheet_id: "spreadsheet123",
          sheet_name: "Sheet1",
          column_mapping: { "fields.total": "1" },
        },
      }).success,
    ).toBe(false);
  });

  it("accepts email templates with an email recipient", () => {
    expect(
      destinationConfig.safeParse({
        kind: "email",
        config: {
          to: "ops@example.com",
          subject_template: "Document {{documentId}}",
          body_template: "Total {{fields.total}}",
        },
      }).success,
    ).toBe(true);
  });
});

describe("renderTemplate", () => {
  it("renders dot-path variables from nested data", () => {
    expect(renderTemplate("Total {{fields.total}} for {{documentId}}", {
      documentId: "doc_123",
      fields: { total: "$100.00" },
    })).toBe("Total $100.00 for doc_123");
  });
});
