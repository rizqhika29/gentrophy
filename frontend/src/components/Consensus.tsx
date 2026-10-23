import { Badge } from "@/components/ui/primitives";
import { cn, shortAddress } from "@/lib/utils";
import { EXPLORER_TX } from "@/lib/config";
import type { ConsensusSummary } from "@/lib/types";

function voteTone(vote: string): string {
  const v = vote.toLowerCase();
  if (v === "agree") return "border-success/50 bg-success/10 text-success";
  if (v === "disagree" || v === "disagreen") return "border-destructive/50 bg-destructive/10 text-destructive";
  return "border-border bg-muted/40 text-muted-foreground";
}

export function ConsensusPanel({
  consensus,
  statusLine,
  txHash,
  explorerUrl,
}: {
  consensus?: ConsensusSummary | null;
  statusLine?: string;
  txHash?: string;
  explorerUrl?: string;
}) {
  if (!consensus && !statusLine && !txHash) return null;

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 text-left">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        AI Consensus
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {statusLine ? (
          <Badge className="border-primary/40 text-primary">{statusLine}</Badge>
        ) : null}
        {consensus?.result_name ? (
          <Badge className="border-success/40 text-success">{consensus.result_name}</Badge>
        ) : null}
        {consensus?.num_rounds ? (
          <span className="text-muted-foreground">rounds: {consensus.num_rounds}</span>
        ) : null}
        {consensus?.leader ? (
          <span className="text-muted-foreground">
            leader: <span className="font-mono">{shortAddress(consensus.leader)}</span>
          </span>
        ) : null}
      </div>

      {consensus?.votes?.length ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] text-muted-foreground">Validator votes</p>
          <div className="flex flex-wrap gap-1.5">
            {consensus.votes.map((v) => (
              <span
                key={v.address}
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px]",
                  voteTone(v.vote),
                )}
                title={v.address}
              >
                {shortAddress(v.address, 3)} · {v.vote}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {consensus?.leader_execution ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          leader execution:{" "}
          <span
            className={cn(
              consensus.leader_execution === "SUCCESS" ? "text-success" : "text-destructive",
            )}
          >
            {consensus.leader_execution}
          </span>
        </p>
      ) : null}
      {consensus?.leader_error ? (
        <pre className="mt-1 max-h-24 overflow-auto rounded bg-background/60 p-2 text-[10px] text-destructive/90">
          {consensus.leader_error}
        </pre>
      ) : null}

      {txHash ? (
        <a
          href={explorerUrl || EXPLORER_TX(txHash)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block font-mono text-[11px] text-primary hover:underline"
        >
          {txHash.slice(0, 18)}… → explorer
        </a>
      ) : null}
    </div>
  );
}

export function ScoreBar({
  score,
  minScore,
}: {
  score: number;
  minScore: number;
}) {
  const passed = score >= minScore;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs text-muted-foreground">
        <span>
          score{" "}
          <span
            className={cn(
              "font-mono text-2xl font-bold",
              passed ? "text-success" : "text-destructive",
            )}
          >
            {score}
          </span>
          <span className="text-muted-foreground">/100</span>
        </span>
        <span>threshold {minScore}</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            passed ? "bg-success" : "bg-destructive",
          )}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-primary"
          style={{ left: `${Math.min(100, Math.max(0, minScore))}%` }}
          title={`min_score ${minScore}`}
        />
      </div>
    </div>
  );
}
