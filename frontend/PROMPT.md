# GenTrophy — Frontend Integration Prompt (Improved)

You are building the **GenTrophy** frontend: a trustless AI-judged bounty
review & payout dApp on **GenLayer Studionet**.

## Project identity

- **Name:** GenTrophy
- **Tagline:** "Work that pays. Judged by AI consensus."
- **Contract:** `GenTrophy` (Intelligent Contract, Python/GenVM)
- **Network:** GenLayer Studionet — chainId `61999`, RPC `https://studio.genlayer.com/api`
- **Contract address:** from `VITE_CONTRACT_ADDRESS`
- **Theme:** dark, mono/terminal aesthetic (matches the ASCII tunnel hero),
  gold/amber accent for "trophy" moments (paid verdicts), muted zinc neutrals

## Stack requirements

- Vite + React 19 + TypeScript
- Tailwind CSS (dark mode default via `.dark` class strategy)
- shadcn-style components under `/src/components/ui` (button, card, input,
  label, badge, textarea, select, dialog/sheet, skeleton, sonner-style toast)
- lucide-react for icons
- `genlayer-js` for all contract reads/writes (NOT raw viem writes to the IC)
- No wagmi/RainbowKit — avoid competing EVM wallet connectors

## Hero component

Copy `hero-ascii-tunnel.tsx` (`VanishRun`) into `/src/components/ui/`.
Adapt the demo into `HeroGenTrophy`:

- Headline: "GenTrophy"
- Sub: "Post a bounty. Submit work. AI validators score it. GEN pays automatically."
- CTA: "Explore Bounties" (scroll to board) + "Connect Wallet" (same wallet
  handler as the rest of the app — one source of truth, no duplicate providers)

## Wallet connect rules (critical — do not fight EVM wallets)

1. Detect EIP-1193 providers WITHOUT hijacking `window.ethereum`:
   - If `window.ethereum.providers` exists (multi-wallet: MetaMask + Rabby…),
     pick an explicit preference list (`isMetaMask`, `isRabby`) or let the user
     choose from a dialog.
   - Else use `window.ethereum` if present.
   - Never call `ethereum.request({ method: 'eth_requestAccounts' })` on a
     provider the user did not select.
2. After accounts are available, create TWO genlayer-js clients:
   - `readClient = createClient({ chain: studionet })` — no wallet
   - `writeClient = createClient({ chain: studionet, account, provider })`
3. Before any write: `await writeClient.connect('studionet')` so the wallet is
   on chain 61999 (wallet_switchEthereumChain / wallet_addEthereumChain).
4. Subscribe to `accountsChanged` / `chainChanged`; on disconnect, null out
   writeClient and reset UI state. Do not leave stale accounts.
5. Show wrong-network banner if `chainId !== 61999` and offer "Switch network".

## Contract interactions

Payable create uses `value` (user GEN) SEPARATE from `fees` (protocol fee):

```ts
const call = { address, functionName: 'create_bounty', args: [...], value: rewardWei };
const estimate = await writeClient.estimateTransactionFeesForWrite(call);
const txId = await writeClient.writeContract({
  ...call,
  fees: { distribution: estimate.distribution, feeValue: estimate.feeValue },
});
```

Methods:

| Method | Kind | Args |
|--------|------|------|
| `create_bounty` | payable write | title, task_type, rubric, min_score, deadline |
| `submit_work` | write | bounty_id, work_url |
| `review_work` | write | bounty_id |
| `cancel_bounty` | write | bounty_id |
| `reclaim_after_fail` | write | bounty_id |
| `get_bounty` | view | bounty_id → full dict |
| `get_open_bounties` | view | list of open bounties |
| `get_stats` | view | { total_created, total_paid_wei, next_id } |

## Error / success handling (critical)

1. **Two-phase failures** (from GenLayer docs):
   - Phase A: no `txId` yet → wallet reject, fee estimate fail, user error.
     Safe to fix + retry. Show toast with reason.
   - Phase B: `txId` exists → NEVER blind-retry. Track that hash. Poll
     `waitForDecision` then optional `waitForFinalization`. On
     `!isSuccessful(tx)` show execution error from receipt
     (`statusName` / `txExecutionResultName` / UserError message if present).
2. UserError messages from the contract start with `[EXPECTED]` — strip the
   prefix and show the human message.
3. Success toasts must state lifecycle: "Submitted (ACCEPTED)" vs
   "Finalized — GEN transferred".
4. Every async button: `disabled` while pending + spinner + single-flight lock
   (ignore double-clicks). Reset lock in `finally`.
5. Forms validate client-side before estimate (title/rubric length, URL
   http(s), min_score 0–100, reward > 0 GEN).

## AI consensus result panel (critical UX)

After `review_work` reaches a decision, show:

- **Verdict badge:** PAID (score ≥ min_score) or FAILED
- **Score:** big number + progress bar vs `min_score` threshold marker
- **Feedback:** AI one-liner from contract state
- **Consensus detail** from receipt `consensus_data`:
  - Round count, leader address
  - Per-validator votes: agree / disagree / idle (color-coded)
  - Leader execution result (SUCCESS/ERROR) and any stderr
  - `result_name` (e.g. MAJORITY_AGREE)
- Link to explorer tx
- Note: "GEN payout finalizes after the appeal window (FINALIZED), not at ACCEPTED"

## Button bug checklist

- [ ] No double-submit (in-flight ref lock)
- [ ] Disabled when wallet disconnected
- [ ] Disabled when wrong network
- [ ] Disabled when form invalid
- [ ] Disabled when bounty not in required status (e.g. review only when `submitted`)
- [ ] Fee estimate errors surface before signing popup
- [ ] After txId: button becomes "Tracking…" and does not re-enable until decision
- [ ] All error paths restore button state (finally)

## Layout

1. Hero (VanishRun) full viewport
2. Stats strip (total bounties, total paid GEN)
3. Bounty board (open bounties cards → detail dialog/panel)
4. Create bounty sheet/form
5. Footer: network badge, contract address short, faucet link
   (https://studio.genlayer.com/faucet)

## Env

```
VITE_CONTRACT_ADDRESS=0xcc4dE18AE2C04362fd883034AB2B96EC91a9688A
VITE_NETWORK=studionet
```
