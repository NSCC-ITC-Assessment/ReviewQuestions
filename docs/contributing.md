# Contributing Guide

## Prerequisites

| Tool   | Version | Notes                                             |
| ------ | ------- | ------------------------------------------------- |
| Node   | ≥ 20    | Matches the Docker base image (`node:20-alpine`)  |
| pnpm   | ≥ 10    | Enforced via `engines` — `npm install` is blocked |
| Docker | any     | Required to test the action end-to-end locally    |
| git    | any     | Commit hooks are installed automatically          |

---

## Setup

```bash
git clone https://github.com/NSCC-ITC-Assessment/ReviewQuestions.git
cd ReviewQuestions
pnpm install
```

`pnpm install` installs all dependencies **and** sets up the Husky pre-commit hooks automatically via the `prepare` script. No additional step is needed.

---

## Running lint and format checks

```bash
# Lint source files
pnpm lint

# Auto-fix lint issues
pnpm lint:fix

# Check formatting
pnpm format:check

# Auto-fix formatting
pnpm format
```

Lint (ESLint) and formatting (Prettier) are also run automatically on staged files before every commit via `lint-staged`.

---

## Commit message conventions

This project enforces [Conventional Commits](https://www.conventionalcommits.org/) via `commitlint`. Every commit message must follow the pattern:

```
<type>(<optional scope>): <subject>
```

**Allowed types:**

| Type       | When to use                                     |
| ---------- | ----------------------------------------------- |
| `feat`     | New feature, new input or output                |
| `fix`      | Bug fix                                         |
| `chore`    | Maintenance, dependency updates, config changes |
| `docs`     | Documentation only                              |
| `style`    | Formatting (no logic change)                    |
| `refactor` | Code change with no behaviour difference        |
| `test`     | Adding or updating tests                        |
| `perf`     | Performance improvements                        |
| `ci`       | Workflow / CI changes                           |
| `build`    | Build system changes                            |
| `revert`   | Reverts a previous commit                       |

**Rules:**

- Subject must not be empty and must not end with a period
- Header (type + subject) must be ≤ 100 characters
- Body lines must be ≤ 200 characters

**Examples:**

```
feat: add anthropic as a supported ai-provider
fix: handle null output when AI returns empty choices array
docs: add GitHub Classroom usage example to README
chore: update @actions/core to v3
ci: fix sed quote mismatch in release workflow
```

The pre-commit hook (Husky + `commit-msg` hook) enforces this automatically.

---

## Pre-commit hooks

Two hooks run automatically when you commit:

1. **`pre-commit`** — `lint-staged` runs ESLint and Prettier on staged `.js` files, and Prettier on staged `.json`, `.yml`/`.yaml`, and `.md` files. The commit is blocked if any check fails.
2. **`commit-msg`** — `commitlint` validates the commit message against the conventional commit rules above.

---

## Testing locally with Docker

To run the action exactly as it would run in GitHub Actions:

```bash
# Build the image
docker build -t reviewquestions-local .

# Run it (replace values as appropriate)
docker run --rm \
  -e GITHUB_WORKSPACE=/workspace \
  -e INPUT_GITHUB-TOKEN=<your-token> \
  -e INPUT_AI-PROVIDER=github-models \
  -e INPUT_NUM-QUESTIONS=5 \
  -v $(pwd):/workspace \
  reviewquestions-local
```

> **Note:** The action relies on `git` and a GitHub API token to resolve commit SHAs and post results. For a fully accurate local test, clone a real repository and bind-mount it as the workspace.

---

## Branch and PR process

1. Create a feature or fix branch from `main`:
   ```bash
   git checkout -b feat/my-new-feature
   ```
2. Make your changes, commit following the conventions above
3. Push and open a PR against `main`
4. The `build-and-push.yml` workflow will build and push a `:latest` dev image automatically once merged

---

## Releasing

Releases are triggered by pushing a version tag. See [versioning.md](versioning.md) for the complete guide including patch, minor, major, and backport release procedures.
