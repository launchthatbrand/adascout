# ADAScout Scanner Worker

Deterministic ADA scanning worker that:

- claims queued page scan jobs from Convex,
- executes `@axe-core/playwright` against Browserless via CDP,
- writes normalized findings back to Convex (`source: "axe"`),
- reports scan failures with categorized error classes.

## Required env

- `CONVEX_URL`
- `ADA_SCANNER_WORKER_TOKEN`
- `BROWSERLESS_CDP_URL`

## Optional env

- `SCANNER_MAX_CONCURRENCY` (default `2`)
- `SCANNER_IDLE_SLEEP_MS` (default `1500`)
- `SCANNER_PAGE_TIMEOUT_MS` (default `45000`)
- `SCANNER_SETTLE_MS` (default `1000`)
- `SCANNER_HEALTH_PORT` (default `8081`)

## Health endpoint

- `GET /healthz` on `SCANNER_HEALTH_PORT`

## Local container run

```bash
docker compose -f apps/adascout-scanner-worker/docker-compose.yml up --build
```
