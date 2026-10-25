import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureWalletOnNetwork } from "@/lib/genlayer";
import type { Eip1193Provider } from "@/lib/wallet";

/**
 * `ensureWalletOnNetwork` runs at the start of EVERY write (useTxRunner.run).
 * It must only verify/switch the chain — it must never depend on MetaMask Snap
 * APIs, which Rabby / Coinbase / Brave / Frame do not implement and which MetaMask
 * turns into an extra "install GenLayer snap" dialog the user can reject.
 */

type Recorded = { method: string; params?: unknown };

function makeWallet(opts: {
  chainId: string;
  unsupportedMethods?: string[];
  rejectCode?: number;
}) {
  const calls: Recorded[] = [];
  const provider: Eip1193Provider = {
    request: async ({ method, params }) => {
      calls.push({ method, params });
      if (opts.unsupportedMethods?.includes(method)) {
        const err = new Error(
          `The method ${method} does not exist/is not available.`,
        ) as Error & { code: number };
        err.code = -32601;
        throw err;
      }
      switch (method) {
        case "eth_chainId":
          return opts.chainId;
        case "wallet_switchEthereumChain": {
          if (opts.rejectCode) {
            const err = new Error("User rejected the request.") as Error & { code: number };
            err.code = opts.rejectCode;
            throw err;
          }
          return null;
        }
        case "wallet_addEthereumChain":
          return null;
        default:
          return null;
      }
    },
  };
  return { provider, calls };
}

const originalWindow = (globalThis as { window?: unknown }).window;

beforeEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

afterEach(() => {
  if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as { window?: unknown }).window = originalWindow;
  vi.restoreAllMocks();
});

describe("ensureWalletOnNetwork", () => {
  it("works on a wallet without Snap support (Rabby/Coinbase/Brave)", async () => {
    const { provider, calls } = makeWallet({
      chainId: "0xf22f",
      unsupportedMethods: ["wallet_getSnaps", "wallet_requestSnaps"],
    });
    (globalThis as { window?: unknown }).window = { ethereum: provider };

    await expect(ensureWalletOnNetwork(provider)).resolves.toBeUndefined();

    expect(calls.map((c) => c.method)).toEqual(["eth_chainId"]);
  });

  it("does not request a GenLayer Snap install on MetaMask", async () => {
    const { provider, calls } = makeWallet({ chainId: "0xf22f" });
    (globalThis as { window?: unknown }).window = { ethereum: provider };

    await ensureWalletOnNetwork(provider);

    expect(calls.some((c) => c.method.startsWith("wallet_requestSnaps"))).toBe(false);
    expect(calls.some((c) => c.method === "wallet_getSnaps")).toBe(false);
  });

  it("does not throw when the user would reject a snap prompt", async () => {
    const { provider } = makeWallet({ chainId: "0xf22f", rejectCode: 4001 });
    (globalThis as { window?: unknown }).window = { ethereum: provider };

    await expect(ensureWalletOnNetwork(provider)).resolves.toBeUndefined();
  });

  it("switches the chain when the wallet is on another network", async () => {
    const { provider, calls } = makeWallet({ chainId: "0x1" });
    (globalThis as { window?: unknown }).window = { ethereum: provider };

    await ensureWalletOnNetwork(provider);

    const switchCall = calls.find((c) => c.method === "wallet_switchEthereumChain");
    expect(switchCall).toBeDefined();
    expect(switchCall?.params).toEqual([{ chainId: "0xf22f" }]);
  });

  it("adds the chain when the wallet reports it as unknown (4902)", async () => {
    const { provider, calls } = makeWallet({ chainId: "0x1" });
    // unknown chain → switch fails with 4902 → fall back to wallet_addEthereumChain
    const original = provider.request;
    provider.request = async (args) => {
      if (args.method === "wallet_switchEthereumChain") {
        calls.push({ method: args.method, params: args.params });
        const err = new Error("Unrecognized chain ID") as Error & { code: number };
        err.code = 4902;
        throw err;
      }
      return original(args);
    };
    (globalThis as { window?: unknown }).window = { ethereum: provider };

    await ensureWalletOnNetwork(provider);

    expect(calls.some((c) => c.method === "wallet_addEthereumChain")).toBe(true);
  });
});
