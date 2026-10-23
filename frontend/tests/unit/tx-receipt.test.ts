import { describe, expect, it } from "vitest";
import {
  ExecutionResult,
  TransactionResult,
  isSuccessTx,
  summarizeConsensus,
  txStatusName,
} from "@/lib/genlayer";

/** Shape observed from real Studionet receipts (snake_case fields). */
const successReceipt = {
  status: 5,
  status_name: "ACCEPTED",
  result: 6,
  result_name: "MAJORITY_AGREE",
  consensus_data: {
    final: true,
    leader_receipt: [
      {
        mode: "leader",
        execution_result: "SUCCESS",
        vote: null,
        error: null,
        result: { status: "return", payload: { readable: "9" } },
      },
      {
        mode: "validator",
        execution_result: "SUCCESS",
        vote: "agree",
        error: null,
      },
    ],
    validators: [{ address: "0xValidator1" }],
    votes: { "0xValidator1": "agree", "0xValidator2": "agree" },
  },
  num_of_rounds: "1",
  last_leader: "0xValidator1",
};

/** Consensus-accepted but execution rolled back (e.g. value=0 guard). */
const rejectedExecutionReceipt = {
  status: 5,
  status_name: "ACCEPTED",
  result: 6,
  result_name: "MAJORITY_AGREE",
  consensus_data: {
    leader_receipt: [
      {
        mode: "leader",
        execution_result: "ERROR",
        vote: null,
        error: null,
        result: {
          status: "rollback",
          payload: "[EXPECTED] Must send GEN as the bounty reward",
        },
      },
      { mode: "validator", execution_result: "ERROR", vote: "agree" },
    ],
    votes: { "0xValidator1": "agree" },
  },
  num_of_rounds: "1",
  last_leader: "0xValidator1",
};

describe("receipt interpretation (frontend decision logic)", () => {
  it("accepts an ACCEPTED receipt with SUCCESS execution", () => {
    expect(isSuccessTx(successReceipt)).toBe(true);
  });

  it("rejects an ACCEPTED receipt whose execution rolled back", () => {
    expect(isSuccessTx(rejectedExecutionReceipt)).toBe(false);
  });

  it("rejects null and undecided receipts", () => {
    expect(isSuccessTx(null)).toBe(false);
    expect(isSuccessTx({ status_name: "PENDING" })).toBe(false);
  });

  it("supports legacy camelCase receipt fields", () => {
    expect(
      isSuccessTx({
        statusName: "ACCEPTED",
        txExecutionResultName: ExecutionResult.FINISHED_WITH_RETURN,
      }),
    ).toBe(true);
    expect(
      isSuccessTx({
        statusName: "ACCEPTED",
        txExecutionResultName: ExecutionResult.FINISHED_WITH_ERROR,
      }),
    ).toBe(false);
  });

  it("falls back to TransactionResult when no exec info is present", () => {
    expect(
      isSuccessTx({
        status_name: "ACCEPTED",
        result_name: TransactionResult.FAILURE,
      }),
    ).toBe(false);
    expect(
      isSuccessTx({
        status_name: "ACCEPTED",
        result_name: "MAJORITY_AGREE",
        consensus_data: { leader_receipt: [] },
      }),
    ).toBe(true);
  });

  it("summarizes consensus votes, leader execution and rollback payload", () => {
    const summary = summarizeConsensus(successReceipt);
    expect(summary).not.toBeNull();
    expect(summary!.votes).toHaveLength(2);
    expect(summary!.votes[0]).toEqual({
      address: "0xValidator1",
      vote: "agree",
    });
    expect(summary!.leader_execution).toBe("SUCCESS");
    expect(summary!.leader_error).toBeNull();
    expect(summary!.leader).toBe("0xValidator1");
    expect(summary!.num_rounds).toBe("1");
    expect(summary!.result_name).toBe("MAJORITY_AGREE");

    const failed = summarizeConsensus(rejectedExecutionReceipt);
    expect(failed!.leader_execution).toBe("ERROR");
    expect(failed!.leader_error).toBe(
      "[EXPECTED] Must send GEN as the bounty reward",
    );
  });

  it("returns null summary without consensus data", () => {
    expect(summarizeConsensus(null)).toBeNull();
    expect(summarizeConsensus({ status_name: "ACCEPTED" })).toBeNull();
  });

  it("renders a status line from receipt fields", () => {
    expect(txStatusName(successReceipt)).toBe("ACCEPTED / SUCCESS");
    expect(txStatusName(rejectedExecutionReceipt)).toBe("ACCEPTED / ERROR");
    expect(txStatusName(null)).toBe("UNKNOWN");
  });
});
