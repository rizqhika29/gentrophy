"""End-to-end test of every GenTrophy contract method on Studionet.

Not a pytest module (network-dependent): run directly —

    python tests/e2e_studionet.py

Covers: create_bounty (payable, incl. value=0 guard), submit_work,
review_work (happy-path payout + dead-URL escape path), poster_retract,
cancel_bounty, reclaim_after_fail, all views, and on-chain state guards.
Funds the throwaway poster key from the active genlayer CLI account.
"""

import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "py_shims"))

from eth_account import Account  # noqa: E402

from genlayer_py import create_client  # noqa: E402
from genlayer_py.chains import studionet  # noqa: E402

CONTRACT = "0x2C02539A051F62007254abFdFcF0982f0Fa4e7Ec"
GEN = 10**18
REWARD = GEN // 2  # 0.5 GEN per bounty
DEAD_URL = "https://dead.example.invalid/x"
LIVE_URL = "https://example.com/"
RUBRIC = (
    "Article must explain GenLayer optimistic democracy clearly, "
    "include at least one concrete example, and be at least 500 words."
)

poster = Account.create()
solver = Account.create()

client = create_client(chain=studionet, account=poster)

results: list[tuple[str, bool, str]] = []


def step(name: str, ok: bool, detail: str = "") -> bool:
    results.append((name, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))
    return ok


def submit(fn: str, args=None, value: int = 0, account=None):
    return client.write_contract(
        CONTRACT, fn, account=account or poster, value=value, args=args or []
    )


def wait(tx, retries: int = 60):
    return client.wait_for_transaction_receipt(tx, retries=retries, interval=3000)


def w(fn: str, args=None, value: int = 0, account=None, retries: int = 60):
    tx = submit(fn, args=args, value=value, account=account)
    return tx, wait(tx, retries)


def read(fn: str, args=None):
    return client.read_contract(CONTRACT, fn, args=args or [])


def tx_exec_failed(receipt) -> bool:
    data = getattr(receipt, "data", None)
    consensus = getattr(data, "consensus_data", None) if data else None
    leader = getattr(consensus, "leader_receipt", None) if consensus else None
    if leader:
        first = leader[0]
        if str(getattr(first, "execution_result", "")) == "ERROR":
            return True
    result_name = str(getattr(receipt, "result_name", ""))
    return result_name in ("FAILED", "ERROR")


def expect_state(label: str, bounty_id: int, want_status: str, **want) -> bool:
    b = read("get_bounty", [bounty_id])
    problems = []
    if b["status"] != want_status:
        problems.append(f"status={b['status']!r} want {want_status!r}")
    for k, v in want.items():
        if b.get(k) != v:
            problems.append(f"{k}={b.get(k)!r} want {v!r}")
    return step(label, not problems, "; ".join(problems))


def expect_revert(
    label: str, fn: str, args=None, value: int = 0, account=None, state_ok=None
) -> bool:
    """A guard passes when the tx executes as an error AND state stayed put.

    genlayer_py raises while parsing failed-execution receipts, so either an
    ERROR receipt or a wait exception counts as observed failure - then the
    optional state_ok() check confirms nothing actually changed on-chain.
    """
    try:
        tx = submit(fn, args=args, value=value, account=account)
    except Exception as e:  # noqa: BLE001
        return step(label, False, f"submit failed: {type(e).__name__}: {e}")
    reverted = False
    detail = ""
    try:
        receipt = wait(tx)
        reverted = tx_exec_failed(receipt)
        if not reverted:
            detail = f"tx {tx.hex()[:18]} executed OK - no revert"
    except Exception as e:  # noqa: BLE001
        reverted = True
        detail = f"wait raised {type(e).__name__}: {str(e)[:100]}"
    if reverted and state_ok is not None:
        try:
            if not state_ok():
                reverted = False
                detail = (detail + "; " if detail else "") + "STATE CHANGED"
        except Exception as e:  # noqa: BLE001
            reverted = False
            detail = f"state check error: {e}"
    return step(label, reverted, detail)


def balance(addr: str) -> int:
    from web3 import Web3

    return client.get_balance(Web3.to_checksum_address(addr))


def balance_eventually(addr: str, target: int, attempts: int = 40, interval: float = 5.0) -> int:
    """get_balance lags right after consensus (observed 0.0 GEN on fresh
    payouts); poll until the balance reaches target or attempts run out."""
    last = balance(addr)
    for _ in range(attempts):
        if last >= target:
            return last
        time.sleep(interval)
        last = balance(addr)
    return last


