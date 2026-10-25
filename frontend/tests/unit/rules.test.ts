import { describe, expect, it } from "vitest";
import { isPastDeadline, submitWorkBlock, validateDeadline } from "@/lib/rules";

const NOW = 1_800_000_000;

describe("isPastDeadline", () => {
  it("treats deadline 0 as no deadline", () => {
    expect(isPastDeadline(0, NOW)).toBe(false);
  });

  it("is false at the deadline and true after it", () => {
    expect(isPastDeadline(NOW, NOW)).toBe(false);
    expect(isPastDeadline(NOW, NOW + 1)).toBe(true);
  });

  it("rejects non-finite values instead of throwing", () => {
    expect(isPastDeadline(Number.NaN, NOW)).toBe(false);
    expect(isPastDeadline(-5, NOW)).toBe(false);
  });
});

describe("submitWorkBlock", () => {
  const open = { status: "open" as const, poster: "0xAbC0000000000000000000000000000000000001", deadline: NOW + 1000 };
  const solver = "0xabc0000000000000000000000000000000000002";

  it("allows a third party on an open, unexpired bounty", () => {
    expect(submitWorkBlock(open, solver, NOW)).toBeNull();
  });

  it("allows a disconnected wallet (contract enforces the rest)", () => {
    expect(submitWorkBlock(open, null, NOW)).toBeNull();
  });

  it("blocks the poster regardless of case", () => {
    expect(submitWorkBlock(open, "0xABC0000000000000000000000000000000000001", NOW)).toBe("poster");
  });

  it("blocks after the deadline", () => {
    expect(submitWorkBlock({ ...open, deadline: NOW - 1 }, solver, NOW)).toBe("expired");
  });

  it("blocks every closed bounty first", () => {
    for (const status of ["submitted", "reviewing", "paid", "failed", "refunded"] as const) {
      expect(submitWorkBlock({ ...open, status }, solver, NOW)).toBe("closed");
    }
  });
});

describe("validateDeadline", () => {
  it("rejects empty / zero / non-numeric input", () => {
    expect(validateDeadline("", NOW)).toMatch(/unix timestamp/);
    expect(validateDeadline("0", NOW)).toMatch(/unix timestamp/);
    expect(validateDeadline("abc", NOW)).toMatch(/unix timestamp/);
  });

  it("rejects past timestamps", () => {
    expect(validateDeadline(String(NOW - 1), NOW)).toBe("Deadline must be in the future");
  });

  it("accepts a future timestamp", () => {
    expect(validateDeadline(String(NOW + 60), NOW)).toBeNull();
  });
});
