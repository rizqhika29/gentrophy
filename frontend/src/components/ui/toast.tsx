import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info" | "pending";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
}

interface ToastApi {
  push: (t: Omit<ToastItem, "id">) => number;
  dismiss: (id: number) => void;
  success: (title: string, description?: string, href?: string) => number;
  error: (title: string, description?: string) => number;
  info: (title: string, description?: string) => number;
  update: (id: number, t: Partial<Omit<ToastItem, "id">>) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = idRef.current++;
    setItems((prev) => [...prev.slice(-4), { ...t, id }]);
    if (t.kind !== "pending") {
      window.setTimeout(() => dismiss(id), 6000);
    }
    return id;
  }, [dismiss]);

  const update = useCallback((id: number, patch: Partial<Omit<ToastItem, "id">>) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      dismiss,
      update,
      success: (title, description, href) =>
        push({ kind: "success", title, description, href, hrefLabel: "View tx" }),
      error: (title, description) => push({ kind: "error", title, description }),
      info: (title, description) => push({ kind: "info", title, description }),
    }),
    [push, dismiss, update],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-lg border bg-card p-4 shadow-xl",
              t.kind === "success" && "border-success/50",
              t.kind === "error" && "border-destructive/50",
              t.kind === "info" && "border-border",
              t.kind === "pending" && "border-primary/50",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    t.kind === "success" && "text-success",
                    t.kind === "error" && "text-destructive",
                    t.kind === "pending" && "text-primary",
                  )}
                >
                  {t.kind === "pending" && (
                    <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent align-[-2px]" />
                  )}
                  {t.title}
                </p>
                {t.description ? (
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {t.description}
                  </p>
                ) : null}
                {t.href ? (
                  <a
                    href={t.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs text-primary underline-offset-2 hover:underline"
                  >
                    {t.hrefLabel ?? "Explorer"} →
                  </a>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Dismiss toast"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
