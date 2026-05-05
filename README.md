# Grill My Code

A GitHub Action that analyses code changes and uses AI to generate targeted comprehension questions for conversational or written assessments.

## How it works

1. Detects the commit range from the triggering event (push, pull request, etc.)
2. Collects the git diff of changed files, applying include/exclude filters
3. Sends the diff to an AI provider to generate comprehension questions
4. Writes the assessment to a Markdown file, and optionally posts it as a PR comment, GitHub Issue, or GitHub Discussion

See [docs/architecture.md](docs/architecture.md) for a detailed breakdown of how the action is structured and executed.

## Usage

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Inputs

| Input                 | Required | Default                                     | Description                                                                                                                                                                                                                                                                                         |
| --------------------- | -------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `github_token`        | Yes      | `${{ github.token }}`                       | GitHub token for API access and GitHub Models credential                                                                                                                                                                                                                                            |
| `ai_provider`         | No       | `github-models`                             | AI provider: `github-models`, `openai`, `openrouter`, or `azure-openai`                                                                                                                                                                                                                             |
| `ai_model`            | No       | `gpt-4o`                                    | Model identifier for the chosen provider                                                                                                                                                                                                                                                            |
| `api_key`             | No       |                                             | API key for the provider. For `github-models`, leave empty to use `github_token`, or supply an alternative PAT (e.g. an instructor token with an alternative licence) to override it                                                                                                                |
| `azure_endpoint`      | No       |                                             | Azure OpenAI endpoint URL (required for `azure-openai`)                                                                                                                                                                                                                                             |
| `num_questions`       | No       | `5`                                         | Number of questions to generate (minimum 1, maximum 50). Supplied values above 50 are automatically capped to 50.                                                                                                                                                                                   |
| `include_patterns`    | No       |                                             | Comma-separated globs for files to include                                                                                                                                                                                                                                                          |
| `exclude_patterns`    | No       | _(common non-code files)_                   | Comma-separated globs for files to exclude                                                                                                                                                                                                                                                          |
| `output_file`         | No       | `grill-my-code.md`                          | Path for the output Markdown file                                                                                                                                                                                                                                                                   |
| `post_pr_comment`     | No       | `true`                                      | Post assessment as a PR comment                                                                                                                                                                                                                                                                     |
| `post_issue`          | No       | `false`                                     | Create a GitHub Issue with the assessment                                                                                                                                                                                                                                                           |
| `post_discussion`     | No       | `false`                                     | Create a GitHub Discussion with the assessment                                                                                                                                                                                                                                                      |
| `discussion_category` | No       | `Assessments`                               | Discussion category name                                                                                                                                                                                                                                                                            |
| `additional_context`  | No       |                                             | Instructor-specific instructions for this assignment. Injected at the end of the system prompt and takes precedence over any conflicting default behaviour. Supports multi-line, detailed instructions.                                                                                             |
| `skip_initial_commit` | No       | `true`                                      | Exclude GitHub Classroom starter files from the diff                                                                                                                                                                                                                                                |
| `skip_committers`     | No       | `github-classroom[bot],github-actions[bot]` | Comma-separated list of commit author names or email substrings. Consecutive leading commits (immediately after the base SHA) whose author matches any entry are excluded from the diff. Only a leading run is skipped — bot commits after any student commit are included. Set to `''` to disable. |
| `base_sha`            | No       |                                             | Override the base commit SHA                                                                                                                                                                                                                                                                        |
| `head_sha`            | No       |                                             | Override the head commit SHA                                                                                                                                                                                                                                                                        |

### Outputs

| Output              | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `output_file`       | Path to the generated assessment Markdown file                   |
| `questions`         | The raw generated questions as a string                          |
| `code_before_strip` | Full code content of all assessed files before comment stripping |
| `code_after_strip`  | Full code content of all assessed files after comment stripping  |

## Example workflows

Ready-to-use workflow files for each configuration are available in [docs/example_workflows/](docs/example_workflows/). Copy the relevant file into `.github/workflows/` in your repository.

### Pull request (recommended)

Generates questions whenever a student opens or updates a PR, and posts them as a PR comment.

```yaml
name: Code Assessment
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  assess:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write # required to post the PR comment
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          num_questions: '5'
          additional_context: 'Assignment 3 — Python list comprehensions'
```

### Push to branch

Generates questions on every push. Useful when students work directly on a branch without opening a PR.

