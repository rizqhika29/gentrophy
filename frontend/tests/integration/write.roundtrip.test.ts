import { execFileSync } from "node:child_process";
import path from "node:path";
import { createAccount, createClient, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { describe, expect, it } from "vitest";
import { CONTRACT_ADDRESS } from "@/lib/config";
import {
  createReadClient,
  isSuccessTx,
  summarizeConsensus,
  txStatusName,
  waitForDecision,
  writeContractAutoFee,
} from "@/lib/genlayer";

const REWARD = 500_000_000_000_000_000n;
const RUBRIC =
  "Article must explain GenLayer optimistic democracy clearly, " +
  "include at least one concrete example, and be at least 500 words.";

function fund(address: string): void {
  execFileSync(
    "cmd",
    ["/c", "genlayer", "account", "send", address, "1gen"],
    {
      cwd: path.resolve(process.cwd(), ".."),
      stdio: "pipe",
      encoding: "utf8",
    },
  );
}

interface StatsRaw {
  next_id: number | string;
}

describe("frontend write path <-> contract (Studionet)", () => {
  it(
    "blocks value=0, creates a bounty with 0.5 GEN, reads it back, cancels + refunds",
    async () => {
      const account = createAccount(generatePrivateKey());
      fund(account.address);

      const writeClient = createClient({ chain: studionet, account });
      const readClient = createReadClient();
      const args = [
        "Frontend integration bounty",
        "article",
        RUBRIC,
        BigInt(70),
        BigInt(2_000_000_000),
      ];

      // 1) payable guard: create_bounty with value=0 must never succeed
      let guardBlocked = false;
      try {
        const guardHash = await writeContractAutoFee(writeClient, {
          address: CONTRACT_ADDRESS,
          functionName: "create_bounty",
          args,
          value: 0n,
        });
        const guardReceipt = await waitForDecision(writeClient, guardHash);
        guardBlocked = !isSuccessTx(guardReceipt);
      } catch {
        guardBlocked = true; // pre-submit rejection counts as blocked
      }
      expect(guardBlocked).toBe(true);

      const statsBefore = (await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_stats",
        args: [],
      })) as StatsRaw;
      const newId = Number(statsBefore.next_id);

      // 2) happy path create through the exact frontend write helper
      const hash = await writeContractAutoFee(writeClient, {
        address: CONTRACT_ADDRESS,
        functionName: "create_bounty",
        args,
        value: REWARD,
      });
      expect(hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
      const receipt = await waitForDecision(writeClient, hash);
      expect(isSuccessTx(receipt)).toBe(true);
      expect(txStatusName(receipt)).toContain("ACCEPTED");
      const summary = summarizeConsensus(receipt);
      expect((summary?.votes.length ?? 0)).toBeGreaterThan(0);

      // 3) read back with the same client call shape the hooks use
      const statsAfter = (await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_stats",
        args: [],
      })) as StatsRaw;
      expect(Number(statsAfter.next_id)).toBe(newId + 1);

      const open = (await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_open_bounties",
        args: [],
      })) as Array<Record<string, unknown>>;
      const row = open.find((b) => Number(b.bounty_id) === newId);
      expect(row).toBeDefined();
      expect(String(row!.reward_wei)).toBe(REWARD.toString());
      expect(Number(row!.min_score)).toBe(70);

      const bounty = (await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_bounty",
        args: [BigInt(newId)],
      })) as Record<string, unknown>;
      expect(bounty.status).toBe("open");
      expect(String(bounty.poster).toLowerCase()).toBe(
        account.address.toLowerCase(),
      );

      // 4) cleanup: poster cancels the open bounty and gets the escrow back
      const cancelHash = await writeContractAutoFee(writeClient, {
        address: CONTRACT_ADDRESS,
        functionName: "cancel_bounty",
        args: [BigInt(newId)],
        value: 0n,
      });
      const cancelReceipt = await waitForDecision(writeClient, cancelHash);
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
