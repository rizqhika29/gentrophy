from conftest import (
    ARTICLE_RUBRIC,
    ONE_GEN,
    create_bounty,
    submit_work,
)


def test_open_bounties_listing(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    create_bounty(
        contract,
        direct_vm,
        direct_alice,
        title="Second bounty",
        task_type="feature",
        rubric=ARTICLE_RUBRIC,
    )
    submit_work(contract, direct_vm, direct_bob, 0)

    open_bounties = contract.get_open_bounties()
    assert len(open_bounties) == 1
    assert open_bounties[0]["bounty_id"] == 1
    assert open_bounties[0]["title"] == "Second bounty"
    assert open_bounties[0]["reward_wei"] == ONE_GEN


def test_get_bounty_unknown_reverts(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/gentrophy.py")
    with direct_vm.expect_revert("Bounty not found"):
        contract.get_bounty(42)


def test_stats_after_two_creates(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    create_bounty(contract, direct_vm, direct_alice)

    stats = contract.get_stats()
    assert stats["total_created"] == 2
    assert stats["next_id"] == 2
    assert stats["total_paid_wei"] == 0
