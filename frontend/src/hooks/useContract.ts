import { useCallback, useEffect, useRef, useState } from "react";
import { CONTRACT_ADDRESS, EXPLORER_TX } from "@/lib/config";
import {
  isSuccessTx,
  summarizeConsensus,
  txStatusName,
  ensureWalletOnNetwork,
  waitForDecision,
  waitForFinalization,
  writeContractAutoFee,
  type TxHash,
} from "@/lib/genlayer";
import { extractErrorMessage } from "@/lib/utils";
import type {
  Bounty,
  ConsensusSummary,
  OpenBounty,
  Stats,
  TxPhase,
} from "@/lib/types";
import { useWallet } from "./useWallet";

export function useStats() {
  const { readClient } = useWallet();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Promise callbacks (not async/await) keep every setState behind an async
  // boundary, so the mount effect never sets state synchronously.
  const fetchAndSet = useCallback(() => {
    readClient
      .readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_stats",
        args: [],
      })
      .then((raw: Stats) => {
        setStats({
          total_created: Number(raw.total_created ?? 0),
          total_paid_wei: String(raw.total_paid_wei ?? "0"),
          next_id: Number(raw.next_id ?? 0),
        });
        setError(null);
      })
      .catch((err: unknown) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [readClient]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    void fetchAndSet();
  }, [fetchAndSet]);

  useEffect(() => {
    void fetchAndSet();
  }, [fetchAndSet]);

  return { stats, loading, error, refresh };
}

export function useOpenBounties() {
  const { readClient } = useWallet();
  const [bounties, setBounties] = useState<OpenBounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAndSet = useCallback(() => {
    readClient
      .readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_open_bounties",
        args: [],
      })
      .then((raw: OpenBounty[]) => {
        setBounties(
          (raw ?? []).map((b) => ({
            ...b,
            bounty_id: Number(b.bounty_id),
            min_score: Number(b.min_score),
            reward_wei: String(b.reward_wei),
            deadline: Number(b.deadline),
          })),
        );
        setError(null);
      })
      .catch((err: unknown) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [readClient]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    void fetchAndSet();
  }, [fetchAndSet]);

  useEffect(() => {
    void fetchAndSet();
  }, [fetchAndSet]);

  return { bounties, loading, error, refresh };
}

export function useBounty(bountyId: number | null) {
  const { readClient } = useWallet();
  const [fetched, setFetched] = useState<Bounty | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAndSet = useCallback(() => {
    if (bountyId == null) return;
    readClient
      .readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_bounty",
        args: [BigInt(bountyId)],
      })
      .then((raw: Bounty) => {
        setFetched({
          ...raw,
          bounty_id: Number(raw.bounty_id),
          min_score: Number(raw.min_score),
          reward_wei: String(raw.reward_wei),
          deadline: Number(raw.deadline),
          score: Number(raw.score),
        });
        setError(null);
      })
      .catch((err: unknown) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [readClient, bountyId]);

  const refresh = useCallback(() => {
    if (bountyId == null) return;
    setLoading(true);
    setError(null);
    void fetchAndSet();
  }, [fetchAndSet, bountyId]);

  useEffect(() => {
    void fetchAndSet();
  }, [fetchAndSet]);

  return { bounty: bountyId == null ? null : fetched, loading, error, refresh };
}

export interface TxProgress {
  phase: TxPhase;
  txHash?: string;
  message?: string;
  consensus?: ConsensusSummary | null;
  statusLine?: string;
  explorerUrl?: string;
}

const idleProgress: TxProgress = { phase: "idle" };

/**
 * Shared write runner with:
 * - single-flight lock (double-click safe)
 * - two-phase error model (pre-txId vs post-txId)
 * - decision tracking with consensus summary
 */
export function useTxRunner() {
  const { writeClient, wrongNetwork, address, provider } = useWallet();
  const [progress, setProgress] = useState<TxProgress>(idleProgress);
  const lockRef = useRef(false);

  const busy =
    progress.phase !== "idle" &&
    progress.phase !== "error" &&
    progress.phase !== "deciding";

  const run = useCallback(
    async (opts: {
      functionName: string;
      args: unknown[];
      value?: bigint;
      successTitle: string;
      successDesc?: string;
      onDone?: () => void;
    }) => {
      if (lockRef.current) return;
      if (!writeClient || !address) {
        setProgress({
          phase: "error",
          message: "Connect your wallet first.",
        });
        return;
      }
      if (wrongNetwork) {
        setProgress({
          phase: "error",
          message: "Wrong network — switch to GenLayer Studionet (chain 61999).",
        });
        return;
      }

      lockRef.current = true;
      let txHash: TxHash | undefined;
      try {
        setProgress({ phase: "estimating", message: "Preparing transaction…" });
        if (provider) await ensureWalletOnNetwork(provider);

        setProgress({ phase: "signing", message: "Confirm in your wallet…" });
        txHash = await writeContractAutoFee(writeClient as never, {
          address: CONTRACT_ADDRESS,
          functionName: opts.functionName,
          args: opts.args,
          ...(opts.value != null && opts.value > 0n ? { value: opts.value } : {}),
        });

        setProgress({
          phase: "submitted",
          txHash,
          message: "Transaction submitted — waiting for decision…",
          explorerUrl: EXPLORER_TX(txHash),
        });

        const decided = await waitForDecision(writeClient as never, txHash);

        const consensus = summarizeConsensus(decided);
        const statusLine = txStatusName(decided);
        const ok = isSuccessTx(decided);

        if (!ok) {
          setProgress({
            phase: "error",
            txHash,
            explorerUrl: EXPLORER_TX(txHash),
            statusLine,
            consensus,
            message: `Execution failed (${statusLine}). Check the receipt before retrying.`,
          });
          return;
        }

        setProgress({
          phase: "deciding",
          txHash,
          explorerUrl: EXPLORER_TX(txHash),
          statusLine,
          consensus,
          message: "Accepted — GEN transfer finalizes after the appeal window.",
        });

        // best-effort finalization wait (non-blocking for UI decision already shown)
        void (async () => {
          try {
            await waitForFinalization(writeClient as never, txHash);
            setProgress((p) =>
              p.txHash === txHash
                ? {
                    ...p,
                    phase: "finalized",
                    message: "Finalized — settlement complete.",
                  }
                : p,
            );
          } catch {
            // keep decided state; finalization can complete later
          }
        })();

        opts.onDone?.();
        return { ok: true as const, txHash, statusLine, consensus, message: opts.successTitle };
      } catch (err) {
        // Phase A: no txId — safe to retry after fix
        if (!txHash) {
          setProgress({
            phase: "error",
            message: extractErrorMessage(err),
          });
          return { ok: false as const, phase: "pre-submit" as const, error: extractErrorMessage(err) };
        }
        // Phase B: txId exists — do not blind-retry
        setProgress({
          phase: "error",
          txHash,
          explorerUrl: EXPLORER_TX(txHash),
          message: `${extractErrorMessage(err)} — tx ${txHash.slice(0, 10)}… was already submitted; tracking only.`,
        });
        return { ok: false as const, phase: "post-submit" as const, error: extractErrorMessage(err) };
      } finally {
        lockRef.current = false;
      }
    },
    [writeClient, address, wrongNetwork, provider],
  );

  const reset = useCallback(() => setProgress(idleProgress), []);

  return { run, progress, reset, busy };
}
