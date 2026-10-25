import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForDecision, waitForFinalization } from "@/lib/genlayer";

type Call = { status: string; retries?: number; interval?: number };

function makeClient(impl: (opts: Call) => Promise<unknown>) {
  const calls: Call[] = [];
  const client = {
    waitForTransactionReceipt: vi.fn((opts: Call) => {
      calls.push(opts);
      return impl(opts);
    }),
  };
  return { client: client as never, calls };
}

function rateLimitError() {
  const err = new Error("Request failed with status code 429: Too Many Requests");
  (err as Error & { code?: number }).code = 429;
  return err;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("decision wait", () => {
  it("polls long enough for a real Studionet decision (5 min, not the SDK default 30s)", async () => {
    const { client, calls } = makeClient(async () => ({ status_name: "ACCEPTED" }));
    await waitForDecision(client, "0xabc");
    expect(calls).toHaveLength(1);
    expect(calls[0].retries).toBe(100);
    expect(calls[0].interval).toBe(3000);
  });

  it("does not retry non-rate-limit failures", async () => {
    const { client, calls } = makeClient(async () => {
      throw new Error("Request timed out");
    });
    await expect(waitForDecision(client, "0xabc")).rejects.toThrow(/timed out/);
    expect(calls).toHaveLength(1);
  });

  it("retries a 429 after the backoff instead of failing the transaction", async () => {
    vi.useFakeTimers();
    let attempt = 0;
    const { client, calls } = makeClient(async () => {
      attempt += 1;
      if (attempt === 1) throw rateLimitError();
      return { status_name: "ACCEPTED" };
    });

    const pending = waitForDecision(client, "0xabc");
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(pending).resolves.toEqual({ status_name: "ACCEPTED" });
    expect(calls).toHaveLength(2);
  });
});

describe("finalization wait", () => {
  it("covers the observed ACCEPTED → FINALIZED window (~34s) instead of the 30s SDK default", async () => {
    const { client, calls } = makeClient(async () => ({ status_name: "FINALIZED" }));
    await waitForFinalization(client, "0xabc");
    expect(calls).toHaveLength(1);
    expect(calls[0].retries).toBe(40);
    expect(calls[0].interval).toBe(5000);
    expect(40 * 5000).toBeGreaterThanOrEqual(200_000);
  });
});
