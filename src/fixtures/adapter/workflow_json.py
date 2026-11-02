def workflow_json(retention: timedelta, backoff_s: tuple[float, ...]) -> dict:
    outage_tries = " and ".join(str(n) for n in range(1, OUTAGE_ATTEMPTS + 1))
    steps = []
    for spec in job_plan(retention):
        d = DESCRIPTION[spec.kind]  # a planned job without a description fails here and in the tests
        steps.append({
            "kind": spec.kind, "label": d["label"], "purpose": d["purpose"].format(days=retention.days),
            "delivers": d["delivers"], "always_simulated": d["always_simulated"],
            "starts_after_s": _seconds(spec.delay.total_seconds()), "max_attempts": spec.max_attempts,
            "backoff_s": [_seconds(s) for s in backoff_s],
            "results": [{"code": c, "outcome": o, "label": label} for c, o, label in d["results"]],
        })
    return {
        "version": 1,
        "trigger": {"one": "enquiry", "many": "enquiries"},
        "steps": steps,
        "errors": [{"code": c, "label": label, "sends_nothing": n} for c, label, n in ERRORS],
        "flags": [{"key": "simulate_outage", "label": "Outage switch",
                   "effect": f"fails team notification tries {outage_tries} on purpose"}],
    }
