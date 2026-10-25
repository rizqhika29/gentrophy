import { createClient } from "genlayer-js";
import { studionet, localnet, testnetBradbury, testnetAsimov } from "genlayer-js/chains";
import {
  TransactionStatus,
  TransactionResult,
  ExecutionResult,
  isDecidedState,
} from "genlayer-js/types";
import { switchToStudionet, type Eip1193Provider } from "./wallet";
import { CHAIN_ID_DEC, NETWORK } from "./config";
import { extractErrorMessage } from "./utils";
import type { ConsensusSummary } from "./types";

export { TransactionStatus, TransactionResult, ExecutionResult, isDecidedState };

const chains = {
  studionet,
  localnet,
  testnetBradbury,
  testnetAsimov,
} as const;

export function getChain() {
  return chains[NETWORK] ?? studionet;
}

export type GLClient = ReturnType<typeof createClient>;

/** Hash type exactly as the SDK expects it (viem Hash: 32-byte, length 66). */
export type TxHash = Parameters<GLClient["waitForTransactionReceipt"]>[0]["hash"];

/** Read-only client — no wallet, safe for views. */
export function createReadClient(): GLClient {
  return createClient({ chain: getChain() });
}

/** Write client — signs via EIP-1193 provider. */
export function createWriteClient(
  address: `0x${string}`,
  provider: Eip1193Provider,
): GLClient {
  return createClient({
    chain: getChain(),
    account: address,
    provider: provider as never,
  });
}

/**
 * Make sure the wallet is on Studionet before a write.
 *
 * Deliberately does NOT use genlayer-js `client.connect()`: that helper probes
 * MetaMask Snap APIs (`wallet_getSnaps` / `wallet_requestSnaps`) and mutates
 * `window.ethereum` directly. Wallets without Snap support (Rabby, Coinbase,
 * Brave…) reject it with -32601, and MetaMask pops an "install GenLayer snap"
 * dialog the user can decline — either way the write dies in `useTxRunner`
 * before a transaction is ever created, so every call looks like a failure.
 * A chain switch only needs `eth_chainId` + `wallet_switchEthereumChain`.
 */
export async function ensureWalletOnNetwork(provider: Eip1193Provider): Promise<void> {
  const hex = (await provider.request({ method: "eth_chainId" })) as string;
  if (Number.parseInt(hex, 16) === CHAIN_ID_DEC) return;
  await switchToStudionet(provider);
}

interface ReceiptLike {
  statusName?: string;
  status_name?: string;
  txExecutionResultName?: string;
  resultName?: string;
  result_name?: string;
  status?: string | number;
  result?: number;
  consensus_data?: {
    final?: boolean;
    leader_receipt?: Array<{
      mode?: string;
      execution_result?: string;
      vote?: string;
      error?: string | null;
      result?: { status?: string; payload?: unknown };
    }>;
    validators?: Record<string, unknown>[];
    votes?: Record<string, string>;
  };
  numOfRounds?: string;
  num_of_rounds?: string;
  lastLeader?: string;
  last_leader?: string;
}

/**
 * Studionet receipts report execution as SUCCESS/ERROR (runtime vocabulary);
 * the SDK enum also defines FINISHED_WITH_RETURN — accept both.
 */
const SUCCESSFUL_EXECUTIONS = new Set<string>([
  "SUCCESS",
  ExecutionResult.FINISHED_WITH_RETURN,
]);

function leaderReceipt(r: ReceiptLike) {
  return (r.consensus_data?.leader_receipt ?? []).find((e) => e.mode === "leader");
}

export function isSuccessTx(tx: unknown): boolean {
  const r = tx as ReceiptLike | null;
  if (!r) return false;
  const status = r.statusName ?? r.status_name ?? String(r.status ?? "");
  // Fail closed: anything that is not explicitly ACCEPTED/FINALIZED is a
  // failure. `isDecidedState` only matches the numeric form ("5"), so for a
  // named receipt (PENDING, UNDETERMINED, CANCELED, LEADER_TIMEOUT…) it is
  // false — deliberate, those are never a success.
  const decidedOk =
    status === "ACCEPTED" || status === "FINALIZED" || isDecidedState(status);
  const exec = r.txExecutionResultName ?? leaderReceipt(r)?.execution_result;
  if (exec) {
    return decidedOk && SUCCESSFUL_EXECUTIONS.has(exec);
  }
  const resultName = r.resultName ?? r.result_name;
  return decidedOk && resultName !== TransactionResult.FAILURE;
}

