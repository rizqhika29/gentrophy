import { AlertTriangle, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { ConsensusPanel } from "@/components/Consensus";
import { cn } from "@/lib/utils";
import type { TxProgress as TxProgressState } from "@/hooks/useContract";
import type { TxPhase } from "@/lib/types";

const PHASE_LABEL: Record<TxPhase, string> = {
  idle: "",
  estimating: "Preparing",
  signing: "Waiting for wallet",
  submitted: "Submitted",
  deciding: "Decision reached",
  finalized: "Finalized",
  error: "Failed",
};

/**
 * Renders the write runner's progress state. The runner used to track phases,
 * explorer links and the consensus summary that no component ever read —
 * failures showed up as a bare "Unknown error" with no receipt to inspect.
 */
export function TxProgress({ progress }: { progress: TxProgressState }) {
  if (progress.phase === "idle") return null;

  const isError = progress.phase === "error";
  const isDone = progress.phase === "finalized" || progress.phase === "deciding";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-md border p-3 text-xs",
        isError
          ? "border-destructive/40 bg-destructive/5"
          : isDone
            ? "border-success/40 bg-success/5"
            : "border-primary/40 bg-primary/5",
      )}
    >
      <p
        className={cn(
          "flex items-start gap-2 font-medium",
          isError ? "text-destructive" : isDone ? "text-success" : "text-primary",
        )}
      >
        {isError ? (
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
        ) : isDone ? (
          <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />
        ) : (
          <Loader2 className="mt-px h-3.5 w-3.5 shrink-0 animate-spin" />
        )}
        <span>
          {PHASE_LABEL[progress.phase]}
          {progress.message ? ` — ${progress.message}` : ""}
        </span>
      </p>

      {progress.statusLine ? (
        <p className="mt-1 pl-5.5 text-muted-foreground">
          receipt: <span className="font-mono">{progress.statusLine}</span>
        </p>
      ) : null}

      {progress.explorerUrl ? (
        <a
          href={progress.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 pl-5.5 text-primary underline-offset-2 hover:underline"
        >
          view transaction <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}

      {progress.consensus ? (
        <div className="mt-2">
          <ConsensusPanel
            consensus={progress.consensus}
            statusLine={progress.statusLine}
            txHash={progress.txHash}
            explorerUrl={progress.explorerUrl}
          />
        </div>
      ) : null}
    </div>
  );
}