```yaml
name: Code Assessment
on:
  push:
    branches-ignore: [main, master]

jobs:
  assess:
    runs-on: ubuntu-latest
    permissions:
      contents: write # required to write the output file to the repo
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          post_pr_comment: 'false'
          output_file: 'grill-my-code.md'
```

### Post to GitHub Issues

Creates a searchable GitHub Issue for each assessment run. Previous issues for the same branch are automatically closed.

```yaml
jobs:
  assess:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          post_issue: 'true'
          post_pr_comment: 'false'
```

### Post to GitHub Discussions

Creates a Discussion instead of (or as well as) a PR comment. Requires Discussions to be enabled on the repository and the named category to already exist.

```yaml
jobs:
  assess:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      discussions: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          post_discussion: 'true'
          discussion_category: 'Assessments'
```

### Using a third-party AI provider

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    ai_provider: 'openai'
    ai_model: 'gpt-4o'
    api_key: ${{ secrets.OPENAI_API_KEY }}
    num_questions: '8'
    additional_context: 'Web Development — REST API design with Express.js'
```

---

## Permissions

| Permission             | When required                                                  |
| ---------------------- | -------------------------------------------------------------- |
| `contents: read`       | Always — needed to check out the repo and read the git history |
| `contents: write`      | When writing the output file back to the repository            |
| `models: read`         | When using the `github-models` provider (the default)          |
| `pull-requests: write` | When `post_pr_comment: 'true'` (the default)                   |
| `issues: write`        | When `post_issue: 'true'`                                      |
| `discussions: write`   | When `post_discussion: 'true'`                                 |

---

## GitHub Classroom

This action is designed to work with GitHub Classroom. By default (`skip_initial_commit: 'true'`), the diff base is pinned to the repository's very first commit — the template/starter code committed by Classroom. This means only code written by the student after accepting the assignment is assessed, and template boilerplate is never included in the diff.

In addition, the `skip_committers` input (defaulting to `github-classroom[bot],github-actions[bot]`) automatically advances the base past any consecutive bot commits that appear immediately after that first commit — for example, the feedback pull request or autograder setup commits that Classroom applies when a student accepts an assignment.

Set `skip_initial_commit: 'false'` only if you want to assess the delta between the PR base branch and head (standard PR diffing behaviour). Set `skip_committers: ''` to disable bot-commit skipping entirely.

---

## Output file naming

All assessment files are written under the `_assessment/` folder. Any directory component of the `output_file` setting is ignored — only the basename is used. On the default branch (`main`/`master`) the file keeps the configured basename; on any other branch the sanitised branch name is appended before the extension:

| Branch            | `output_file` setting | Actual file written                            |
| ----------------- | --------------------- | ---------------------------------------------- |
| `main`            | `grill-my-code.md`    | `_assessment/grill-my-code.md`                 |
| `feat/login-form` | `grill-my-code.md`    | `_assessment/grill-my-code-feat-login-form.md` |
| `student/a1`      | `assessment.md`       | `_assessment/assessment-student-a1.md`         |

---

## Using action outputs

The action exposes two outputs for use in later steps:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  id: assess
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}

- name: Upload assessment
  uses: actions/upload-artifact@v4
  with:
    name: assessment
    path: ${{ steps.assess.outputs.output_file }}

- name: Print questions
  run: echo "${{ steps.assess.outputs.questions }}"
```

---

## Exclude patterns behaviour

The default `exclude_patterns` list covers common non-code files (lock files, images, build artefacts, minified assets). **Providing a custom value completely replaces this list** — it does not extend it. If you want to add patterns while keeping the defaults, you must repeat them:

```yaml
exclude_patterns: 'node_modules/**,**/*.lock,dist/**,tests/**'
```

---

## Further reading

| Document                                           | Description                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| [docs/ai-providers.md](docs/ai-providers.md)       | Supported AI providers, required inputs, secrets, and example snippets for each |
| [docs/architecture.md](docs/architecture.md)       | How the Docker-based action is structured and executed                          |
| [docs/example_workflows/](docs/example_workflows/) | Numbered, copy-paste workflow files for each configuration                      |
| [docs/contributing.md](docs/contributing.md)       | Local development setup, commit conventions, and the release process            |
| [docs/versioning.md](docs/versioning.md)           | Release guide — cutting patch and major versions                                |
