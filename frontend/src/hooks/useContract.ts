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
  // The record is keyed by the id that produced it: a record for another id is
  // simply treated as absent, so a stale bounty (and its status/actions) is
  // never rendered under a new selection — without a setState-in-effect reset.
  const [state, setState] = useState<{
    id: number | null;
    data: Bounty | null;
    error: string | null;
    done: boolean;
  }>({ id: null, data: null, error: null, done: false });
  const activeIdRef = useRef<number | null>(null);

  const fetchAndSet = useCallback(() => {
    if (bountyId == null) return;
    const id = bountyId;
    activeIdRef.current = id;
    readClient
      .readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_bounty",
        args: [BigInt(id)],
      })
      .then((raw: Bounty) => {
        if (activeIdRef.current !== id) return; // superseded by another selection
        setState({
          id,
          data: {
            ...raw,
            bounty_id: Number(raw.bounty_id),
            min_score: Number(raw.min_score),
            reward_wei: String(raw.reward_wei),
            deadline: Number(raw.deadline),
            score: Number(raw.score),
          },
          error: null,
          done: true,
        });
      })
      .catch((err: unknown) => {
        if (activeIdRef.current !== id) return;
        setState({ id, data: null, error: extractErrorMessage(err), done: true });
      });
  }, [readClient, bountyId]);

  const refresh = useCallback(() => {
    if (bountyId == null) return;
    setState((prev) =>
      prev.id === bountyId
        ? { ...prev, error: null, done: false }
        : { id: bountyId, data: null, error: null, done: false },
    );
    void fetchAndSet();
  }, [fetchAndSet, bountyId]);

  useEffect(() => {
    void fetchAndSet();
  }, [fetchAndSet]);

  const current = state.id === bountyId;
  return {
    bounty: bountyId == null || !current ? null : state.data,
    loading: bountyId != null && !current ? true : bountyId != null && !state.done,
    error: bountyId == null || !current ? null : state.error,
    refresh,
  };
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
 *
 * `run` ALWAYS resolves with a TxRunResult — never `undefined` — so callers can
 * show the real reason instead of a generic "Unknown error".
 */
export type TxRunResult =
  | {
      ok: true;
      txHash: TxHash;
      statusLine?: string;
      consensus: ConsensusSummary | null;
      message: string;
    }
  | {
      ok: false;
      phase: "pre-submit" | "post-submit";
      error: string;
      txHash?: TxHash;
      statusLine?: string;
      consensus?: ConsensusSummary | null;
    };

export function useTxRunner() {
  const { writeClient, wrongNetwork, address, provider } = useWallet();
  const [progress, setProgress] = useState<TxProgress>(idleProgress);
  const lockRef = useRef(false);

  // "deciding" = decision already shown, and "finalized" = terminal success —
  // neither may keep buttons disabled (a stuck phase used to freeze a panel).
  const busy =
    progress.phase !== "idle" &&
    progress.phase !== "error" &&
    progress.phase !== "deciding" &&
    progress.phase !== "finalized";

  const run = useCallback(
    async (opts: {
      functionName: string;
      args: unknown[];
      value?: bigint;
      successTitle: string;
      successDesc?: string;
      onDone?: () => void;
    }): Promise<TxRunResult> => {
      if (lockRef.current) {
        return {
          ok: false as const,
          phase: "pre-submit" as const,
          error: "A transaction is already in flight — wait for it to finish.",
        };
      }
      if (!writeClient || !address) {
        const message = "Connect your wallet first.";
        setProgress({ phase: "error", message });
        return { ok: false as const, phase: "pre-submit" as const, error: message };
      }
      if (wrongNetwork) {
        const message = "Wrong network — switch to GenLayer Studionet (chain 61999).";
        setProgress({ phase: "error", message });
        return { ok: false as const, phase: "pre-submit" as const, error: message };
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
          // A contract guard / execution error. The on-chain reason lives in the
          // leader receipt — surface it instead of a generic "Unknown error".
          const reason = consensus?.leader_error
            ? extractErrorMessage(consensus.leader_error)
            : `Execution failed (${statusLine}). Check the receipt before retrying.`;
          setProgress({
            phase: "error",
            txHash,
            explorerUrl: EXPLORER_TX(txHash),
            statusLine,
            consensus,
            message: reason,
          });
          return {
            ok: false as const,
            phase: "post-submit" as const,
            error: reason,
            txHash,
            statusLine,
            consensus,
          };
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
        return {
          ok: false as const,
          phase: "post-submit" as const,
          error: extractErrorMessage(err),
          txHash,
        };
      } finally {
        lockRef.current = false;
      }
    },
    [writeClient, address, wrongNetwork, provider],
  );

  const reset = useCallback(() => setProgress(idleProgress), []);

  return { run, progress, reset, busy };
}
