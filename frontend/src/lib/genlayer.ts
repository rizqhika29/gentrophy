import { createClient } from "genlayer-js";
import { studionet, localnet, testnetBradbury, testnetAsimov } from "genlayer-js/chains";
import {
  TransactionStatus,
  TransactionResult,
  ExecutionResult,
  isDecidedState,
} from "genlayer-js/types";
import type { Eip1193Provider } from "./wallet";
import { NETWORK } from "./config";
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

export async function ensureWalletOnNetwork(provider: Eip1193Provider): Promise<void> {
  const client = createClient({
    chain: getChain(),
    account: "0x0000000000000000000000000000000000000001" as `0x${string}`,
    provider: provider as never,
  });
  await client.connect(NETWORK);
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

/** Wait until the tx is decided (ACCEPTED family), returning the receipt. */
export async function waitForDecision(
  client: GLClient,
  hash: TxHash,
): Promise<unknown> {
  return client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED });
}

/** Wait until FINALIZED settlement. */
export async function waitForFinalization(
  client: GLClient,
  hash: TxHash,
): Promise<unknown> {
  return client.waitForTransactionReceipt({ hash, status: TransactionStatus.FINALIZED });
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