export function summarizeConsensus(tx: unknown): ConsensusSummary | null {
  const raw = tx as ReceiptLike | null;
  if (!raw?.consensus_data) return null;
  const votes = Object.entries(raw.consensus_data.votes ?? {}).map(
    ([address, vote]) => ({ address, vote: String(vote) }),
  );
  const leader = leaderReceipt(raw);
  const payload = leader?.result?.payload;
  return {
    result_name: raw.resultName ?? raw.result_name,
    num_rounds: raw.numOfRounds ?? raw.num_of_rounds,
    leader: raw.lastLeader ?? raw.last_leader,
    votes,
    leader_execution: leader?.execution_result,
    leader_error:
      leader?.error ??
      (leader?.result?.status === "rollback" && typeof payload === "string"
        ? payload
        : null),
  };
}

export function txStatusName(tx: unknown): string {
  const t = tx as ReceiptLike | null;
  if (!t) return "UNKNOWN";
  const status = t.statusName ?? t.status_name;
  const exec = t.txExecutionResultName ?? (t ? leaderReceipt(t)?.execution_result : undefined);
  return [status, exec].filter(Boolean).join(" / ");
}

/**
 * SDK default is 10 retries x 3s = 30s, which is shorter than a real Studionet
 * decision under load (LLM-backed writes, appeals, validators warming up). A
 * timeout there surfaces as "execution failed" even though the transaction is
 * still on its way to ACCEPTED — the failure mode users read as "the button is
 * broken". 100 x 3s = 5 min, while the UI keeps showing the tx link.
 */
const DECISION_RETRIES = 100;
const DECISION_INTERVAL_MS = 3_000;

/**
 * Observed ACCEPTED → FINALIZED on Studionet: ~34s (SDK default 10 x 3s = 30s
 * timed out by ~4s, so the "Finalized" state was effectively unreachable).
 * 40 x 5s = 200s covers it and keeps polling well under the 60 req/min limit.
 */
const FINALIZATION_RETRIES = 40;
const FINALIZATION_INTERVAL_MS = 5_000;

/** Studionet allows 60 req/min/IP; the SDK transport has retryCount: 0. */
const RATE_LIMIT_ATTEMPTS = 2;
const RATE_LIMIT_BACKOFF_MS = 15_000;

function isRateLimited(err: unknown): boolean {
  const e = err as { code?: unknown; status?: unknown } | null;
  if (e && (e.code === 429 || e.status === 429 || e.code === -32005)) return true;
  return /429|rate ?limit|too many requests|retry-after|quota exceeded/i.test(
    extractErrorMessage(err),
  );
}

/**
 * A 429 mid-poll would otherwise surface to the user as a failed transaction.
 * Only transient rate-limit errors are retried (never SDK timeouts — those
 * already exhausted their own retry budget with a precise message).
 */
async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= RATE_LIMIT_ATTEMPTS || !isRateLimited(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_BACKOFF_MS));
    }
  }
}

/** Wait until the tx is decided (ACCEPTED family), returning the receipt. */
export async function waitForDecision(
  client: GLClient,
  hash: TxHash,
): Promise<unknown> {
  return withRateLimitRetry(() =>
    client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
      retries: DECISION_RETRIES,
      interval: DECISION_INTERVAL_MS,
    }),
  );
}

/** Wait until FINALIZED settlement (background — failures are non-fatal). */
export async function waitForFinalization(
  client: GLClient,
  hash: TxHash,
): Promise<unknown> {
  return withRateLimitRetry(() =>
    client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.FINALIZED,
      retries: FINALIZATION_RETRIES,
      interval: FINALIZATION_INTERVAL_MS,
    }),
  );
}

export type WriteCall = {
  address: `0x${string}`;
  functionName: string;
  args?: unknown[];
  value?: bigint;
};

/**
 * Write without explicit fee estimate.
 * genlayer-js 1.x derives fee deposits automatically for the active network.
 */
export async function writeContractAutoFee(
  client: GLClient,
  call: WriteCall,
): Promise<TxHash> {
  return client.writeContract({
    address: call.address,
    functionName: call.functionName,
    ...(call.args ? { args: call.args as never } : {}),
    value: call.value ?? 0n,
  });
}