def main() -> int:
    print(f"poster: {poster.address}")
    print(f"solver: {solver.address}")

    stats0 = read("get_stats")
    base = int(stats0["next_id"])
    paid0 = int(stats0["total_paid_wei"])
    print(f"baseline stats: {stats0}")

    # fund poster (rewards + buffer) from the active CLI account
    subprocess.run(
        ["cmd", "/c", "genlayer", "account", "send", poster.address, "2gen"],
        check=True, cwd=os.getcwd(), stdout=sys.stdout, stderr=sys.stderr,
    )
    time.sleep(5)
    bal = balance(poster.address)
    step("fund poster", bal >= 2 * GEN, f"balance={bal / GEN} GEN")

    # --- create_bounty (payable) -------------------------------------------
    ids = {}
    for name in ("A", "B", "C"):
        min_score = 0 if name == "A" else 70
        w(
            "create_bounty",
            [
                f"E2E bounty {name} — GenLayer article",
                "article",
                RUBRIC,
                min_score,
                2_000_000_000,
            ],
            value=REWARD,
        )
        ids[name] = int(read("get_stats")["next_id"]) - 1
    open_list = read("get_open_bounties")
    open_ids = {int(o["bounty_id"]) for o in open_list}
    step(
        "create_bounty x3 (0.5 GEN each) + get_open_bounties",
        all(ids[k] in open_ids for k in ids) and open_list,
        f"ids={ids} open={sorted(open_ids)}",
    )

    # payable guard: zero reward rejected
    expect_revert(
        "create_bounty value=0 reverts",
        "create_bounty",
        ["Zero reward", "article", RUBRIC, 70, 2_000_000_000],
        value=0,
        state_ok=lambda: int(read("get_stats")["next_id"]) == base + 3,
    )

    # --- submit_work (solver) ----------------------------------------------
    w("submit_work", [ids["A"], LIVE_URL], account=solver)
    w("submit_work", [ids["B"], DEAD_URL], account=solver)
    w("submit_work", [ids["C"], LIVE_URL], account=solver)
    step(
        "submit_work x3 by solver",
        all(read("get_bounty", [ids[k]])["status"] == "submitted" for k in ids),
        "A/B/C submitted",
    )

    # state-machine guards on-chain (each verified: error + state unchanged)
    expect_revert(
        "poster cannot submit own bounty",
        "submit_work",
        [ids["A"], LIVE_URL],
        state_ok=lambda: read("get_bounty", [ids["A"]])["status"] == "submitted",
    )
    expect_revert(
        "cancel while submitted reverts",
        "cancel_bounty",
        [ids["B"]],
        state_ok=lambda: read("get_bounty", [ids["B"]])["status"] == "submitted",
    )
    expect_revert("review unknown bounty reverts", "review_work", [ids["C"] + 1000])

    # --- review A: happy path payout (min_score=0) --------------------------
    solver_bal_before = balance(solver.address)
    paid_before = int(read("get_stats")["total_paid_wei"])
    ok_review = False
    for attempt in (1, 2, 3):
        try:
            w("review_work", [ids["A"]], retries=90)
        except Exception as e:  # noqa: BLE001
            print(f"  review A attempt {attempt} raised: {e}")
            continue
        b = read("get_bounty", [ids["A"]])
        if b["status"] == "paid":
            ok_review = True
            break
        print(f"  review A attempt {attempt}: status={b['status']}")
    stats = read("get_stats")
    paid_delta = int(stats["total_paid_wei"]) - paid_before
    solver_delta = balance_eventually(solver.address, solver_bal_before + REWARD) - solver_bal_before
    step(
        "review_work A -> paid + payout accounting",
        ok_review and paid_delta == REWARD and solver_delta == REWARD,
        f"status={read('get_bounty', [ids['A']])['status']} "
        f"total_paid_delta={paid_delta / GEN} solver_delta={solver_delta / GEN}",
    )

    # paid is terminal
    expect_revert(
        "re-review paid bounty reverts",
        "review_work",
        [ids["A"]],
        state_ok=lambda: read("get_bounty", [ids["A"]])["status"] == "paid",
    )
    expect_revert(
        "cancel paid bounty reverts",
        "cancel_bounty",
        [ids["A"]],
        state_ok=lambda: read("get_bounty", [ids["A"]])["status"] == "paid",
    )

    # --- review B: dead URL -> failed -> reclaim (escape path) ----------------
    ok_failed = False
    for attempt in (1, 2, 3):
        try:
            w("review_work", [ids["B"]], retries=90)
        except Exception as e:  # noqa: BLE001
            print(f"  review B attempt {attempt} raised: {e}")
            continue
        b = read("get_bounty", [ids["B"]])
        if b["status"] == "failed":
            ok_failed = True
            break
        print(f"  review B attempt {attempt}: status={b['status']} score={b['score']}")
    bB = read("get_bounty", [ids["B"]])
    step(
        "review_work B (dead URL) -> failed, escrow exits",
        ok_failed and bB["score"] == 0,
        f"status={bB['status']} score={bB['score']} feedback={bB['feedback'][:60]!r}",
    )

    poster_bal_before = balance(poster.address)
    w("reclaim_after_fail", [ids["B"]])
    bB = read("get_bounty", [ids["B"]])
    got = balance_eventually(poster.address, poster_bal_before + REWARD) - poster_bal_before
    step(
        "reclaim_after_fail B -> refunded",
        bB["status"] == "refunded" and got == REWARD,
        f"status={bB['status']} refund={got / GEN} GEN",
    )

    # --- poster_retract -> open -> cancel ------------------------------------
    w("poster_retract", [ids["C"]])
    bC = read("get_bounty", [ids["C"]])
    open_ids = {int(o["bounty_id"]) for o in read("get_open_bounties")}
    step(
        "poster_retract C -> open + listed again",
        bC["status"] == "open"
        and int(bC["solver"], 16) == 0
        and bC["work_url"] == ""
        and ids["C"] in open_ids,
        f"status={bC['status']} url={bC['work_url']!r}",
    )

    poster_bal_before = balance(poster.address)
    w("cancel_bounty", [ids["C"]])
    bC = read("get_bounty", [ids["C"]])
    got = balance_eventually(poster.address, poster_bal_before + REWARD) - poster_bal_before
    stats = read("get_stats")
    step(
        "cancel_bounty C -> refunded; final stats",
        bC["status"] == "refunded"
        and got == REWARD
        and int(stats["total_created"]) == base + 3
        and int(stats["total_paid_wei"]) == paid0 + REWARD,
        f"status={bC['status']} refund={got / GEN} stats={stats}",
    )

    # --- summary ------------------------------------------------------------
    failed = [r for r in results if not r[1]]
    print(f"\n==== {len(results) - len(failed)}/{len(results)} checks passed ====")
    for name, _, detail in failed:
        print(f"  FAILED: {name} — {detail}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
