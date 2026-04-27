# Versioning & Release Guide

## Versioning philosophy

This action uses a simplified versioning model:

- **Any new functionality** — whether or not it is backwards-compatible — triggers a **new major version**
- **Bug fixes only** are released as patch versions on the current major line
- There are no minor versions

This means consumers pin to a major tag (e.g. `@v1`) and receive bug fixes automatically. New features never appear unexpectedly — getting them requires a deliberate update to reference the new major version (e.g. `@v2`). This is intentional: assessment tools used by instructors across a semester should not silently change behaviour mid-course.

Previous major versions enter **maintenance mode** when a new major is released — they continue to receive bug fixes but no new functionality.

## How a Release Works

Pushing a tag is the single action that triggers everything. When you run `git push origin vX.0.Y`:

1. The `release.yml` workflow fires
2. It builds the Docker image and pushes it to `ghcr.io` with three version tags
3. It automatically creates a **GitHub Release** on the repository — this is the entry in the **Releases** section of the repo page, complete with auto-generated release notes summarising the commits since the last tag

You do not need to manually create the GitHub Release through the UI. The workflow handles it.

> **GitHub Releases vs Git Tags:** A Git tag is just a named pointer to a commit. A GitHub Release is a UI page built on top of that tag — it displays release notes, attached assets, and marks the version in the repo's release history. Both are created automatically by the workflow when you push a `v*` tag.

---

## Tag Strategy

When you push a tag like `v2.0.1`, the release workflow produces three image tags on `ghcr.io`:

| Image Tag | Updates When             | Use Case                                          |
| --------- | ------------------------ | ------------------------------------------------- |
| `v2.0.1`  | Never (immutable)        | Pinning to an exact known-good build              |
| `v2`      | Any `v2.x.x` is released | Receiving bug fixes automatically (recommended)   |
| `latest`  | Any release              | Always the newest — not recommended for consumers |

All consumer repos should reference the **major** tag (e.g. `v1`) in their workflow files. They receive bug fixes automatically and only move to a new major version when they choose to adopt new functionality.

---

## Releasing a Patch (bug fix)

---

## Releasing a Patch (bug fix)

Use when: fixing a bug, correcting a typo in output, or addressing a regression. No new functionality.

```bash
# Example: current version on main is v1.0.2

# 1. Create a branch, make the fix, merge to main
git checkout -b fix/null-output
# ... make changes ...
git add -A && git commit -m "fix: handle null output case"
git push origin fix/null-output
# merge to main via PR or direct push

# 2. Tag the patch release from main
git checkout main && git pull
git tag v1.0.3
git push origin v1.0.3
```

**What happens:**

- The release workflow builds and pushes the image
- `v1.0.3` is created (new, immutable)
- `v1` is updated to point to this build
- `latest` is updated to point to this build
- Any consumer referencing `v1` gets the fix on their next run — no action required on their end

---

## Releasing New Functionality (new major)

Use when: adding any new capability — new input, new AI provider, new output, new delivery mechanism, etc. — regardless of whether it is backwards-compatible.

```bash
# Example: current version on main is v1.0.3

# 1. Create a branch, implement the feature, merge to main
git checkout -b feat/add-anthropic-provider
# ... make changes ...
git add -A && git commit -m "feat: add anthropic as a supported ai_provider"
git push origin feat/add-anthropic-provider
# merge to main via PR or direct push

# 2. Tag the new major release from main
git checkout main && git pull
git tag v2.0.0
git push origin v2.0.0
```

**What happens:**

- `v2.0.0` is created (new, immutable)
- `v2` is created (new floating tag for this major line)
- `latest` is updated to point to this build
- `v1` is **not affected** — consumers on `v1` stay on the previous functionality until they deliberately update to `@v2`

Consumers must update their workflow files to reference `@v2` when they are ready to adopt the new functionality.

---

## Patching an Older Major (maintenance mode)

When a new major is released, previous majors enter maintenance mode — they continue to receive bug fixes. If a bug exists in an older major line, apply the fix there independently.

```bash
# Example: main is now on v2.x.x but a bug needs fixing in v1

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

## Patching the Same Bug Across Multiple Major Lines

If a bug affects more than one active major, apply the fix to each independently.

```bash
# 1. Fix the bug on main first
git checkout main
# ... apply fix, commit ...
git add -A && git commit -m "fix: handle edge case in output parsing"
git push origin main

FIX_COMMIT=$(git rev-parse HEAD)

# 2. Patch v1
git checkout -b release/v1 v1.0.3
git cherry-pick "$FIX_COMMIT"
git push origin release/v1
git tag v1.0.4
git push origin v1.0.4

