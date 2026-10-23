import { Card, CardContent } from "@/components/ui/primitives";
import { Loader2 } from "lucide-react";
import { useStats } from "@/hooks/useContract";
import { formatGen } from "@/lib/utils";

export function StatsStrip() {
  const { stats, loading, error, refresh } = useStats();
  return (
    <section className="mx-auto w-full max-w-4xl px-4">
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Total bounties
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-foreground">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                stats?.total_created ?? 0
              )}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Total paid
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-primary">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : stats ? (
                formatGen(stats.total_paid_wei)
              ) : (
                "0 GEN"
              )}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Next bounty id
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-foreground">
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                stats?.next_id ?? "—"
              )}
            </p>
          </div>
          {error ? (
            <p className="col-span-2 text-xs text-destructive sm:col-span-3">{error}</p>
          ) : null}
          <button
            type="button"
            onClick={() => void refresh()}
            className="col-span-2 justify-self-start text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline sm:col-span-3"
          >
            refresh stats
          </button>
        </CardContent>
      </Card>
    </section>
  );
}
