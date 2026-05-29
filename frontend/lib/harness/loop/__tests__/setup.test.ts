import { describe, expect, it } from "vitest";
import { buildDefaultGates } from "../setup";
import type { FieldSchema } from "../../types";

const schema: FieldSchema = [
  { name: "vendor", type: "exact", required: true },
  { name: "total", type: "numeric", required: true },
];

describe("buildDefaultGates", () => {
  it("creates a field_floor per field plus review-rate and schema-valid gates", () => {
    const gates = buildDefaultGates(schema, { fieldFloor: 0.85, reviewMax: 0.2 });
    const floors = gates.filter((g) => g.kind === "field_floor");
    expect(floors).toHaveLength(2);
    expect(gates.some((g) => g.kind === "review_rate_ceiling")).toBe(true);
    expect(gates.some((g) => g.kind === "schema_valid")).toBe(true);
  });

  it("uses the provided field floor as each field's minimum", () => {
    const gates = buildDefaultGates(schema, { fieldFloor: 0.7, reviewMax: 0.2 });
    const total = gates.find((g) => g.kind === "field_floor" && g.field === "total");
    expect(total && total.kind === "field_floor" ? total.min : -1).toBe(0.7);
  });
});
