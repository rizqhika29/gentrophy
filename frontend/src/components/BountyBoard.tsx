import { Trophy, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, Skeleton } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { BountyStatusBadge } from "@/components/BountyDetail";
import { formatGen, shortAddress } from "@/lib/utils";
import type { OpenBounty } from "@/lib/types";

export function BountyBoard({
  bounties,
  loading,
  error,
  selectedId,
  onSelect,
  onRefresh,
}: {
  bounties: OpenBounty[];
  loading: boolean;
  error: string | null;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onRefresh: () => void;
}) {
  return (
    <section id="bounties" className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Trophy className="h-5 w-5 text-primary" /> Open Bounties
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick a bounty → submit work → AI validators score vs rubric.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load bounties: {error}
        </div>
      ) : null}

      {loading && !bounties.length ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !bounties.length ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No open bounties yet. Post one below.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {bounties.map((b) => (
            <li key={b.bounty_id}>
              <button
                type="button"
                onClick={() => onSelect(b.bounty_id)}
                className={
                  selectedId === b.bounty_id
                    ? "block w-full rounded-lg border border-primary/60 bg-card p-4 text-left shadow-sm transition-colors"
                    : "block w-full rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40"
                }
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-muted-foreground">#{b.bounty_id}</span>
                  <BountyStatusBadge status="open" />
                  <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                    {b.task_type}
                  </span>
                  <span className="ml-auto font-medium text-primary">
                    {formatGen(b.reward_wei)}
                  </span>
                </div>
                <p className="mt-2 font-semibold text-foreground">{b.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {b.rubric.slice(0, 140)}
                  {b.rubric.length > 140 ? "…" : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <span>poster {shortAddress(b.poster)}</span>
                  <span>min_score {b.min_score}</span>
                  <span>
                    deadline{" "}
                    {b.deadline
                      ? new Date(b.deadline * 1000).toISOString().slice(0, 10)
                      : "—"}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
