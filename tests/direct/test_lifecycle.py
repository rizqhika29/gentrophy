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


def test_create_and_read(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/gentrophy.py")

    bounty_id = create_bounty(contract, direct_vm, direct_alice)
    assert int(bounty_id) == 0

    bounty = contract.get_bounty(0)
    assert bounty["title"] == "Write an article about GenLayer"
    assert bounty["task_type"] == "article"
    assert bounty["min_score"] == 70
    assert bounty["reward_wei"] == ONE_GEN
    assert bounty["status"] == "open"
    assert bounty["score"] == 0
    assert bounty["work_url"] == ""

    stats = contract.get_stats()
    assert stats["total_created"] == 1
    assert stats["next_id"] == 1
    assert stats["total_paid_wei"] == 0


def test_submit_work_happy_path(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)

    submit_work(contract, direct_vm, direct_bob, 0, ARTICLE_URL)

    bounty = contract.get_bounty(0)
    assert bounty["status"] == "submitted"
    assert bounty["solver"].lower() == addr_str(direct_bob).lower()
    assert bounty["work_url"] == ARTICLE_URL


def test_full_lifecycle_pass_pays_solver(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.clear_mocks()
    mock_web_ok(direct_vm)
    mock_llm_score(direct_vm, score=85, feedback="Clear article with a strong example.")

    review_work(contract, direct_vm, direct_alice, 0)

    bounty = contract.get_bounty(0)
    assert bounty["status"] == "paid"
    assert bounty["score"] == 85
    assert "strong example" in bounty["feedback"]

    stats = contract.get_stats()
    assert stats["total_paid_wei"] == ONE_GEN


def test_full_lifecycle_fail_keeps_escrow(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.clear_mocks()
    mock_web_ok(direct_vm)
    mock_llm_score(direct_vm, score=30, feedback="Too shallow and misses key points.")

    review_work(contract, direct_vm, direct_alice, 0)

    bounty = contract.get_bounty(0)
    assert bounty["status"] == "failed"
    assert bounty["score"] == 30

    stats = contract.get_stats()
    assert stats["total_paid_wei"] == 0


def test_score_clamped_to_bounds(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.clear_mocks()
    mock_web_ok(direct_vm)
    mock_llm_score(direct_vm, score=150)

    review_work(contract, direct_vm, direct_alice, 0)
    assert contract.get_bounty(0)["score"] == 100


def test_multiple_bounties_ids_increment(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/gentrophy.py")
    bid0 = create_bounty(contract, direct_vm, direct_alice)
    bid1 = create_bounty(
        contract,
        direct_vm,
        direct_alice,
        title="Develop a feature",
        task_type="feature",
        rubric=ARTICLE_RUBRIC,
    )
    assert int(bid0) == 0
    assert int(bid1) == 1

    submit_work(contract, direct_vm, direct_bob, 1, "https://github.com/x/y")

    assert contract.get_bounty(0)["status"] == "open"
    assert contract.get_bounty(1)["status"] == "submitted"
    assert contract.get_bounty(1)["task_type"] == "feature"
