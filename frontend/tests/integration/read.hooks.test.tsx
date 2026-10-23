// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useBounty, useOpenBounties, useStats } from "@/hooks/useContract";
import { WalletProvider } from "@/hooks/useWallet";

const wrapper = ({ children }: { children: ReactNode }) => (
  <WalletProvider>{children}</WalletProvider>
);

const WAIT = { timeout: 60_000 };

describe("contract reads through the real hooks (Studionet)", () => {
  it("useStats fetches and normalizes get_stats", async () => {
    const { result } = renderHook(() => useStats(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.stats).not.toBeNull(), WAIT);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);

    const stats = result.current.stats!;
    expect(Number.isInteger(stats.total_created)).toBe(true);
    expect(stats.total_created).toBeGreaterThanOrEqual(6);
    expect(typeof stats.total_paid_wei).toBe("string");
    expect(BigInt(stats.total_paid_wei)).toBeGreaterThanOrEqual(
      1_500_000_000_000_000_000n,
    );
    expect(Number.isInteger(stats.next_id)).toBe(true);
    expect(stats.next_id).toBeGreaterThanOrEqual(9);
  });

  it("useOpenBounties returns rows normalized to frontend types", async () => {
    const { result } = renderHook(() => useOpenBounties(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false), WAIT);
    expect(result.current.error).toBeNull();
    expect(Array.isArray(result.current.bounties)).toBe(true);
    for (const b of result.current.bounties) {
      expect(typeof b.bounty_id).toBe("number");
      expect(typeof b.min_score).toBe("number");
      expect(typeof b.reward_wei).toBe("string");
      expect(typeof b.deadline).toBe("number");
      expect(BigInt(b.reward_wei)).toBeGreaterThan(0n);
    }
  });

  it("useBounty loads a known bounty and clears when id becomes null", async () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: number | null }) => useBounty(id),
      { wrapper, initialProps: { id: 0 } },
    );
    await waitFor(() => expect(result.current.bounty).not.toBeNull(), WAIT);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);

    const bounty = result.current.bounty!;
    expect(bounty.bounty_id).toBe(0);
    expect(bounty.status).toBe("paid");
    expect(BigInt(bounty.reward_wei)).toBe(500_000_000_000_000_000n);
    expect(bounty.poster).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(Number.isInteger(bounty.score)).toBe(true);
    expect(bounty.score).toBeGreaterThanOrEqual(0);
    expect(bounty.score).toBeLessThanOrEqual(100);

    rerender({ id: null });
    expect(result.current.bounty).toBeNull();
  });
});
