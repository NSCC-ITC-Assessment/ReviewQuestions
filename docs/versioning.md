# Versioning & Release Guide

This action follows [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`) and uses floating image tags so consumers can opt into the level of stability they need.

## How a Release Works

Pushing a tag is the single action that triggers everything. When you run `git push origin vX.Y.Z`:

1. The `release.yml` workflow fires
2. It builds the Docker image and pushes it to `ghcr.io` with all four version tags
3. It automatically creates a **GitHub Release** on the repository — this is the entry in the **Releases** section of the repo page, complete with auto-generated release notes summarising the commits since the last tag

You do not need to manually create the GitHub Release through the UI. The workflow handles it.

> **GitHub Releases vs Git Tags:** A Git tag is just a named pointer to a commit. A GitHub Release is a UI page built on top of that tag — it displays release notes, attached assets, and marks the version in the repo's release history. Both are created automatically by the workflow when you push a `v*` tag.

---

## Tag Strategy

When you push a tag like `v1.2.3`, the release workflow produces four image tags on `ghcr.io`:

| Image Tag | Updates When                   | Use Case                                             |
| --------- | ------------------------------ | ---------------------------------------------------- |
| `v1.2.3`  | Never (immutable)              | Pinning to an exact known-good build                 |
| `v1.2`    | Any `v1.2.x` patch is released | Getting bug fixes automatically                      |
| `v1`      | Any `v1.x.x` release           | Getting bug fixes + minor improvements (recommended) |
| `latest`  | Any release                    | Always the newest — not recommended for consumers    |

Most consumer repos should reference the **major** tag (`v1`) in `action.yml` so they receive both patches and minor improvements without changing their workflow files.

---

## Releasing a Patch (bug fix)

Use when: fixing a bug, correcting a typo in output, or addressing a regression. No new features, no breaking changes.

```bash
# Example: current latest release is v1.2.0

# 1. Create a branch, make the fix, merge to main
git checkout -b fix/null-output
# ... make changes ...
git add -A && git commit -m "fix: handle null output case"
git push origin fix/null-output
# merge to main via PR or direct push

# 2. Tag the patch release from main
git checkout main && git pull
git tag v1.2.1
git push origin v1.2.1
```

**What happens:**

- The release workflow builds and pushes the image
- `v1.2.1` is created (new, immutable)
- `v1.2` is updated to point to this build
- `v1` is updated to point to this build
- `latest` is updated to point to this build
- Any consumer referencing `v1` or `v1.2` gets the fix on their next run — no action required on their end

---

## Releasing a Minor Improvement

Use when: adding a new input/output, supporting an additional language, or adding non-breaking functionality.

```bash
# Example: current latest release is v1.2.1

# 1. Create a branch, implement the feature, merge to main
git checkout -b feat/add-feedback-comment
# ... make changes ...
git add -A && git commit -m "feat: post feedback as PR comment"
git push origin feat/add-feedback-comment
# merge to main via PR or direct push

# 2. Tag the minor release from main
git checkout main && git pull
git tag v1.3.0
git push origin v1.3.0
```

**What happens:**

- `v1.3.0` is created (new, immutable)
- `v1.3` is created (new floating tag for this minor line)
- `v1` is updated to point to this build
- `latest` is updated to point to this build
- Consumers on `v1` get the improvement automatically
- Consumers pinned to `v1.2` do **not** get the change (they stay on the 1.2.x line)

---

## Releasing a Major (breaking change)

Use when: removing an input, changing output format, or any change that would break existing consumer workflows.

```bash
git checkout main && git pull
git tag v2.0.0
git push origin v2.0.0
```

Consumers on `v1` are **not affected**. You must update `action.yml` in consumer repos to reference `v2` when they are ready to migrate.

---

## Patching an Older Minor Line

If you need to fix a bug in `v1.2.x` but `main` has already moved to `v1.3.0`:

```bash
# 1. Create a release branch from the last v1.2.x tag
git checkout -b release/v1.2 v1.2.1

# 2. Cherry-pick or apply the fix
git cherry-pick <commit-hash>
git push origin release/v1.2

# 3. Tag from the release branch
git tag v1.2.2
git push origin v1.2.2
```

This updates `v1.2` without affecting `v1.3` or `v1`. The `v1` tag continues to point at `v1.3.0` (the latest minor).

> **Note:** Only maintain separate release branches when you have consumers explicitly pinned to an older minor version. Otherwise, patches on `main` with a new minor or patch tag are simpler.

---

## Patching the Same Bug Across Multiple Minor Lines

If a bug exists in more than one minor version (e.g., both `v1.0.x` and `v1.1.x`) and consumers are pinned to each, you need to apply the fix to every affected release branch.

**Workflow:**

```bash
# 1. Fix the bug on main first (or on a feature branch merged to main)
git checkout main
# ... apply fix, commit ...
git add -A && git commit -m "fix: handle edge case in output parsing"
git push origin main

# 2. Note the commit hash of the fix
FIX_COMMIT=$(git rev-parse HEAD)

# 3. Patch v1.0.x
git checkout -b release/v1.0 v1.0.2    # branch from the latest v1.0.x tag
git cherry-pick "$FIX_COMMIT"
git push origin release/v1.0
git tag v1.0.3
git push origin v1.0.3

# 4. Patch v1.1.x
git checkout -b release/v1.1 v1.1.1    # branch from the latest v1.1.x tag
git cherry-pick "$FIX_COMMIT"
git push origin release/v1.1
git tag v1.1.2
git push origin v1.1.2

# 5. If main is on v1.2.x or later, tag a patch there too
git checkout main
git tag v1.2.1
git push origin v1.2.1
```

**What happens:**

- `v1.0` floating tag updates to the `v1.0.3` build
- `v1.1` floating tag updates to the `v1.1.2` build
- `v1.2` / `v1` floating tags update to the `v1.2.1` build
- Consumers pinned to any of these minor versions receive the fix on their next run

**Key points:**

- Always fix on `main` first, then cherry-pick backward — this avoids the fix being lost when new releases are cut from `main`
- Each release branch is independent — a cherry-pick conflict on one branch does not block the others
- If the fix does not cherry-pick cleanly (e.g., surrounding code has changed), resolve the conflict on that branch manually before tagging
- If you have many minor lines to maintain, consider whether consumers really need to be pinned to a minor version — encouraging `v1` (major pin) reduces this maintenance burden significantly

---

## What Counts as a Patch, Minor, or Major Change?

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

### Minor — new capability, fully backwards compatible

- **New AI provider** — e.g. adding `anthropic` or `google-gemini` as a supported `ai-provider` value
- **New input** — e.g. `question-style` to switch between viva/written format, or `language` to request questions in a specific language
- **New output** — e.g. adding a `question-count` or `truncated` boolean output
- **New delivery mechanism** — e.g. posting to a Teams/Slack webhook, or attaching the report as a workflow artefact
- **New event support** — e.g. handling `workflow_run` or `schedule` events with sensible SHA detection
- **Smarter diff filtering** — e.g. per-file token budgeting, or splitting large diffs across multiple AI calls and merging results
- **Structured output** — e.g. optionally returning questions as JSON rather than a numbered Markdown list
- **`discussion-category` auto-creation** — instead of throwing when the category doesn't exist, optionally create it

### Major — breaking, existing consumer workflows would need updating

- **Removing or renaming an input** — e.g. removing `skip-initial-commit` or renaming `additional-context` to `context`
- **Changing an input's default behaviour** — e.g. flipping `post-pr-comment` default from `'true'` to `'false'`, or changing `skip-initial-commit` default from `'true'` to `'false'`
- **Changing the output file format** — e.g. switching from Markdown to JSON, or changing the heading structure that downstream steps might be parsing
- **Removing a supported `ai-provider` value** — any consumer hardcoded to that provider breaks
- **Changing the `output-file` naming convention** for branch-specific files — consumers referencing the output path in subsequent steps would get a file-not-found
- **Removing an output** — e.g. dropping the `questions` output that downstream steps might consume
- **Requiring a new mandatory input** — e.g. making `api-key` required unconditionally

> ⚠️ **Assessment integrity rule:** Anything that silently changes _which student code gets assessed_ is a breaking change, even if it is technically just a default value flip. The `skip-initial-commit` default is load-bearing for GitHub Classroom deployments and must never change without a major version bump.

---

## Quick Reference

| I need to...                     | Bump                 | Example                                          |
| -------------------------------- | -------------------- | ------------------------------------------------ |
| Fix a bug                        | Patch                | `v1.2.0` → `v1.2.1`                              |
| Fix a bug across multiple minors | Patch on each branch | `v1.0.2` → `v1.0.3` AND `v1.1.1` → `v1.1.2`      |
| Add a feature (non-breaking)     | Minor                | `v1.2.1` → `v1.3.0`                              |
| Make a breaking change           | Major                | `v1.3.0` → `v2.0.0`                              |
| Hotfix an old release line       | Patch on branch      | `v1.2.1` → `v1.2.2` (from `release/v1.2` branch) |

## How `action.yml` Stays in Sync

Consumer repos reference a pre-built image in `action.yml` rather than building from `Dockerfile` on every run. The release workflow handles keeping this reference up to date automatically:

1. The image is built and pushed to GHCR with all four version tags
2. The workflow updates the `image:` line in `action.yml` to the immutable patch tag (e.g. `docker://ghcr.io/nscc-itc-assessment/reviewquestions:v1.2.3`)
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
