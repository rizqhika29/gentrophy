# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from dataclasses import dataclass

ERROR_EXPECTED = "[EXPECTED]"
ERROR_EXTERNAL = "[EXTERNAL]"
ERROR_TRANSIENT = "[TRANSIENT]"
ERROR_LLM = "[LLM_ERROR]"

MAX_CONTENT_CHARS = 3000
SCORE_TOLERANCE = 10
MIN_RUBRIC_LEN = 20
MAX_TEXT_STORED = 600


@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass


@allow_storage
@dataclass
class Bounty:
    poster: Address
    title: str
    task_type: str
    rubric: str
    min_score: u256
    reward_wei: u256
    deadline: u256
    status: str
    solver: Address
    work_url: str
    score: u256
    feedback: str


def _parse_llm_score(analysis: dict) -> int:
    if not isinstance(analysis, dict):
        raise gl.vm.UserError(f"{ERROR_LLM} Non-dict LLM response: {type(analysis)}")
    raw = analysis.get("score")
    if raw is None:
        for alt in ("rating", "points", "value"):
            if alt in analysis:
                raw = analysis[alt]
                break
    if raw is None:
        raise gl.vm.UserError(f"{ERROR_LLM} Missing 'score' in LLM response")
    try:
        return max(0, min(100, int(round(float(str(raw).strip())))))
    except (ValueError, TypeError):
        raise gl.vm.UserError(f"{ERROR_LLM} Non-numeric score: {raw}")


def _fetch_work_content(url: str) -> str:
    try:
        content = gl.nondet.web.render(url, mode="text")
    except Exception:
        raise gl.vm.UserError(f"{ERROR_EXTERNAL} URL could not be fetched")
    if content is None or len(str(content).strip()) == 0:
        raise gl.vm.UserError(f"{ERROR_EXTERNAL} URL returned empty content")
    return str(content)[:MAX_CONTENT_CHARS]


def _source_unavailable_result(msg: str) -> dict:
    return {
        "ok": False,
        "score": 0,
        "feedback": f"Source unavailable at review: {msg}"[:300],
    }


def _judge_work(task_type: str, rubric: str, url: str, content: str) -> dict:
    if task_type == "article":
        task_desc = (
            "Evaluate the writing quality of this article: clarity, structure, "
            "accuracy, depth, and how well it satisfies the rubric."
        )
    else:
        task_desc = (
            "Evaluate this feature/development deliverable (repository or demo page): "
            "completeness against the spec, code/documentation quality, and how well "
            "it satisfies the rubric."
        )

    prompt = f"""You are an impartial AI reviewer for a trustless bounty platform.

TASK TYPE: {task_type}
{task_desc}

RUBRIC (criteria the work must satisfy):
{rubric}

WORK URL: {url}

FETCHED CONTENT (truncated):
{content}

Score the work from 0 to 100 against the rubric.
Respond with ONLY a JSON object, no markdown, no extra text:
{{"score": <integer 0-100>, "feedback": "<one sentence under 150 characters>"}}

Rules:
- Score 0 if the content is irrelevant, empty, or clearly does not address the task.
- Be strict: 70+ means the work substantively meets the rubric.
- Feedback must be neutral and specific."""

    result = gl.nondet.exec_prompt(prompt, response_format="json")
    score = _parse_llm_score(result)
    feedback = ""
    if isinstance(result, dict):
        feedback = str(result.get("feedback", ""))[:300]
    return {"score": score, "feedback": feedback}


def _leader_fn(task_type: str, rubric: str, url: str) -> dict:
    try:
        content = _fetch_work_content(url)
    except gl.vm.UserError as e:
        msg = e.message if hasattr(e, "message") else str(e)
        if msg.startswith(ERROR_EXTERNAL) or msg.startswith(ERROR_EXPECTED):
            return _source_unavailable_result(msg)
        raise
    return _judge_work(task_type, rubric, url, content)


def _handle_leader_error(leaders_res: gl.vm.Result, task_type: str, rubric: str, url: str) -> bool:
    leader_msg = leaders_res.message if hasattr(leaders_res, "message") else ""
    try:
        _leader_fn(task_type, rubric, url)
        return False
    except gl.vm.UserError as e:
        validator_msg = e.message if hasattr(e, "message") else str(e)
        if validator_msg.startswith(ERROR_EXPECTED) or validator_msg.startswith(ERROR_EXTERNAL):
            return validator_msg == leader_msg
        if validator_msg.startswith(ERROR_TRANSIENT) and str(leader_msg).startswith(ERROR_TRANSIENT):
            return True
        return False
    except Exception:
        return False


