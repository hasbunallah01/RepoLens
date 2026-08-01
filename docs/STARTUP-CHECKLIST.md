# Startup Verification Checklist

> Use this checklist every time you bring up a fresh deployment of
> RepoLens, whether locally, on a preview environment, or in
> production. Every step is meant to fail loudly so a broken
> deployment is obvious before a user hits it.

The checklist is written for **Backend 6C** and assumes the deployment
matches the layout described in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## 1. Build succeeds

```bash
npm install
npm run type-check
npm run build
```

Expected:

- `npm install` exits `0` with no peer-dependency errors that block
  the build.
- `npm run type-check` (`tsc --noEmit`) prints nothing and exits `0`.
- `npm run build` prints the route table, ending in:

  ```
  Route (app)                              Size     First Load JS
  ┌ ƒ /api/analyze                         ...
  ├ ƒ /api/dev/openai                      ...
  ├ ƒ /api/dev/paritok                     ...
  ├ ƒ /api/health                          ...
  ...
  ```

If the build fails, fix the error and re-run before continuing. A
deployed build that failed locally will not work any better in
production.

---

## 2. Required environment variables are present

RepoLens reads all configuration through the centralised module in
`lib/config/`. Two variables are **required**; the rest are optional.

| Variable          | Required | Notes                                       |
|-------------------|:--------:|---------------------------------------------|
| `OPENAI_API_KEY`  | **Yes**  | Bearer token for `https://api.openai.com/…` |
| `PARITOK_API_KEY` | **Yes**  | Bearer token for `https://www.paritok.com/…`|
| `PARITOK_API_URL` | No       | Override the Paritok endpoint (testing)     |
| `GITHUB_TOKEN`    | No       | Lifts GitHub rate limits from 60 to 5,000/h |

Quick local check (do **not** echo the values back):

```bash
# Both should print a non-empty trimmed value.
node -e "console.log(require('@/lib/config').getOpenAIApiKey() ? 'OPENAI_API_KEY=set' : 'OPENAI_API_KEY=MISSING')"
node -e "console.log(require('@/lib/config').getParitokApiKey() ? 'PARITOK_API_KEY=set' : 'PARITOK_API_KEY=MISSING')"
```

In a hosted environment (Vercel, Render, Fly, etc.) confirm the same
two variables exist in the project's environment-variable UI and are
attached to the **production** environment, not only `preview`.

> The application **never logs the values of these variables**.
> RepoLens's centralised config module reads them lazily and only
> forwards them as `Authorization: Bearer …` headers in outbound
> requests to the matching upstream.

---

## 3. Health endpoint responds

The health endpoint is the cheapest live deployment check. It does
**not** call any upstream service, so a 200 here means the API layer
is wired up correctly.

```bash
# Local
curl -fsS http://localhost:3000/api/health

# Production
curl -fsS https://<your-deployment>/api/health
```

Expected response (HTTP 200):

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "service": "RepoLens",
    "timestamp": "2026-…"
  }
}
```

Failure modes:

- **Connection refused / timeout** — the server is not running, or
  the URL is wrong. Check the deploy logs.
- **`ok: false`** — the helper module is in an unexpected state. Check
  the function logs for the underlying error.
- **HTML response** — something is intercepting the request (CDN, auth
  proxy). Bypass it or fix the proxy.

---

## 4. Analyze endpoint can be reached

`/api/analyze` is the only production route that does real work. A
successful hit here proves end-to-end: the config is valid, the GitHub
client works, the Paritok client works, and the OpenAI client works.

```bash
curl -fsS "https://<your-deployment>/api/analyze?url=https://github.com/vercel/next.js"
```

Expected response (HTTP 200):

```json
{
  "ok": true,
  "data": {
    "url": "https://github.com/vercel/next.js",
    "metadata": { "name": "next.js", "owner": "vercel", "...": "…" },
    "index":   { "files": [...], "tree": {...}, "...": "…" },
    "commits": [ ... ],
    "fetchedAt": "2026-…"
  }
}
```

Failure modes (and what they tell you):

| HTTP | `error.code`     | Meaning                                              |
|-----:|------------------|------------------------------------------------------|
| 400  | `INVALID_URL`    | The `url` query parameter is missing or malformed.  |
| 500  | `INTERNAL`       | An unhandled error. Inspect server logs; the body    |
|      |                  | intentionally does **not** echo the underlying cause.|
| 502  | `RATE_LIMITED`   | GitHub rate limit hit. Add a `GITHUB_TOKEN`.         |
| 502  | `REPO_NOT_FOUND` | The repository does not exist or is private.         |
| 502  | `NETWORK`        | Could not reach GitHub.                              |
| 503  | `MISSING_CONFIG` | `OPENAI_API_KEY` and/or `PARITOK_API_KEY` is missing.|

A missing required variable is the single most common production
issue and produces the 503 path above. The error message names the
offending variable(s).

---

## 5. OpenAI and Paritok configuration requirements

### OpenAI (`OPENAI_API_KEY`)

- **Key shape:** starts with `sk-…`.
- **Account requirements:** the OpenAI account must have an active
  paid plan (or a valid free-tier grant). Free keys without
  billing will return `429` once the grant is exhausted.
- **Model access:** RepoLens defaults to `gpt-4o-mini`. Make sure the
  account has access to that model; otherwise the call returns `404`
  from the OpenAI API, which surfaces as `502 API_ERROR` from
  `/api/analyze`.
- **Network:** the deployment must be able to reach
  `https://api.openai.com`. Vercel allows this by default.

### Paritok (`PARITOK_API_KEY`)

- **Key shape:** whatever Paritok's dashboard issues; there is no
  public format contract.
- **Endpoint:** defaults to `https://www.paritok.com/api/compress`.
  Override with `PARITOK_API_URL` only when running against a Paritok
  staging or self-hosted instance.
- **Plan limits:** if the key is on a free / trial plan, requests may
  be throttled. The Paritok service returns `429` in that case, which
  surfaces as `502 API_ERROR` from `/api/analyze` with a message that
  mentions rate limits.
- **Network:** the deployment must be able to reach the Paritok
  endpoint. Vercel allows this by default.

### Optional: GitHub (`GITHUB_TOKEN`)

- Strongly recommended for any non-toy deployment.
- Without it, `/api/analyze` is limited to **60 requests / hour per
  IP**; Vercel's shared outbound IP is shared by all deploys in the
  region, so this limit is hit fast.
- A classic PAT with `public_repo` scope is sufficient — no
  `repo` scope is required because RepoLens only reads public
  repositories.
- Adding the token raises the limit to **5,000 requests / hour per
  token**.

---

## Putting it all together

A single shell script that exercises every step:

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://<your-deployment>}"

echo "1. Health endpoint"
curl -fsS "$BASE/api/health" >/dev/null
echo "   ok"

echo "2. Analyze endpoint"
curl -fsS "$BASE/api/analyze?url=https://github.com/vercel/next.js" \
  | grep -q '"ok":true'
echo "   ok"

echo "All checks passed."
```

If any step fails, the script exits non-zero. Wire it into your
platform's post-deploy hook (Vercel Deployment Hooks, GitHub Actions,
etc.) for continuous verification.
