from conftest import (
    ONE_GEN,
    create_bounty,
    submit_work,
)


def test_cancel_open_bounty_refunds_poster(
    direct_vm, direct_deploy, direct_alice
):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)

    direct_vm.sender = direct_alice
    contract.cancel_bounty(0)

    assert contract.get_bounty(0)["status"] == "refunded"


def test_only_poster_can_cancel(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the poster can cancel"):
        contract.cancel_bounty(0)


def test_cannot_cancel_after_submit(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Can only cancel an open bounty"):
        contract.cancel_bounty(0)


def test_reclaim_after_fail(direct_vm, direct_deploy, direct_alice, direct_bob):
    from conftest import mock_llm_score, mock_web_ok, review_work

    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.clear_mocks()
    mock_web_ok(direct_vm)
    mock_llm_score(direct_vm, score=10)
    review_work(contract, direct_vm, direct_alice, 0)
    assert contract.get_bounty(0)["status"] == "failed"

    direct_vm.sender = direct_alice
    contract.reclaim_after_fail(0)
    assert contract.get_bounty(0)["status"] == "refunded"


def test_cannot_reclaim_without_fail(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Bounty verdict is not failed"):
        contract.reclaim_after_fail(0)


def test_reclaim_only_poster(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    from conftest import mock_llm_score, mock_web_ok, review_work

    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)

    direct_vm.clear_mocks()
    mock_web_ok(direct_vm)
    mock_llm_score(direct_vm, score=10)
    review_work(contract, direct_vm, direct_alice, 0)

    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only the poster can reclaim"):
        contract.reclaim_after_fail(0)
