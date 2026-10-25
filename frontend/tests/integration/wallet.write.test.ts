import { execFileSync } from "node:child_process";
import path from "node:path";
import { createAccount, generatePrivateKey } from "genlayer-js";
import { afterEach, describe, expect, it } from "vitest";
import { CONTRACT_ADDRESS } from "@/lib/config";
import {
  createReadClient,
  createWriteClient,
  ensureWalletOnNetwork,
  isSuccessTx,
  summarizeConsensus,
  txStatusName,
  waitForDecision,
  writeContractAutoFee,
} from "@/lib/genlayer";
import type { Eip1193Provider } from "@/lib/wallet";

/**
 * Exercises the path a real browser wallet takes: genlayer-js routes
 * `eth_sendTransaction` through an EIP-1193 provider instead of signing locally.
 * The provider here is a thin shim that signs with a throwaway key, so the
 * encoding, the receipt shape and `ensureWalletOnNetwork` behave exactly as
 * they do behind MetaMask — without a snap, which is what the write path used
 * to depend on and why every Create Bounty click failed.
 */

const REWARD = 500_000_000_000_000_000n;
const RUBRIC =
  "Article must explain GenLayer optimistic democracy clearly, " +
  "include at least one concrete example, and be at least 500 words.";

function fund(address: string): void {
  execFileSync(
    "cmd",
    ["/c", "genlayer", "account", "send", address, "1gen"],
    { cwd: path.resolve(process.cwd(), ".."), stdio: "pipe", encoding: "utf8" },
  );
}

function makeWalletProvider(local: ReturnType<typeof createAccount>) {
  const requested: string[] = [];
  const rpc = async (method: string, params: unknown[] = []) => {
    const res = await fetch("https://studio.genlayer.com/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    });
    const json = (await res.json()) as { result?: unknown; error?: { message: string } };
    if (json.error) throw new Error(json.error.message);
    return json.result;
  };

  const provider: Eip1193Provider = {
    request: async ({ method, params = [] }) => {
      requested.push(method);
      if (method === "eth_chainId") return "0xf22f";
      if (method === "eth_accounts" || method === "eth_requestAccounts") {
        return [local.address];
      }
      if (method === "eth_sendTransaction") {
        const p = (params as Array<Record<string, string>>)[0];
        const gasPrice = p.gasPrice ?? String(await rpc("eth_gasPrice"));
        const serialized = await local.signTransaction({
          account: local,
          to: p.to as `0x${string}`,
          data: p.data,
          value: BigInt(p.value),
          gas: BigInt(p.gas),
          gasPrice: BigInt(gasPrice),
          nonce: Number(BigInt(p.nonce)),
          chainId: 61999,
          type: "legacy",
        });
        return rpc("eth_sendRawTransaction", [serialized]);
      }
      // A real wallet would reject Snap APIs; the write path must never ask.
      if (method.startsWith("wallet_")) {
        const err = new Error(
          `The method ${method} does not exist/is not available.`,
        ) as Error & { code: number };
        err.code = -32601;
        throw err;
      }
      return rpc(method, params);
    },
  };
  return { provider, requested };
}

interface StatsRaw {
  next_id: number | string;
}

const originalWindow = (globalThis as { window?: unknown }).window;

afterEach(() => {
  if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as { window?: unknown }).window = originalWindow;
});

describe("wallet (EIP-1193) write path <-> contract (Studionet)", () => {
  it(
    "prepares the wallet, creates a bounty with escrow, reads it back, cancels + refunds",
    async () => {
      const local = createAccount(generatePrivateKey());
      fund(local.address);

      const { provider, requested } = makeWalletProvider(local);
      (globalThis as { window?: unknown }).window = { ethereum: provider };
      const writeClient = createWriteClient(local.address, provider);
      const readClient = createReadClient();

      // 1) pre-tx guard from useTxRunner — must not need Snap APIs
      await expect(ensureWalletOnNetwork(provider)).resolves.toBeUndefined();
      expect(requested.every((m) => !m.startsWith("wallet_requestSnaps"))).toBe(true);

      const statsBefore = (await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_stats",
        args: [],
      })) as StatsRaw;
      const newId = Number(statsBefore.next_id);

      // 2) create through the exact frontend write helper + wallet signing
      const hash = await writeContractAutoFee(writeClient, {
        address: CONTRACT_ADDRESS,
        functionName: "create_bounty",
        args: [
          "Wallet-path integration bounty",
          "article",
          RUBRIC,
          BigInt(70),
          BigInt(2_000_000_000),
        ],
        value: REWARD,
      });
      expect(hash).toMatch(/^0x[0-9a-fA-F]{64}$/);

      const receipt = await waitForDecision(writeClient as never, hash);
      expect(isSuccessTx(receipt)).toBe(true);
      expect(txStatusName(receipt)).toContain("ACCEPTED");
      expect(summarizeConsensus(receipt)?.votes.length ?? 0).toBeGreaterThan(0);

      // 3) read back the way the hooks do
      const bounty = (await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_bounty",
        args: [BigInt(newId)],
      })) as Record<string, unknown>;
      expect(bounty.status).toBe("open");
      expect(String(bounty.reward_wei)).toBe(REWARD.toString());
      expect(String(bounty.poster).toLowerCase()).toBe(local.address.toLowerCase());

      // 4) cleanup — poster cancels, escrow comes back
      const cancelHash = await writeContractAutoFee(writeClient, {
        address: CONTRACT_ADDRESS,
        functionName: "cancel_bounty",
        args: [BigInt(newId)],
        value: 0n,
      });
      const cancelReceipt = await waitForDecision(writeClient as never, cancelHash);
      expect(isSuccessTx(cancelReceipt)).toBe(true);

      const refunded = (await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_bounty",
        args: [BigInt(newId)],
      })) as Record<string, unknown>;
      expect(refunded.status).toBe("refunded");
    },
    420_000,
  );
});