# 3. Tag the fix on main (v2)
git checkout main
git tag v2.0.1
git push origin v2.0.1
```

**Key points:**

- Always fix on `main` first, then cherry-pick backward — this ensures the fix is not lost when future releases are cut from `main`
- Each major's release branch is independent — a cherry-pick conflict on one does not block the others
- If the fix does not cherry-pick cleanly, resolve the conflict on that branch manually before tagging

---

## What Counts as a Patch vs New Major?

### Patch — bug fix, no behaviour change for consumers

- A supported AI provider returns an unexpected response shape and the action crashes instead of failing gracefully
- The diff truncation cuts mid-line and produces malformed Markdown in the output file
- `sanitiseSha` rejects a valid short SHA format that GitHub legitimately produces
- `resolveOutputFile` generates an invalid filename for an edge-case branch name (e.g. a branch with consecutive slashes)
- `skip-initial-commit` logic incorrectly identifies the initial commit on a shallow clone
- The `issue_comment` event doesn't correctly resolve the PR number in certain repo configurations
- A Discussion predecessor incorrectly matches a title it shouldn't (prefix collision)
- The `build-and-push.yml` dev workflow fails due to a stale action version
- Whitespace or encoding issue in the generated Markdown output

### New Major — any new functionality or breaking change

**New functionality (consumers must opt in to get it):**

- **New AI provider** — e.g. adding `anthropic` or `google-gemini` as a supported `ai_provider` value
- **New input** — e.g. `question-style` to switch between viva/written format, or `language` to request questions in a specific language
- **New output** — e.g. adding a `question-count` or `truncated` boolean output
- **New delivery mechanism** — e.g. posting to a Teams/Slack webhook, or attaching the report as a workflow artefact
- **New event support** — e.g. handling `workflow_run` or `schedule` events with sensible SHA detection
- **Smarter diff filtering** — e.g. per-file token budgeting, or splitting large diffs across multiple AI calls and merging results
- **Structured output** — e.g. optionally returning questions as JSON rather than a numbered Markdown list
- **`discussion-category` auto-creation** — instead of throwing when the category doesn't exist, optionally create it

**Breaking changes (existing workflows would break without updating):**

- **Removing or renaming an input** — e.g. removing `skip-initial-commit` or renaming `additional-context` to `context`
- **Changing an input's default behaviour** — e.g. flipping `post-pr-comment` default from `'true'` to `'false'`, or changing `skip-initial-commit` default from `'true'` to `'false'`
- **Changing the output file format** — e.g. switching from Markdown to JSON, or changing the heading structure that downstream steps might be parsing
- **Removing a supported `ai_provider` value** — any consumer hardcoded to that provider breaks
- **Changing the `output-file` naming convention** for branch-specific files — consumers referencing the output path in subsequent steps would get a file-not-found
- **Removing an output** — e.g. dropping the `questions` output that downstream steps might consume
- **Requiring a new mandatory input** — e.g. making `api-key` required unconditionally

> ⚠️ **Assessment integrity rule:** Anything that silently changes _which student code gets assessed_ requires a new major version, even if it is technically just a default value flip. The `skip-initial-commit` default is load-bearing for GitHub Classroom deployments and must never change on an existing major.

---

## Quick Reference

| I need to...                            | Tag                  | Example                                        |
| --------------------------------------- | -------------------- | ---------------------------------------------- |
| Fix a bug                               | Patch                | `v1.0.2` → `v1.0.3`                            |
| Add any new functionality               | New major            | `v1.0.3` → `v2.0.0`                            |
| Fix a bug on an older major             | Patch on branch      | `v1.0.3` → `v1.0.4` (from `release/v1` branch) |
| Fix a bug across multiple active majors | Patch on each branch | `v1.0.3` → `v1.0.4` AND `v2.0.0` → `v2.0.1`    |

## How `action.yml` Stays in Sync

Consumer repos reference a pre-built image in `action.yml` rather than building from `Dockerfile` on every run. The release workflow handles keeping this reference up to date automatically:

1. The image is built and pushed to GHCR with three version tags
2. The workflow updates the `image:` line in `action.yml` to the immutable patch tag (e.g. `docker://ghcr.io/nscc-itc-assessment/reviewquestions:v1.0.3`)
3. That change is committed and pushed to `main`
4. The git tag is force-moved to include this commit, so the tagged source and the image it references are always in sync

This means consumers checking out `@v1` get the `action.yml` that points to the correct pre-built image for that release — no image rebuild on their end.

---

## Verifying a Release

After pushing a tag, confirm the image was published:

```bash
# List tags for the image (org-owned repo)
gh api orgs/NSCC-ITC-Assessment/packages/container/ReviewQuestions/versions --jq '.[].metadata.container.tags'
```

Or check the **Packages** tab on the repository page in GitHub.
