---
sidebar_position: 3
---

# Versioning & Releases

## Versioning philosophy

This action uses a simplified versioning model:

- **Any new functionality** — whether or not it is backwards-compatible — triggers a **new major version**
- **Bug fixes only** are released as patch versions on the current major line
- There are no minor versions

This means consumers pin to a major tag (e.g. `@v1`) and receive bug fixes automatically. New features never appear unexpectedly — getting them requires a deliberate update to reference the new major version (e.g. `@v2`). This is intentional: assessment tools used by instructors across a semester should not silently change behaviour mid-course.

Previous major versions enter **maintenance mode** when a new major is released — they continue to receive bug fixes but no new functionality.

---

## Tag strategy

When you push a tag like `v2.0.1`, the release workflow produces three image tags on `ghcr.io`:

| Image Tag | Updates When | Use Case |
|---|---|---|
| `v2.0.1` | Never (immutable) | Pinning to an exact known-good build |
| `v2` | Any `v2.x.x` is released | Receiving bug fixes automatically (recommended) |
| `latest` | Any release | Always the newest — not recommended for consumers |

All consumer repos should reference the **major** tag (e.g. `v1`) in their workflow files.

---

## How a release works

Pushing a tag is the single action that triggers everything. When you run `git push origin vX.0.Y`:

1. The `release.yml` workflow fires
2. It builds the Docker image and pushes it to `ghcr.io` with three version tags
3. It automatically creates a **GitHub Release** with auto-generated release notes

You do not need to manually create the GitHub Release through the UI.

---

## Releasing a patch (bug fix)

Use when: fixing a bug, correcting a typo in output, or addressing a regression. No new functionality.

```bash
# Example: current version on main is v1.0.2

# 1. Create a branch, make the fix, merge to main
git checkout -b fix/null-output
# ... make changes ...
git add -A && git commit -m "fix: handle null output case"
git push origin fix/null-output
# merge to main via PR

# 2. Tag the patch release from main
git checkout main && git pull
git tag v1.0.3
git push origin v1.0.3
```

**What happens:** `v1.0.3` is created, `v1` and `latest` are updated. Consumers referencing `v1` get the fix on their next run automatically.

---

## Releasing new functionality (new major)

Use when: adding any new capability — new input, new AI provider, new output, new delivery mechanism, etc.

```bash
# Example: current version on main is v1.0.3

# 1. Create a branch, implement the feature, merge to main
git checkout -b feat/add-anthropic-provider
# ... make changes ...
git add -A && git commit -m "feat: add anthropic as a supported ai_provider"
git push origin feat/add-anthropic-provider
# merge to main via PR

# 2. Tag the new major release from main
git checkout main && git pull
git tag v2.0.0
git push origin v2.0.0
```

**What happens:** `v2.0.0` and `v2` are created. `latest` is updated. `v1` is **not affected** — consumers stay on the previous functionality until they deliberately update to `@v2`.

---

## Patching an older major (maintenance mode)

When a bug exists in a previous major line, apply the fix there independently.

```bash
# Example: main is on v2.x.x but a bug needs fixing in v1

# 1. Create a release branch from the latest v1 patch tag
git checkout -b release/v1 v1.0.3

# 2. Apply the fix
git cherry-pick <commit-hash>
git push origin release/v1

# 3. Tag from the release branch
git tag v1.0.4
git push origin v1.0.4
```

This updates `v1` without affecting `v2` or `latest`.

---

## What counts as a patch vs new major?

### Patch — bug fix, no behaviour change for consumers

- A supported AI provider returns an unexpected response shape and the action crashes
- The diff truncation cuts mid-line and produces malformed Markdown
- `sanitiseSha` rejects a valid short SHA format that GitHub legitimately produces
- `resolveOutputFile` generates an invalid filename for an edge-case branch name
- `skip_initial_commit` logic incorrectly identifies the initial commit on a shallow clone
- Whitespace or encoding issue in the generated Markdown output

### New major — any new functionality or breaking change

**New functionality (consumers must opt in):**
- New AI provider (e.g. adding `anthropic` or `google-gemini`)
- New input (e.g. `question-style`, `language`)
- New output (e.g. `question-count`, `truncated`)
- New delivery mechanism (e.g. Teams/Slack webhook, workflow artefact)
- New event support (e.g. `workflow_run`, `schedule`)

**Breaking changes (existing workflows would break):**
- Removing or renaming an input
- Changing an input's default behaviour
- Changing the output file format
- Removing a supported `ai_provider` value
- Changing the `output_file` naming convention
- Removing an output
- Requiring a new mandatory input
