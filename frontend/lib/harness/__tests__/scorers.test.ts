import { describe, expect, it } from "vitest";
import { MISSING, score } from "../scorers";

describe("exact scorer", () => {
  it("matches case/whitespace-insensitively", () => {
    expect(score("exact", "Acme Inc", "  acme   inc ")).toBe(true);
    expect(score("exact", "Acme", "Acme Ltd")).toBe(false);
  });
  it("passes when both missing", () => {
    expect(score("exact", MISSING, MISSING)).toBe(true);
    expect(score("exact", "x", MISSING)).toBe(false);
  });
});

describe("numeric scorer", () => {
  it("ignores currency and grouping", () => {
    expect(score("numeric", "$1,000.00", 1000)).toBe(true);
    expect(score("numeric", "1500.00", "1,500")).toBe(true);
    expect(score("numeric", "100", "101")).toBe(false);
  });
});

describe("date scorer", () => {
  it("normalises formats to the same day", () => {
    expect(score("date", "2026-01-05", "5 Jan 2026")).toBe(true);
    expect(score("date", "05/01/2026", "2026-01-05")).toBe(true);
    expect(score("date", "2026-01-05", "2026-02-05")).toBe(false);
  });
});

describe("fuzzy scorer", () => {
  it("accepts close free-text, rejects unrelated", () => {
    expect(score("fuzzy", "wear hard hat and hi-vis vest", "wear hard hat and hi vis vest")).toBe(true);
    expect(score("fuzzy", "site address 12 King St", "completely different text")).toBe(false);
  });
});

describe("presence scorer", () => {
  it("passes when presence agrees", () => {
    expect(score("presence", "x", "y")).toBe(true);
    expect(score("presence", MISSING, MISSING)).toBe(true);
    expect(score("presence", "x", MISSING)).toBe(false);
  });
});
