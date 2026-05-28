import { describe, expect, it } from "vitest";
import { inferSchema } from "../schema-infer";
import { splitSamples } from "../split";
import { scoreRun } from "../scoring";
import type { Sample } from "../types";

const samples: Sample[] = [
  { id: "1", expectedOutput: { vendor: "Acme Inc", total: "$1,000.00", issued_date: "2026-01-05", status: "paid" } },
  { id: "2", expectedOutput: { vendor: "Globex", total: "$250.50", issued_date: "2026-02-10", status: "due" } },
  { id: "3", expectedOutput: { vendor: "Initech", total: "$99.99", issued_date: "2026-03-01", status: "paid" } },
];

describe("schema inference", () => {
  it("infers a field per leaf path with sensible scorer types", () => {
    const schema = inferSchema(samples);
    const byName = Object.fromEntries(schema.map((f) => [f.name, f]));
    expect(byName.total.type).toBe("numeric");
    expect(byName.issued_date.type).toBe("date");
    expect(byName.status.type).toBe("exact");
    expect(byName.vendor.required).toBe(true);
  });

  it("flattens nested objects to dot-paths", () => {
    const schema = inferSchema([{ id: "a", expectedOutput: { buyer: { name: "Bob" } } }]);
    expect(schema.some((f) => f.name === "buyer.name")).toBe(true);
  });
});

describe("split", () => {
  it("is deterministic and reserves at least one test sample", () => {
    const a = splitSamples(samples);
    const b = splitSamples(samples);
    expect(a.test.length).toBeGreaterThanOrEqual(1);
    expect(a.train.length + a.test.length).toBe(3);
    expect(a.test.map((s) => s.id)).toEqual(b.test.map((s) => s.id));
  });
});

describe("scoring", () => {
  it("scores predictions per field and overall", () => {
    const schema = inferSchema(samples);
    const { result } = scoreRun(schema, [
      {
        sampleId: "1",
        expected: samples[0].expectedOutput,
        actual: { vendor: "acme inc", total: 1000, issued_date: "5 Jan 2026", status: "wrong" },
      },
    ]);
    expect(result.perField.vendor.accuracy).toBe(1);
    expect(result.perField.total.accuracy).toBe(1);
    expect(result.perField.issued_date.accuracy).toBe(1);
    expect(result.perField.status.accuracy).toBe(0);
    expect(result.overallAccuracy).toBeCloseTo(0.75, 5);
  });
});
