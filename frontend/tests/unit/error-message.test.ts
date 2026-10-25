import { describe, expect, it } from "vitest";
import { extractErrorMessage } from "@/lib/utils";

describe("extractErrorMessage hardening", () => {
  it("unwraps JSON-RPC style nested errors", () => {
    expect(
      extractErrorMessage({ error: { code: -32000, message: "[EXTERNAL] Insufficient funds" } }),
    ).toBe("Insufficient funds");
  });

  it("falls back to the cause when the outer message is empty", () => {
    const cause = new Error("[TRANSIENT] RPC endpoint unreachable");
    expect(extractErrorMessage(new Error("", { cause }))).toBe("RPC endpoint unreachable");
  });

  it("keeps a meaningful outer message when there is one", () => {
    const cause = new Error("[TRANSIENT] inner detail");
    expect(extractErrorMessage(new Error("fetch failed", { cause }))).toBe("fetch failed");
  });

  it("reads viem shortMessage first", () => {
    const err = Object.assign(new Error("long docs-backed message"), {
      shortMessage: "execution reverted: [EXPECTED] Nothing to reclaim",
      details: "raw details",
    });
    expect(extractErrorMessage(err)).toBe("Nothing to reclaim");
  });

  it("serializes anonymous objects instead of printing [object Object]", () => {
    const msg = extractErrorMessage({ foo: "bar" });
    expect(msg).not.toBe("[object Object]");
    expect(msg).toContain("bar");
  });

  it("returns Unknown error for valueless objects", () => {
    expect(extractErrorMessage({})).toBe("Unknown error");
    expect(extractErrorMessage(new Error(""))).toBe("Unknown error");
    expect(extractErrorMessage(undefined)).toBe("Unknown error");
  });

  it("still normalizes wallet rejections from nested shapes", () => {
    expect(extractErrorMessage({ error: { message: "MetaMask Tx Signature: User denied." } })).toBe(
      "Transaction rejected in wallet.",
    );
  });
});
