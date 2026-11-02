CREATE TABLE jobs (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lead_id      bigint NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
    kind         text NOT NULL CHECK (kind IN ('notify_team', 'confirm_visitor', 'purge_pii')),
    status       text NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued', 'running', 'retrying', 'succeeded', 'dead')),
    attempts     int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts int NOT NULL CHECK (max_attempts >= 1),
    run_after    timestamptz NOT NULL DEFAULT now(),
    locked_until timestamptz,          -- lease while running: a crashed worker's job is taken again
    result       text,                 -- on success: sent | mock | skipped_cap | purged | already_purged
    last_error   text,                 -- a short code, never exception text
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (lead_id, kind),            -- a step can't be queued twice
    CHECK (attempts <= max_attempts),
    CHECK ((status = 'running') = (locked_until IS NOT NULL))
);

CREATE TABLE run_events (
    id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lead_id bigint NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
    job_id  bigint NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
    kind    text NOT NULL,
    event   text NOT NULL
            CHECK (event IN ('queued', 'started', 'succeeded', 'failed', 'retry_scheduled', 'dead')),
    attempt int NOT NULL,
    detail  text,
    at      timestamptz NOT NULL DEFAULT now()
);
