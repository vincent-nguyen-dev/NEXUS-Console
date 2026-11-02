def _finish_events(job: ClaimedJob, outcome: Outcome) -> list[tuple[str, str | None]]:
    """(event, detail) pairs to append when a job finishes."""
    if outcome.ok:
        return [("succeeded", outcome.detail)]
    if outcome.retry_in is None:
        return [("failed", outcome.detail), ("dead", None)]
    return [("failed", outcome.detail), ("retry_scheduled", str(int(outcome.retry_in.total_seconds())))]

def run_id(key: bytes, lead_id: int) -> str:
    return "r_" + hmac.new(key, f"run:{lead_id}".encode(), hashlib.sha256).hexdigest()[:12]
