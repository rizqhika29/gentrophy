import { describe, expect, it } from "vitest";
import { CHAIN_ID_DEC, CHAIN_ID_HEX, NETWORK } from "@/lib/config";

describe("chain configuration", () => {
  it("uses the correct GenLayer Studionet chain id", () => {
    expect(CHAIN_ID_DEC).toBe(61999);
    expect(BigInt(CHAIN_ID_HEX)).toBe(BigInt(CHAIN_ID_DEC));
  });

  it("defaults to the Studionet network", () => {
    expect(NETWORK).toBe("studionet");
  });
});
