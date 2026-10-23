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

/** Read-only client — no wallet, safe for views. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createReadClient(): any {
  return createClient({ chain: getChain() });
}

/** Write client — signs via EIP-1193 provider. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createWriteClient(
  address: `0x${string}`,
  provider: Eip1193Provider,
): any {
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
  txExecutionResultName?: string;
  resultName?: string;
  status?: string | number;
  result?: number;
  consensus_data?: {
    final?: boolean;
    leader_receipt?: Array<{
      mode?: string;
      execution_result?: string;
      vote?: string;
      error?: string | null;
    }>;
    validators?: Record<string, unknown>[];
    votes?: Record<string, string>;
  };
  numOfRounds?: string;
  lastLeader?: string;
}

export function isSuccessTx(tx: unknown): boolean {
  const r = tx as ReceiptLike | null;
  if (!r) return false;
  const status = r.statusName ?? String(r.status ?? "");
  const decidedOk = status === "ACCEPTED" || status === "FINALIZED" || isDecidedState(status);
  const exec = r.txExecutionResultName;
  if (exec) {
    return decidedOk && exec === ExecutionResult.FINISHED_WITH_RETURN;
  }
  return decidedOk && r.resultName !== TransactionResult.FAILURE;
}

export function summarizeConsensus(tx: unknown): ConsensusSummary | null {
  const raw = tx as ReceiptLike | null;
  if (!raw?.consensus_data) return null;
  const votes = Object.entries(raw.consensus_data.votes ?? {}).map(
    ([address, vote]) => ({ address, vote: String(vote) }),
  );
  const leaderReceipt = (raw.consensus_data.leader_receipt ?? []).find(
    (r) => r.mode === "leader",
  );
  return {
    result_name: raw.resultName,
    num_rounds: raw.numOfRounds,
    leader: raw.lastLeader,
    votes,
    leader_execution: leaderReceipt?.execution_result,
    leader_error: leaderReceipt?.error ?? null,
  };
}

export function txStatusName(tx: unknown): string {
  const t = tx as ReceiptLike | null;
  if (!t) return "UNKNOWN";
  return [t.statusName, t.txExecutionResultName].filter(Boolean).join(" / ");
}

/** Wait until the tx is decided (ACCEPTED family), returning the receipt. */
export async function waitForDecision(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  hash: `0x${string}`,
): Promise<unknown> {
  return client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED });
}

/** Wait until FINALIZED settlement. */
export async function waitForFinalization(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  hash: `0x${string}`,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  call: WriteCall,
): Promise<`0x${string}`> {
  return client.writeContract({
    address: call.address,
    functionName: call.functionName,
    ...(call.args ? { args: call.args } : {}),
    value: call.value ?? 0n,
  });
}
