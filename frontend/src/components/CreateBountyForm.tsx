import { useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Card, CardContent } from "@/components/ui/primitives";
import { useTxRunner } from "@/hooks/useContract";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/components/ui/toast";
import { parseGenToWei } from "@/lib/utils";
import type { TaskType } from "@/lib/types";

const DEADLINE_DEFAULT = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;

export function CreateBountyForm({ onCreated }: { onCreated: () => void }) {
  const { address, wrongNetwork } = useWallet();
  const { run, busy } = useTxRunner();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("article");
  const [rubric, setRubric] = useState("");
  const [minScore, setMinScore] = useState("70");
  const [reward, setReward] = useState("1");
  const [deadline, setDeadline] = useState(String(DEADLINE_DEFAULT));
  const [clientError, setClientError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!title.trim()) return "Title is required";
    if (title.trim().length > 200) return "Title max 200 chars";
    if (rubric.trim().length < 20) return "Rubric must be at least 20 characters";
    if (rubric.length > 4000) return "Rubric max 4000 chars";
    const ms = Number(minScore);
    if (!Number.isFinite(ms) || ms < 0 || ms > 100) return "min_score must be 0–100";
    if (!deadline || Number(deadline) <= 0) return "Deadline must be a unix timestamp > 0";
    try {
      const wei = parseGenToWei(reward);
      if (wei <= 0n) return "Reward must be > 0 GEN";
    } catch {
      return "Invalid GEN amount";
    }
    return null;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const v = validate();
    setClientError(v);
    if (v) return;

    let value: bigint;
    try {
      value = parseGenToWei(reward);
    } catch (err) {
      setClientError(String(err));
      return;
    }

    const toastId = toast.push({
      kind: "pending",
      title: "Creating bounty…",
      description: "Estimate → wallet signature → consensus",
    });

    const result = await run({
      functionName: "create_bounty",
      args: [
        title.trim(),
        taskType,
        rubric.trim(),
        BigInt(Math.round(Number(minScore))),
        BigInt(Math.round(Number(deadline))),
      ],
      value,
      successTitle: "Bounty created",
    });

    if (result?.ok) {
      toast.update(toastId, {
        kind: "success",
        title: "Bounty created (ACCEPTED)",
        description: `${result.statusLine ?? ""} — GEN is escrowed until verdict.`,
        href: result.txHash ? `https://genlayer-explorer.vercel.app/tx/${result.txHash}` : undefined,
      });
      setTitle("");
      setRubric("");
      onCreated();
    } else {
      toast.update(toastId, {
        kind: "error",
        title: "Create failed",
        description: result && "error" in result ? result.error : "Unknown error",
      });
    }
  };

  const disabled = !address || wrongNetwork || busy;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Post a Bounty</h2>
        </div>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Write an article about GenLayer"
              maxLength={200}
              disabled={busy}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Task type</Label>
            <div className="flex gap-2">
              {(["article", "feature"] as TaskType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={busy}
                  onClick={() => setTaskType(t)}
                  className={
                    taskType === t
                      ? "rounded-md border border-primary bg-primary/15 px-3 py-1.5 text-xs text-primary"
                      : "rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rubric">Rubric (plain English, min 20 chars)</Label>
            <Textarea
              id="rubric"
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              placeholder="Article must explain X clearly, include a concrete example, and be at least 500 words…"
              rows={4}
              maxLength={4000}
              disabled={busy}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="minScore">min_score (0–100)</Label>
              <Input
                id="minScore"
                type="number"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reward">Reward (GEN)</Label>
              <Input
                id="reward"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                placeholder="1"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deadline">Deadline (unix)</Label>
              <Input
                id="deadline"
                type="number"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          {clientError ? (
            <p className="text-xs text-destructive">{clientError}</p>
          ) : null}
          {!address ? (
            <p className="text-xs text-muted-foreground">Connect wallet to post a bounty.</p>
          ) : null}

          <Button type="submit" className="w-full" disabled={disabled} loading={busy}>
            {busy ? "Working…" : "Create Bounty (escrow GEN)"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
