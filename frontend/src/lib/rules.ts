import type { BountyStatus } from "./types";

/**
 * Pure, testable rules the UI enforces on top of the contract.
 *
 * The contract cannot read a clock (GenVM has no block timestamp primitive),
 * so `deadline` is enforced by this module — the UI copy promises exactly that
 * ("the interface blocks late submissions"). Keeping the rules here means they
 * are unit-tested instead of re-derived inline in JSX.
 */

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** Deadline 0 means "no deadline" (the contract only rejects 0 at creation). */
export function isPastDeadline(deadline: number, at = nowSec()): boolean {
  if (!Number.isFinite(deadline) || deadline <= 0) return false;
  return at > deadline;
}

/** Why the submit-work form is unavailable — `null` means it is available. */
export type SubmitWorkBlock = "closed" | "poster" | "expired";

export function submitWorkBlock(
  bounty: { status: BountyStatus; poster: string; deadline: number },
  address: string | null,
  at = nowSec(),
): SubmitWorkBlock | null {
  if (bounty.status !== "open") return "closed";
  if (address && bounty.poster.toLowerCase() === address.toLowerCase()) return "poster";
  if (isPastDeadline(bounty.deadline, at)) return "expired";
  return null;
}

/** Post-bounty deadline validation for the create form. */
export function validateDeadline(value: string, at = nowSec()): string | null {
  const ts = Number(value);
  if (!value || !Number.isFinite(ts) || ts <= 0) {
    return "Deadline must be a unix timestamp > 0";
  }
  if (ts <= at) return "Deadline must be in the future";
  return null;
}
