from conftest import (
    ARTICLE_RUBRIC,
    ARTICLE_URL,
    ONE_GEN,
    create_bounty,
    submit_work,
)


def test_create_requires_value(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/gentrophy.py")
    direct_vm.sender = direct_alice
    direct_vm.value = 0
    with direct_vm.expect_revert("Must send GEN as the bounty reward"):
        contract.create_bounty("t", "article", ARTICLE_RUBRIC, 70, 2_000_000_000)


def test_create_rejects_empty_title(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/gentrophy.py")
    direct_vm.sender = direct_alice
    direct_vm.value = ONE_GEN
    with direct_vm.expect_revert("Title cannot be empty"):
        contract.create_bounty("   ", "article", ARTICLE_RUBRIC, 70, 2_000_000_000)


def test_create_rejects_bad_task_type(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/gentrophy.py")
    direct_vm.sender = direct_alice
    direct_vm.value = ONE_GEN
    with direct_vm.expect_revert("task_type must be"):
        contract.create_bounty("title", "meme", ARTICLE_RUBRIC, 70, 2_000_000_000)


def test_create_rejects_short_rubric(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/gentrophy.py")
    direct_vm.sender = direct_alice
    direct_vm.value = ONE_GEN
    with direct_vm.expect_revert("Rubric must be at least 20"):
        contract.create_bounty("title", "article", "short", 70, 2_000_000_000)


def test_create_rejects_min_score_over_100(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/gentrophy.py")
    direct_vm.sender = direct_alice
    direct_vm.value = ONE_GEN
    with direct_vm.expect_revert("min_score must be between 0 and 100"):
        contract.create_bounty("title", "article", ARTICLE_RUBRIC, 101, 2_000_000_000)


def test_create_rejects_zero_deadline(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/gentrophy.py")
    direct_vm.sender = direct_alice
    direct_vm.value = ONE_GEN
    with direct_vm.expect_revert("Deadline must be greater than zero"):
        contract.create_bounty("title", "article", ARTICLE_RUBRIC, 70, 0)


def test_submit_unknown_bounty(direct_vm, direct_deploy, direct_bob):
    contract = direct_deploy("contracts/gentrophy.py")
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Bounty not found"):
        contract.submit_work(99, ARTICLE_URL)


def test_poster_cannot_solve_own_bounty(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Poster cannot solve own bounty"):
        contract.submit_work(0, ARTICLE_URL)


def test_submit_rejects_non_http_url(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("work_url must start with http"):
        contract.submit_work(0, "ftp://not-supported")


def test_cannot_submit_twice(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy("contracts/gentrophy.py")
    create_bounty(contract, direct_vm, direct_alice)
    submit_work(contract, direct_vm, direct_bob, 0)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Bounty is not open for submissions"):
        contract.submit_work(0, ARTICLE_URL)
