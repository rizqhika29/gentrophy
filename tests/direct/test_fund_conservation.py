from conftest import (
    ARTICLE_RUBRIC,
    ARTICLE_URL,
    ONE_GEN,
    addr_str,
    create_bounty,
    mock_llm_score,
    mock_web_ok,
    review_work,
    submit_work,
)


def _reclaim(contract, direct_vm, sender, bounty_id):
    direct_vm.sender = sender
    contract.reclaim_after_fail(bounty_id)


# ---------------------------------------------------------------------------
# Escape paths (escrow liveness)
# ---------------------------------------------------------------------------


def test_unfetchable_url_settles_failed_and_is_reclaimable(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    """Consensus on unreachable source must NOT strand escrow in submitted."""
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0, "https://dead.example.invalid/x")

    direct_vm.clear_mocks()  # no web mock → fetch fails on leader (and validators)

    review_work(contract, direct_vm, direct_alice, 0)

    bounty = contract.get_bounty(0)
    assert bounty["status"] == "failed"
    assert bounty["score"] == 0
    assert "unavailable" in bounty["feedback"].lower()

    # Escrow has an exit: poster reclaim works.
    _reclaim(contract, direct_vm, direct_alice, 0)
    assert contract.get_bounty(0)["status"] == "refunded"
    assert contract.get_stats()["total_paid_wei"] == 0


def test_unfetchable_url_fails_even_with_min_score_zero(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice, min_score=0)
    submit_work(contract, direct_vm, direct_bob, 0, "https://dead.example.invalid/x")

    direct_vm.clear_mocks()

    review_work(contract, direct_vm, direct_alice, 0)
    bounty = contract.get_bounty(0)
    assert bounty["status"] == "failed"
    assert bounty["score"] == 0
    assert contract.get_stats()["total_paid_wei"] == 0


