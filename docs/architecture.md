# Architecture

## How the action runs

This is a **Docker-based GitHub Action** — rather than executing JavaScript directly on the runner, GitHub pulls a pre-built Docker image and runs the assessment script inside it. The image is published to the GitHub Container Registry (`ghcr.io`) and pinned in `action.yml`.

```
Consumer workflow
      │
      ▼
action.yml  ──► pulls Docker image from ghcr.io
                      │
                      ▼
              entrypoint.sh  ──► cd $GITHUB_WORKSPACE
                                       │
                                       ▼
                                 node src/assess.js
```

Using Docker means:

- The Node version, `git` binary, and all dependencies are fixed and identical across every runner — no version drift
- The image is built once and reused; consumer repos pay no build cost at runtime
- The pre-built image reference in `action.yml` is updated automatically by the release workflow each time a version tag is pushed

---

## Execution flow

When `assess.js` runs, it follows this sequence:

```
readInputs()
    │  Reads all INPUT_* environment variables set by action.yml
    │
resolveSHAs()
    │  Determines baseSha and headSha from the event context
    │  Handles: pull_request, push, issue_comment, workflow_dispatch
    │  Applies skip-initial-commit override when enabled
    │
resolveBranch()
    │  Extracts the branch name from the event payload or GITHUB_REF
    │
getChangedFiles() → filterFiles()
    │  Runs `git diff --name-only baseSha headSha`
    │  Applies include-patterns and exclude-patterns via minimatch
    │
getDiff()
    │  Runs `git diff baseSha headSha -- <files>`
    │  Truncates to MAX_DIFF_CHARS (12 000) if needed
    │
buildPrompt()
    │  Constructs the system + user messages for the AI
    │
callAI()
    │  POSTs to the provider's chat completions endpoint
    │  Returns the model's response text
    │
formatReport()          resolveOutputFile()
    │                          │
    └──────────┬───────────────┘
               │
        writes Markdown file to GITHUB_WORKSPACE
               │
        sets action outputs (output-file, questions)
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
postPrComment  postIssue  postDiscussion
  (REST)       (REST)      (GraphQL)
```

---

## Key modules

### `readInputs()`

Reads and normalises every `INPUT_*` environment variable. Responsible for:

- Parsing comma-separated glob lists into arrays
- Applying defaults (`DEFAULT_EXCLUDE_PATTERNS` when no `exclude-patterns` is supplied)
- Clamping `num-questions` to a minimum of 1

### `resolveSHAs(ctx, octokit, inputs)`

The most event-aware function in the codebase. Handles four distinct event types:

| Event                                  | Base SHA                                     | Head SHA    | PR number    |
| -------------------------------------- | -------------------------------------------- | ----------- | ------------ |
| `pull_request` / `pull_request_target` | PR base branch SHA                           | PR head SHA | from payload |
| `push`                                 | previous SHA (or first commit on new branch) | `after` SHA | —            |
| `issue_comment`                        | PR base branch SHA (fetched via REST)        | PR head SHA | from payload |
| everything else                        | first commit                                 | `ctx.sha`   | —            |

After event-specific resolution, `skip-initial-commit` can override the base SHA to pin it to the repository's very first commit — the behaviour needed for GitHub Classroom to exclude starter template files.

Manual `base-sha` / `head-sha` inputs always take precedence over all of the above.

### `sanitiseSha(sha)`

Validates that a SHA is 4–64 hex characters before passing it to a `git` command. This prevents shell injection through crafted `base-sha`/`head-sha` inputs.

### `resolveOutputFile(outputFile, branchName)`

On `main`/`master` (or when the branch is unknown), returns `outputFile` unchanged. On any other branch, inserts the sanitised branch name before the extension so each branch produces a distinct file without collisions.

### `callAI({ provider, model, apiKey, endpoint, messages })`

A thin provider abstraction over the OpenAI-compatible chat completions API. Each provider maps to a different base URL and authentication header:

| Provider        | URL                             | Auth header                            |
| --------------- | ------------------------------- | -------------------------------------- |
| `github-models` | `models.inference.ai.azure.com` | `Authorization: Bearer <github_token>` |
| `openai`        | `api.openai.com`                | `Authorization: Bearer <api-key>`      |
| `openrouter`    | `openrouter.ai`                 | `Authorization: Bearer <api-key>`      |
| `azure-openai`  | caller-supplied endpoint        | `api-key: <api-key>`                   |

All providers use the same request body shape (`model`, `messages`, `temperature`, `max_tokens`, `top_p`).

For the full configuration reference — required inputs, secrets, and workflow examples for each provider — see [docs/ai-providers.md](ai-providers.md).

### `postIssue()` / `postDiscussion()`

Both delivery functions follow the same supersession pattern:

1. List open assessment items for the same branch
2. Post a "superseded" comment/note on each one, then close/lock it
3. Create a fresh item with the latest report

This prevents an accumulating backlog of open issues or discussions per branch.

`postDiscussion` uses the **GraphQL API** (not REST) because GitHub's REST API does not support creating Discussions.

---

## Security considerations

- **Shell injection prevention:** all `git` calls use `spawnSync` with an explicit argument array — no shell string interpolation. SHAs are validated with `sanitiseSha()` before use.
- **Secret masking:** the external API key is registered with `core.setSecret()` before any API call, preventing it from appearing in workflow logs.
- **Minimal permissions:** the action only requests the permissions it needs for the chosen delivery method (see the Permissions table in `README.md`).

---

## Docker image lifecycle

```
push to main  ──► build-and-push.yml  ──► ghcr.io/…:latest  (dev build only)

push v* tag   ──► release.yml ──► ghcr.io/…:v1.0.3   (immutable)
                                  ghcr.io/…:v1        (floating — recommended for consumers)
                                  ghcr.io/…:latest    (floating)
                            └──► updates action.yml image reference
                            └──► creates GitHub Release
```

Two separate workflows manage the image:

- **`build-and-push.yml`** fires on every push to `main` that is _not_ a version tag. It pushes a single `:latest` tag as a dev/CI image. This image is continuously overwritten and should never be pinned by consumers.
- **`release.yml`** fires only when a `v*` tag is pushed. It produces the three versioned tags above and updates `action.yml` so consumers always get the correct pre-built image.

> ⚠️ `:latest` on GHCR is overwritten by routine `main` merges between releases. Consumers must pin to a major floating tag (e.g. `v1`) — never to `:latest`.

See [versioning.md](versioning.md) for the full release and tagging guide.
