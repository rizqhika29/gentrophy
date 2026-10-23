import json

CONTRACT_PATH = "contracts/gentrophy.py"

ONE_GEN = 10**18

ARTICLE_URL = "https://example.com/article/hello-world"
REPO_URL = "https://github.com/example/feature-repo"

ARTICLE_RUBRIC = (
    "Article must explain GenLayer optimistic democracy clearly, "
    "include at least one concrete example, and be at least 500 words."
)
FEATURE_RUBRIC = (
    "Feature repo must include a working implementation, a README with setup steps, "
    "and tests covering the main code path."
)


def addr_str(addr) -> str:
    if isinstance(addr, (bytes, bytearray)):
        return "0x" + bytes(addr).hex()
    return str(addr)


def mock_web_ok(direct_vm, url: str = ARTICLE_URL, body: str = "Sample fetched work content."):
    direct_vm.mock_web(
        rf".*{url.replace('https://', '').replace('/', '.')}.*",
        {"status": 200, "body": body.encode("utf-8")},
    )


def mock_llm_score(direct_vm, score: int, feedback: str = "Meets the rubric well."):
    direct_vm.mock_llm(
        r".*impartial AI reviewer.*",
        json.dumps({"score": score, "feedback": feedback}),
    )


def create_bounty(
    contract,
    direct_vm,
    sender,
    *,
    title="Write an article about GenLayer",
    task_type="article",
    rubric=ARTICLE_RUBRIC,
    min_score=70,
    deadline=2_000_000_000,
    value=ONE_GEN,
):
    direct_vm.sender = sender
    direct_vm.value = value
    return contract.create_bounty(title, task_type, rubric, min_score, deadline)


def submit_work(contract, direct_vm, sender, bounty_id: int, url: str = ARTICLE_URL):
    direct_vm.sender = sender
    direct_vm.value = 0
    contract.submit_work(bounty_id, url)


def review_work(contract, direct_vm, sender, bounty_id: int):
    direct_vm.sender = sender
    direct_vm.value = 0
    contract.review_work(bounty_id)
