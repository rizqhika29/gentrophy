export type TaskType = "article" | "feature";

export type BountyStatus =
  | "open"
  | "submitted"
  | "reviewing"
  | "paid"
  | "failed"
  | "refunded";

export interface Bounty {
  bounty_id: number;
  poster: string;
  title: string;
  task_type: TaskType;
  rubric: string;
  min_score: number;
  reward_wei: string;
  deadline: number;
  status: BountyStatus;
  solver: string;
  work_url: string;
  score: number;
  feedback: string;
}

export interface OpenBounty {
  bounty_id: number;
  poster: string;
  title: string;
  task_type: TaskType;
  rubric: string;
  min_score: number;
  reward_wei: string;
  deadline: number;
}

export interface Stats {
  total_created: number;
  total_paid_wei: string;
  next_id: number;
}

export interface ValidatorVoteView {
  address?: string;
  vote: string;
  mode?: string;
  execution_result?: string;
}

export interface ConsensusSummary {
  result_name?: string;
  num_rounds?: string;
  leader?: string;
  votes: { address: string; vote: string }[];
  leader_execution?: string;
  leader_error?: string | null;
}

export type TxPhase =
  | "idle"
  | "estimating"
  | "signing"
  | "submitted"
  | "deciding"
  | "finalized"
  | "error";
