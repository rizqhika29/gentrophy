import { useState } from "react";
import { BountyBoard } from "@/components/BountyBoard";
import { BountyDetail } from "@/components/BountyDetail";
import { CreateBountyForm } from "@/components/CreateBountyForm";
import { StatsStrip } from "@/components/StatsStrip";
import { useOpenBounties } from "@/hooks/useContract";

export function AppPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { bounties, loading, error, refresh } = useOpenBounties();

  return (
    <div className="pb-10">
      <div className="mx-auto w-full max-w-6xl px-4 pt-10">
        <p className="text-xs uppercase tracking-[0.25em] text-primary">dApp</p>
        <h1 className="mt-2 text-3xl font-bold">Bounty Board</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Live open bounties on Studionet. Select one to submit work, run AI
          review, cancel, or reclaim — or post your own below.
        </p>
      </div>

      <div className="mt-8 space-y-8">
        <StatsStrip />
        <BountyBoard
          bounties={bounties}
          loading={loading}
          error={error}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRefresh={refresh}
        />
        <section className="mx-auto w-full max-w-4xl px-4">
          {selectedId != null ? (
            <div className="mb-8">
              <BountyDetail bountyId={selectedId} onClose={() => setSelectedId(null)} />
            </div>
          ) : null}
          <CreateBountyForm onCreated={refresh} />
        </section>
      </div>
    </div>
  );
}