class GenTrophy(gl.Contract):
    next_id: u256
    total_created: u256
    total_paid_wei: u256
    bounties: TreeMap[u256, Bounty]

    def __init__(self) -> None:
        self.next_id = u256(0)
        self.total_created = u256(0)
        self.total_paid_wei = u256(0)
        self.bounties = TreeMap()

    @gl.public.write.payable
    def create_bounty(
        self,
        title: str,
        task_type: str,
        rubric: str,
        min_score: u256,
        deadline: u256,
    ) -> u256:
        reward = gl.message.value
        if reward == u256(0):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Must send GEN as the bounty reward")
        if len(title.strip()) == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Title cannot be empty")
        if len(title) > 200:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Title too long (max 200)")
        if task_type not in ("article", "feature"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} task_type must be 'article' or 'feature'")
        if len(rubric.strip()) < MIN_RUBRIC_LEN:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Rubric must be at least {MIN_RUBRIC_LEN} characters")
        if len(rubric) > 4000:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Rubric too long (max 4000)")
        if min_score > u256(100):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} min_score must be between 0 and 100")
        if deadline == u256(0):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Deadline must be greater than zero")

        bounty_id = self.next_id
        self.bounties[bounty_id] = Bounty(
            poster=gl.message.sender_address,
            title=title.strip()[:200],
            task_type=task_type,
            rubric=rubric.strip()[:4000],
            min_score=min_score,
            reward_wei=reward,
            deadline=deadline,
            status="open",
            solver=Address("0x0000000000000000000000000000000000000000"),
            work_url="",
            score=u256(0),
            feedback="",
        )
        self.next_id = self.next_id + u256(1)
        self.total_created = self.total_created + u256(1)
        return bounty_id

    @gl.public.write
    def submit_work(self, bounty_id: u256, work_url: str) -> None:
        if bounty_id not in self.bounties:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Bounty not found")
        bounty = self.bounties[bounty_id]
        if bounty.status != "open":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Bounty is not open for submissions")
        if gl.message.sender_address == bounty.poster:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Poster cannot solve own bounty")
        url = work_url.strip()
        if not (url.startswith("http://") or url.startswith("https://")):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} work_url must start with http:// or https://")
        if len(url) > 500:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} work_url too long (max 500)")

        bounty.solver = gl.message.sender_address
        bounty.work_url = url
        bounty.status = "submitted"

    @gl.public.write
    def review_work(self, bounty_id: u256) -> None:
        if bounty_id not in self.bounties:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Bounty not found")
        bounty = self.bounties[bounty_id]
        if bounty.status != "submitted":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Bounty has no submitted work to review")

        task_type = bounty.task_type
        rubric = bounty.rubric
        url = bounty.work_url
        min_score = int(bounty.min_score)
        reward = bounty.reward_wei
        solver = bounty.solver

        bounty.status = "reviewing"

        def leader_fn() -> dict:
            return _leader_fn(task_type, rubric, url)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return _handle_leader_error(leaders_res, task_type, rubric, url)

            leader_data = leaders_res.calldata
            if not isinstance(leader_data, dict):
                return False

            try:
                mine = _leader_fn(task_type, rubric, url)
            except gl.vm.UserError:
                return False
            except Exception:
                return False

            leader_ok = bool(leader_data.get("ok", True))
            validator_ok = bool(mine.get("ok", True))
            if leader_ok != validator_ok:
                return False
            if not leader_ok:
                # Both sides independently failed to fetch the stored URL:
                # consensus on "source dead" — the terminal failed verdict.
                return True

            leader_score = int(leader_data["score"])
            validator_score = int(mine["score"])

            if (leader_score >= min_score) != (validator_score >= min_score):
                return False
            diff = leader_score - validator_score
            if diff < 0:
                diff = -diff
            if diff > SCORE_TOLERANCE:
                return False
            return True

        try:
            result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        except gl.vm.UserError as e:
            msg = e.message if hasattr(e, "message") else str(e)
            if msg.startswith(ERROR_EXTERNAL):
                # Consensus accepted an unreachable-source error: settle as
                # failed instead of stranding the escrow in "submitted".
                bounty = self.bounties[bounty_id]
                bounty.score = u256(0)
                bounty.feedback = str(_source_unavailable_result(msg)["feedback"])
                bounty.status = "failed"
                return
            raise

        # Validate every consensus-derived value before writing to storage.
        if not isinstance(result, dict):
            raise gl.vm.UserError(f"{ERROR_LLM} Consensus result is not a dict")

        bounty = self.bounties[bounty_id]

        if not bool(result.get("ok", True)):
            # Consensus agreed the stored URL is unreachable: terminal failed
            # verdict (escrow exits via reclaim_after_fail, never a payout —
            # even when min_score is 0).
            bounty.score = u256(0)
            bounty.feedback = str(result.get("feedback", ""))[:MAX_TEXT_STORED]
            bounty.status = "failed"
            return

        if "score" not in result:
            raise gl.vm.UserError(f"{ERROR_LLM} Consensus result missing score")
        try:
            score_int = int(result["score"])
        except (TypeError, ValueError):
            raise gl.vm.UserError(f"{ERROR_LLM} Consensus score is not an integer")
        if score_int < 0 or score_int > 100:
            raise gl.vm.UserError(f"{ERROR_LLM} Consensus score out of range: {score_int}")

        bounty.score = u256(score_int)
        bounty.feedback = str(result.get("feedback", ""))[:MAX_TEXT_STORED]

        if score_int >= min_score:
            bounty.status = "paid"
            self.total_paid_wei = self.total_paid_wei + bounty.reward_wei
            _Recipient(solver).emit_transfer(value=reward)
        else:
            bounty.status = "failed"

    @gl.public.write
    def poster_retract(self, bounty_id: u256) -> None:
        """Unilateral recovery while a submission is pending review.

        Frees a stuck/abusable submission round (dead URL before review,
        griefer slot, inconclusive retry): back to open with escrow intact.
        Honest solvers should trigger review_work immediately after submitting.
        """
        if bounty_id not in self.bounties:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Bounty not found")
        bounty = self.bounties[bounty_id]
        if gl.message.sender_address != bounty.poster:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only the poster can retract")
        if bounty.status != "submitted":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Can only retract a submitted bounty")

        bounty.status = "open"
        bounty.solver = Address("0x0000000000000000000000000000000000000000")
        bounty.work_url = ""
        bounty.score = u256(0)
        bounty.feedback = ""

    @gl.public.write
    def cancel_bounty(self, bounty_id: u256) -> None:
        if bounty_id not in self.bounties:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Bounty not found")
        bounty = self.bounties[bounty_id]
        if gl.message.sender_address != bounty.poster:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only the poster can cancel")
        if bounty.status != "open":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Can only cancel an open bounty")

        bounty.status = "refunded"
        _Recipient(bounty.poster).emit_transfer(value=bounty.reward_wei)

    @gl.public.write
    def reclaim_after_fail(self, bounty_id: u256) -> None:
        if bounty_id not in self.bounties:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Bounty not found")
        bounty = self.bounties[bounty_id]
        if gl.message.sender_address != bounty.poster:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only the poster can reclaim")
        if bounty.status != "failed":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Bounty verdict is not failed")

        bounty.status = "refunded"
        _Recipient(bounty.poster).emit_transfer(value=bounty.reward_wei)

    @gl.public.view
    def get_bounty(self, bounty_id: u256) -> dict:
        if bounty_id not in self.bounties:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Bounty not found")
        b = self.bounties[bounty_id]
        return {
            "bounty_id": int(bounty_id),
            "poster": str(b.poster),
            "title": b.title,
            "task_type": b.task_type,
            "rubric": b.rubric,
            "min_score": int(b.min_score),
            "reward_wei": int(b.reward_wei),
            "deadline": int(b.deadline),
            "status": b.status,
            "solver": str(b.solver),
            "work_url": b.work_url,
            "score": int(b.score),
            "feedback": b.feedback,
        }

    @gl.public.view
    def get_open_bounties(self) -> list:
        result = []
        for i in range(int(self.next_id)):
            bid = u256(i)
            if bid not in self.bounties:
                continue
            b = self.bounties[bid]
            if b.status != "open":
                continue
            result.append(
                {
                    "bounty_id": int(bid),
                    "poster": str(b.poster),
                    "title": b.title,
                    "task_type": b.task_type,
                    "rubric": b.rubric[:120],
                    "min_score": int(b.min_score),
                    "reward_wei": int(b.reward_wei),
                    "deadline": int(b.deadline),
                }
            )
        return result

    @gl.public.view
    def get_stats(self) -> dict:
        return {
            "total_created": int(self.total_created),
            "total_paid_wei": int(self.total_paid_wei),
            "next_id": int(self.next_id),
        }
