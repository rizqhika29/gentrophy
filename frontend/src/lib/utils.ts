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

export function extractErrorMessage(err: unknown): string {
  if (err == null) return "Unknown error";
  if (typeof err === "string") return stripErrorPrefix(err);
  if (err instanceof Error) {
    const anyErr = err as Error & {
      shortMessage?: string;
      details?: string;
      message?: string;
    };
    const raw = anyErr.shortMessage || anyErr.details || anyErr.message || err.message;
    if (/user rejected|user denied|rejected the request/i.test(raw)) {
      return "Transaction rejected in wallet.";
    }
    return stripErrorPrefix(raw);
  }
  return stripErrorPrefix(String(err));
}
