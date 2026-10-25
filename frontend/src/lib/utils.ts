import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(addr: string, chars = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, 2 + chars)}…${addr.slice(-chars)}`;
}

export function formatGen(wei: bigint | string | number): string {
  const w = BigInt(wei);
  const whole = w / 10n ** 18n;
  const frac = w % 10n ** 18n;
  if (frac === 0n) return `${whole} GEN`;
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "").slice(0, 4);
  return `${whole}.${fracStr} GEN`;
}

export function parseGenToWei(input: string): bigint {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Amount is required");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("Invalid GEN amount");
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(fracPadded);
}

export function stripErrorPrefix(message: string): string {
  return message
    .replace(/^\[(EXPECTED|EXTERNAL|TRANSIENT|LLM_ERROR)\]\s*/, "")
    .trim();
}

const REJECTED_RE = /user rejected|user denied|rejected the request/i;

/**
 * Best-effort message extraction from nested error shapes (viem, fetch,
 * JSON-RPC `{error:{message}}`, contract receipts, `cause` chains).
 * Returns null when nothing readable is found.
 */
function messageFrom(err: unknown, depth = 0): string | null {
  if (err == null || depth > 4) return null;
  if (typeof err === "string") return err.trim() || null;
  if (typeof err !== "object") return null;

  const e = err as Record<string, unknown>;
  for (const key of ["shortMessage", "message", "details", "error", "cause", "data", "inner", "originalError"]) {
    const value = e[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value != null && typeof value === "object") {
      const nested = messageFrom(value, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

function fallbackText(err: unknown): string {
  if (typeof err !== "object" || err === null) return String(err);
  try {
    const json = JSON.stringify(err);
    if (json && json !== "{}") return json;
  } catch {
    // circular / non-serializable — fall through
  }
  return "";
}

export function extractErrorMessage(err: unknown): string {
  if (err == null) return "Unknown error";
  const raw = messageFrom(err) ?? fallbackText(err);
  if (!raw || raw === "[object Object]" || raw === "{}") return "Unknown error";
  if (REJECTED_RE.test(raw)) return "Transaction rejected in wallet.";
  // "execution reverted: [EXPECTED] …" (viem) → drop the wrapper, keep the tag
  const tagged = raw.match(
    /^(?:execution reverted|reverted|contract call|vm execution|vm error)[:\s]+(\[[A-Z_]+\]\s*.+)$/i,
  );
  return stripErrorPrefix(tagged ? tagged[1] : raw);
}
