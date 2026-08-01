# Deployment Guide

> RepoLens is built on **Next.js 15 (App Router)** and is designed to run on
> **Vercel**, the platform maintained by the Next.js team. The instructions
> below cover a Vercel deployment, but the same environment variables and
> commands work for any Node.js host that supports Next.js standalone output.

This document was written in **Backend 6C**. It does not perform the
deployment itself; it only describes how to deploy.

---

## 1. Supported platform

- **Primary:** [Vercel](https://vercel.com) (recommended)
- **Compatible:** any Node.js host that supports Next.js 15
  (Node 18.18+, 19.8+, or 20+). For non-Vercel hosts, run
  `npm run build` and then `npm start`, or build a Docker image from
  the `.next/` output.

RepoLens does not use any Vercel-specific features (Edge Functions,
Vercel KV, Image Optimization, etc.) that would tie the build to that
platform. A Vercel deploy is the path of least resistance, but the app
is portable.

---

## 2. Required environment variables

All environment variables are read through the centralised config module
introduced in **Backend 6A** (`lib/config/`). The authoritative list lives
there; this table is the deployment cheat-sheet.

| Variable          | Required | Used by                  | Where to get it                                              |
|-------------------|:--------:|--------------------------|--------------------------------------------------------------|
| `OPENAI_API_KEY`  | **Yes**  | `/api/analyze` (Phase 5) | <https://platform.openai.com/api-keys>                       |
| `PARITOK_API_KEY` | **Yes**  | `/api/analyze` (Phase 4) | Paritok dashboard                                            |
| `PARITOK_API_URL` | No       | Paritok client override  | Leave empty to use the default `https://www.paritok.com/...` |
| `GITHUB_TOKEN`    | No       | GitHub REST API client   | <https://github.com/settings/tokens> (classic, public-repo)  |

> **Do not commit real secrets.** RepoLens only ever ships the placeholders
> in `.env.example`. Production secrets live in your hosting platform's
> environment-variable store (e.g. Vercel Project Settings → Environment
> Variables).

### Why are two keys required?

`/api/analyze` is the only production route. It calls:

1. **GitHub** for repository metadata, tree, and recent commits.
2. **Paritok** to compress the retrieved context.
3. **OpenAI** to generate the grounded answer.

If either `OPENAI_API_KEY` or `PARITOK_API_KEY` is missing, `/api/analyze`
returns `503` with `code: "MISSING_CONFIG"` and a developer-friendly
message listing the offending variable(s). The application never falls
back to an unauthenticated or stubbed upstream call.

---

## 3. Build & install commands

Vercel detects Next.js automatically. The defaults below are what the
platform uses — included here for hosts that need them explicitly.

| Step            | Command       |
|-----------------|---------------|
| Install         | `npm install` |
| Build           | `npm run build` |
| Start (Vercel uses this) | `npm start` |

The `engines` field in `package.json` pins the supported Node.js range
(see §5). Vercel selects a matching runtime automatically; if you are
self-hosting, use `nvm use` (a `.nvmrc` is not required) or install the
exact version documented there.

---

## 4. Deploying to Vercel

### One-time setup

1. Push the repository to GitHub (already done for this project).
2. Sign in to <https://vercel.com> with the GitHub account that owns the
   repository.
3. Click **Add New… → Project**, then import the RepoLens repository.
4. Vercel will prefill the framework as **Next.js**. Leave the
   **Build Command** and **Output Directory** at their defaults.
5. Open **Environment Variables** and add:
   - `OPENAI_API_KEY`
   - `PARITOK_API_KEY`
   - (optional) `PARITOK_API_URL`
   - (optional) `GITHUB_TOKEN`
6. Click **Deploy**. The first build takes a few minutes; subsequent
   deploys are incremental.

### Subsequent deploys

Every push to `main` triggers a production deploy. Every push to any
other branch triggers a preview deploy with its own URL. No additional
configuration is required.

### Custom domain

1. Project Settings → Domains → add your domain.
2. Follow the DNS instructions Vercel provides (CNAME or A record).
3. SSL is provisioned automatically.

---

## 5. Node.js version

`package.json` declares:

```json
"engines": {
  "node": ">=18.18.0 <20 || >=20.0.0"
}
```

This matches the Node.js ranges that **Next.js 15** itself supports
(`^18.18.0 || ^19.8.0 || >= 20.0.0`). Vercel's default Node runtime is
20.x, which is recommended. The project has been verified against
Node 22 in development; it remains compatible with the 20.x LTS.

If you are self-hosting and use `nvm`, install a matching version before
building:

```bash
nvm install 20
nvm use 20
npm install
npm run build
```

---

## 6. Deployment troubleshooting

### `MISSING_CONFIG` from `/api/analyze`

`/api/analyze` returns:

```json
{ "ok": false, "error": { "code": "MISSING_CONFIG", "message": "…" } }
```

with HTTP **503** when one or more required environment variables are
unset or blank. The message names the missing variable(s). Fix:

1. Open the hosting platform's environment-variable UI.
2. Add the named variable(s).
3. Re-trigger the deploy (Vercel will not re-inject env vars into an
   already-built function without a rebuild).

### Build fails with "Module not found" / TypeScript errors

Run locally first to reproduce:

```bash
npm install
npm run type-check
npm run build
```

If `type-check` fails locally, fix the type error and push again.
Vercel's build is not more permissive than the local build.

### `/api/analyze` returns `502 NETWORK`

The GitHub API could not be reached. Most common causes:

- Vercel's outbound IP range is rate-limited by GitHub. Add a
  `GITHUB_TOKEN` to lift the limit from 60 to 5,000 requests/hour.
- A transient GitHub outage. The error response includes a sanitised
  message — retry after a moment.

### `/api/analyze` returns `502 API_ERROR` (upstream 5xx)

Either Paritok or OpenAI returned a 5xx. Check:

- The relevant provider's status page.
- The error `status` field in the response — it echoes the upstream
  HTTP status so you can distinguish 429 (rate limit) from 503 (provider
  outage).

### `/api/analyze` is slow

- Cold starts: Vercel may take 1–3 seconds on the first request after
  a deploy. Subsequent requests are warm.
- Paritok timeout: the default is 20 s. If you see frequent timeouts,
  the Paritok plan is likely under-provisioned.
- OpenAI timeout: the default is 30 s. Models like `gpt-4o-mini`
  (RepoLens's default) usually respond in 1–5 s.

### Dev-only routes (`/api/dev/openai`, `/api/dev/paritok`) return 404 in production

This is intentional (Backend 6B). The `devOnly()` wrapper returns
`{ "ok": false, "error": { "code": "NOT_FOUND", "message": "Not found." } }`
with HTTP 404 in production. They are reachable only when
`NODE_ENV !== "production"`.

### Vercel build region

RepoLens is stateless and has no region-specific dependencies. The
default Vercel region (`iad1`) is fine; pin a region only if you have
data-residency requirements.

---

## 7. Health check

After every deploy, verify the deployment is live:

```bash
curl -fsS https://<your-deployment>.vercel.app/api/health
# Expected:
# { "ok": true, "data": { "status": "ok", "service": "RepoLens", "timestamp": "…" } }
```

A non-200 response or a missing `ok: true` indicates a broken
deployment — check the Vercel function logs.

For a more comprehensive verification, see
[`STARTUP-CHECKLIST.md`](./STARTUP-CHECKLIST.md).
