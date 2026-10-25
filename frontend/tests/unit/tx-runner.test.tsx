// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTxRunner } from "@/hooks/useContract";

const wallet = vi.hoisted(() => ({
  value: {
    address: "0x1111111111111111111111111111111111111111",
    wrongNetwork: false,
    provider: null,
    writeClient: {},
    readClient: {},
  } as {
    address: string | null;
    wrongNetwork: boolean;
    provider: unknown;
    writeClient: object;
    readClient: object;
  },
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => wallet.value,
}));

const gen = vi.hoisted(() => ({
  ensureWalletOnNetwork: vi.fn(async () => {}),
  writeContractAutoFee: vi.fn(async () => "0xdeadbeef" as `0x${string}`),
  waitForDecision: vi.fn(async (): Promise<unknown> => ({})),
  waitForFinalization: vi.fn(async (): Promise<unknown> => ({})),
  isSuccessTx: vi.fn(() => false),
  summarizeConsensus: vi.fn(() => null),
  txStatusName: vi.fn(() => "ACCEPTED"),
}));

vi.mock("@/lib/genlayer", () => gen);

beforeEach(() => {
  wallet.value.address = "0x1111111111111111111111111111111111111111";
  wallet.value.wrongNetwork = false;
  gen.isSuccessTx.mockReturnValue(false);
  gen.summarizeConsensus.mockReturnValue(null);
  gen.txStatusName.mockReturnValue("ACCEPTED");
  gen.waitForDecision.mockResolvedValue({ status_name: "ACCEPTED" });
  gen.waitForFinalization.mockResolvedValue({ status_name: "FINALIZED" });
  gen.writeContractAutoFee.mockResolvedValue("0xdeadbeef");
});

const base = {
  functionName: "create_bounty",
  args: ["Title", "article", "A rubric long enough to matter.", 70n, 1n],
  successTitle: "Bounty created",
};

describe("useTxRunner contract rejection (the \"Unknown error\" bug)", () => {
  it("returns the on-chain reason instead of undefined / Unknown error", async () => {
    gen.summarizeConsensus.mockReturnValue({
      leader_error: "[EXPECTED] Must send GEN as the bounty reward",
    });

    const { result } = renderHook(() => useTxRunner());
    let res: Awaited<ReturnType<typeof result.current.run>>;
    await act(async () => {
      res = await result.current.run(base);
    });

    expect(res!.ok).toBe(false);
    if (res!.ok) throw new Error("unreachable");
    expect(res!.phase).toBe("post-submit");
    expect(res!.error).toBe("Must send GEN as the bounty reward");
    expect(res!.txHash).toBe("0xdeadbeef");

    // the receipt stays visible so the user can inspect it
    expect(result.current.progress.phase).toBe("error");
    expect(result.current.progress.consensus?.leader_error).toContain("Must send GEN");
    expect(result.current.progress.explorerUrl).toContain("0xdeadbeef");
    expect(result.current.busy).toBe(false);
  });

  it("falls back to the receipt status when the leader receipt has no reason", async () => {
    const { result } = renderHook(() => useTxRunner());
    let res: Awaited<ReturnType<typeof result.current.run>>;
    await act(async () => {
      res = await result.current.run(base);
    });

    expect(res!.ok).toBe(false);
    if (res!.ok) throw new Error("unreachable");
    expect(res!.error).toMatch(/Execution failed \(ACCEPTED\)/);
  });
});

describe("useTxRunner success path", () => {
  it("reports the decision, then un-freezes once finalized", async () => {
    gen.isSuccessTx.mockReturnValue(true);

    const { result } = renderHook(() => useTxRunner());
    let res: Awaited<ReturnType<typeof result.current.run>>;
    await act(async () => {
      res = await result.current.run(base);
    });

    expect(res!.ok).toBe(true);
    if (!res!.ok) throw new Error("unreachable");
    expect(res!.txHash).toBe("0xdeadbeef");

    await waitFor(() => expect(result.current.progress.phase).toBe("finalized"));
    // phase "finalized" used to count as busy → every button stayed disabled
    expect(result.current.busy).toBe(false);
  });

  it("keeps buttons enabled while waiting for finalization", async () => {
    gen.isSuccessTx.mockReturnValue(true);
    gen.waitForFinalization.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { status_name: "FINALIZED" };
    });

    const { result } = renderHook(() => useTxRunner());
    await act(async () => {
      await result.current.run(base);
    });

    expect(result.current.progress.phase).toBe("deciding");
    expect(result.current.busy).toBe(false);
  });
});

describe("useTxRunner pre-submit guards", () => {
  it("fails fast without a wallet, without touching the chain", async () => {
    wallet.value.address = null;
    const { result } = renderHook(() => useTxRunner());

    let res: Awaited<ReturnType<typeof result.current.run>>;
    await act(async () => {
      res = await result.current.run(base);
    });

    expect(res!.ok).toBe(false);
    if (res!.ok) throw new Error("unreachable");
    expect(res!.phase).toBe("pre-submit");
    expect(res!.error).toBe("Connect your wallet first.");
    expect(gen.writeContractAutoFee).not.toHaveBeenCalled();
  });

  it("explains a wrong network instead of failing silently", async () => {
    wallet.value.wrongNetwork = true;
    const { result } = renderHook(() => useTxRunner());

    let res: Awaited<ReturnType<typeof result.current.run>>;
    await act(async () => {
      res = await result.current.run(base);
    });

    expect(res!.ok).toBe(false);
    if (res!.ok) throw new Error("unreachable");
    expect(res!.error).toMatch(/Wrong network/);
    expect(gen.writeContractAutoFee).not.toHaveBeenCalled();
  });
});
