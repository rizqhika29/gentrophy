import { describe, expect, it } from "vitest";
import { extractErrorMessage } from "@/lib/utils";

describe("extractErrorMessage", () => {
  it("unwraps plain object errors into a readable message", () => {
    expect(extractErrorMessage({ message: "[EXPECTED] Must send GEN as the bounty reward" })).toBe(
      "Must send GEN as the bounty reward",
    );
  });

  it("keeps wallet rejection handling", () => {
    expect(extractErrorMessage(new Error("User rejected the request"))).toBe(
      "Transaction rejected in wallet.",
    );
  });

  it("handles string errors", () => {
    expect(extractErrorMessage("[EXTERNAL] URL could not be fetched")).toBe(
      "URL could not be fetched",
    );
  });

  it("falls back for null", () => {
    expect(extractErrorMessage(null)).toBe("Unknown error");
  });
});