def test_poster_retract_frees_stuck_submission(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.sender = direct_alice
    contract.poster_retract(0)

    bounty = contract.get_bounty(0)
    assert bounty["status"] == "open"
    assert bounty["work_url"] == ""
    assert int(bounty["solver"], 16) == 0
    assert bounty["score"] == 0
    assert bounty["feedback"] == ""

    # Slot is genuinely free for a new solver.
    submit_work(contract, direct_vm, direct_charlie, 0, ARTICLE_URL)
    bounty = contract.get_bounty(0)
    assert bounty["status"] == "submitted"
    assert bounty["solver"].lower() == addr_str(direct_charlie).lower()

    # Escrow never left the contract during retract.
    assert contract.get_stats()["total_paid_wei"] == 0


def test_retract_only_poster(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the poster can retract"):
        contract.poster_retract(0)


def test_retract_requires_submitted_status(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Can only retract a submitted bounty"):
        contract.poster_retract(0)

    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.clear_mocks()
    mock_web_ok(direct_vm)
    mock_llm_score(direct_vm, score=85)
    review_work(contract, direct_vm, direct_alice, 0)
    assert contract.get_bounty(0)["status"] == "paid"

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Can only retract a submitted bounty"):
        contract.poster_retract(0)


# ---------------------------------------------------------------------------
# One-time settlement guards (fund conservation)
# ---------------------------------------------------------------------------


def test_cannot_cancel_twice(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)

    direct_vm.sender = direct_alice
    contract.cancel_bounty(0)
    assert contract.get_bounty(0)["status"] == "refunded"

    with direct_vm.expect_revert("Can only cancel an open bounty"):
        contract.cancel_bounty(0)


def test_cannot_reclaim_twice(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.clear_mocks()
    mock_web_ok(direct_vm)
    mock_llm_score(direct_vm, score=10)
    review_work(contract, direct_vm, direct_alice, 0)

    _reclaim(contract, direct_vm, direct_alice, 0)
    assert contract.get_bounty(0)["status"] == "refunded"

    with direct_vm.expect_revert("Bounty verdict is not failed"):
        _reclaim(contract, direct_vm, direct_alice, 0)


def test_cannot_cancel_after_reclaim(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.clear_mocks()
    mock_web_ok(direct_vm)
    mock_llm_score(direct_vm, score=10)
    review_work(contract, direct_vm, direct_alice, 0)
    _reclaim(contract, direct_vm, direct_alice, 0)

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Can only cancel an open bounty"):
        contract.cancel_bounty(0)


def test_cannot_cancel_after_failed(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.clear_mocks()
    mock_web_ok(direct_vm)
    mock_llm_score(direct_vm, score=10)
    review_work(contract, direct_vm, direct_alice, 0)
    assert contract.get_bounty(0)["status"] == "failed"

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Can only cancel an open bounty"):
        contract.cancel_bounty(0)


def test_paid_bounty_is_terminal(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.clear_mocks()
    mock_web_ok(direct_vm)
    mock_llm_score(direct_vm, score=90)
    review_work(contract, direct_vm, direct_alice, 0)
    assert contract.get_bounty(0)["status"] == "paid"

    # No cancel, no reclaim, no re-review, no re-submit, no retract.
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Can only cancel an open bounty"):
        contract.cancel_bounty(0)
    with direct_vm.expect_revert("Bounty verdict is not failed"):
        contract.reclaim_after_fail(0)
    with direct_vm.expect_revert("Can only retract a submitted bounty"):
        contract.poster_retract(0)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Bounty has no submitted work to review"):
        contract.review_work(0)
    with direct_vm.expect_revert("Bounty is not open for submissions"):
        contract.submit_work(0, ARTICLE_URL)


def test_review_cannot_run_twice(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.clear_mocks()
    mock_web_ok(direct_vm)
    mock_llm_score(direct_vm, score=85)
    review_work(contract, direct_vm, direct_alice, 0)
    assert contract.get_bounty(0)["status"] == "paid"
    paid_before = contract.get_stats()["total_paid_wei"]
    assert paid_before == ONE_GEN

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Bounty has no submitted work to review"):
        contract.review_work(0)
    assert contract.get_stats()["total_paid_wei"] == paid_before


# ---------------------------------------------------------------------------
# Accounting invariants
# ---------------------------------------------------------------------------


def test_total_paid_equals_sum_of_paid_bounties(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/gentrophy.py")

    # bounty 0: pays 1 GEN
    create_bounty(contract, direct_vm, direct_alice, value=ONE_GEN)
    submit_work(contract, direct_vm, direct_bob, 0)
    direct_vm.clear_mocks()
    mock_web_ok(direct_vm)
    mock_llm_score(direct_vm, score=90)
    review_work(contract, direct_vm, direct_alice, 0)

    # bounty 1: pays 2 GEN
    create_bounty(contract, direct_vm, direct_alice, value=2 * ONE_GEN)
    submit_work(contract, direct_vm, direct_bob, 1)
    direct_vm.clear_mocks()
    mock_web_ok(direct_vm)
    mock_llm_score(direct_vm, score=80)
    review_work(contract, direct_vm, direct_alice, 1)

    # bounty 2: fails (funds reclaimed, never paid)
    create_bounty(contract, direct_vm, direct_alice, value=5 * ONE_GEN)
    submit_work(contract, direct_vm, direct_bob, 2)
    direct_vm.clear_mocks()
    mock_web_ok(direct_vm)
    mock_llm_score(direct_vm, score=5)
    review_work(contract, direct_vm, direct_alice, 2)
    _reclaim(contract, direct_vm, direct_alice, 2)

    stats = contract.get_stats()
    assert stats["total_paid_wei"] == 3 * ONE_GEN
    assert stats["total_created"] == 3

    statuses = [contract.get_bounty(i)["status"] for i in range(3)]
    assert statuses == ["paid", "paid", "refunded"]


def test_failed_then_reclaimed_never_counts_as_paid(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice, value=3 * ONE_GEN)
    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.clear_mocks()
    mock_web_ok(direct_vm)
    mock_llm_score(direct_vm, score=20)
    review_work(contract, direct_vm, direct_alice, 0)

    assert contract.get_stats()["total_paid_wei"] == 0
    _reclaim(contract, direct_vm, direct_alice, 0)
    assert contract.get_stats()["total_paid_wei"] == 0
    assert contract.get_bounty(0)["status"] == "refunded"


def test_cancelled_then_resubmitted_pays_exactly_once(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)

    # First round: griefer submits, poster retracts.
    submit_work(contract, direct_vm, direct_bob, 0)
    direct_vm.sender = direct_alice
    contract.poster_retract(0)

    # Second round: honest solver, review passes → exactly one payout.
    submit_work(contract, direct_vm, direct_charlie, 0, "https://github.com/honest/work")
    direct_vm.clear_mocks()
    mock_web_ok(direct_vm, url="https://github.com/honest/work")
    mock_llm_score(direct_vm, score=95)
    review_work(contract, direct_vm, direct_alice, 0)

    stats = contract.get_stats()
    assert stats["total_paid_wei"] == ONE_GEN
    assert contract.get_bounty(0)["status"] == "paid"


def test_multiple_submissions_cannot_share_one_slot(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)

    # Second solver is locked out while the round is pending.
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Bounty is not open for submissions"):
        contract.submit_work(0, "https://evil.example.com/overwrite")
