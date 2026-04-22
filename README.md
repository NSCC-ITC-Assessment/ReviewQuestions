# Review Questions Generator

A GitHub Action that analyses code changes and uses AI to generate targeted comprehension questions for viva voce or written assessments.

## How it works

1. Detects the commit range from the triggering event (push, pull request, etc.)
2. Collects the git diff of changed files, applying include/exclude filters
3. Sends the diff to an AI provider to generate comprehension questions
4. Writes the assessment to a Markdown file, and optionally posts it as a PR comment, GitHub Issue, or GitHub Discussion

## Usage

```yaml
- uses: NSCC-ITC-Assessment/ReviewQuestions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Inputs

| Input                 | Required | Default                   | Description                                                                                                                                                                          |
| --------------------- | -------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `github-token`        | Yes      | `${{ github.token }}`     | GitHub token for API access and GitHub Models credential                                                                                                                             |
| `ai-provider`         | No       | `github-models`           | AI provider: `github-models`, `openai`, `openrouter`, or `azure-openai`                                                                                                              |
| `ai-model`            | No       | `gpt-4o`                  | Model identifier for the chosen provider                                                                                                                                             |
| `api-key`             | No       |                           | API key for the provider. For `github-models`, leave empty to use `github-token`, or supply an alternative PAT (e.g. an instructor token with an alternative licence) to override it |
| `azure-endpoint`      | No       |                           | Azure OpenAI endpoint URL (required for `azure-openai`)                                                                                                                              |
| `num-questions`       | No       | `5`                       | Number of questions to generate                                                                                                                                                      |
| `include-patterns`    | No       |                           | Comma-separated globs for files to include                                                                                                                                           |
| `exclude-patterns`    | No       | _(common non-code files)_ | Comma-separated globs for files to exclude                                                                                                                                           |
| `output-file`         | No       | `assessment-questions.md` | Path for the output Markdown file                                                                                                                                                    |
| `post-pr-comment`     | No       | `true`                    | Post assessment as a PR comment                                                                                                                                                      |
| `post-issue`          | No       | `false`                   | Create a GitHub Issue with the assessment                                                                                                                                            |
| `post-discussion`     | No       | `false`                   | Create a GitHub Discussion with the assessment                                                                                                                                       |
| `discussion-category` | No       | `Assessments`             | Discussion category name                                                                                                                                                             |
| `additional-context`  | No       |                           | Assignment/topic context for more relevant questions                                                                                                                                 |
| `skip-initial-commit` | No       | `true`                    | Exclude GitHub Classroom starter files from the diff                                                                                                                                 |
| `base-sha`            | No       |                           | Override the base commit SHA                                                                                                                                                         |
| `head-sha`            | No       |                           | Override the head commit SHA                                                                                                                                                         |

### Outputs

| Output        | Description                                    |
| ------------- | ---------------------------------------------- |
| `output-file` | Path to the generated assessment Markdown file |
| `questions`   | The raw generated questions as a string        |

## Example workflows

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

      - uses: NSCC-ITC-Assessment/ReviewQuestions@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          num-questions: '5'
          additional-context: 'Assignment 3 — Python list comprehensions'
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

      - uses: NSCC-ITC-Assessment/ReviewQuestions@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          post-pr-comment: 'false'
          output-file: 'assessment-questions.md'
```

### Post to GitHub Issues

Creates a searchable GitHub Issue for each assessment run. Previous issues for the same branch are automatically closed.

```yaml
- uses: NSCC-ITC-Assessment/ReviewQuestions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    post-issue: 'true'
    post-pr-comment: 'false'
  permissions:
    contents: read
    issues: write
```

### Post to GitHub Discussions

Creates a Discussion instead of (or as well as) a PR comment. Requires Discussions to be enabled on the repository and the named category to already exist.

```yaml
- uses: NSCC-ITC-Assessment/ReviewQuestions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    post-discussion: 'true'
    discussion-category: 'Assessments'
  permissions:
    contents: read
    discussions: write
```

### Using a third-party AI provider

```yaml
- uses: NSCC-ITC-Assessment/ReviewQuestions@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    ai-provider: 'openai'
    ai-model: 'gpt-4o'
    api-key: ${{ secrets.OPENAI_API_KEY }}
    num-questions: '8'
    additional-context: 'Web Development — REST API design with Express.js'
```

---

## Permissions

| Permission             | When required                                                  |
| ---------------------- | -------------------------------------------------------------- |
| `contents: read`       | Always — needed to check out the repo and read the git history |
| `contents: write`      | When writing the output file back to the repository            |
| `pull-requests: write` | When `post-pr-comment: 'true'` (the default)                   |
| `issues: write`        | When `post-issue: 'true'`                                      |
| `discussions: write`   | When `post-discussion: 'true'`                                 |

---

## GitHub Classroom

This action is designed to work with GitHub Classroom. By default (`skip-initial-commit: 'true'`), the diff base is pinned to the repository's very first commit — the template/starter code committed by Classroom. This means only code written by the student after accepting the assignment is assessed, and template boilerplate is never included in the diff.

Set `skip-initial-commit: 'false'` only if you want to assess the delta between the PR base branch and head (standard PR diffing behaviour).

---

## Output file naming

On the default branch (`main`/`master`) the output file is written to the path specified by `output-file`. On any other branch the sanitised branch name is appended before the extension:

| Branch            | `output-file` setting     | Actual file written                       |
| ----------------- | ------------------------- | ----------------------------------------- |
| `main`            | `assessment-questions.md` | `assessment-questions.md`                 |
| `feat/login-form` | `assessment-questions.md` | `assessment-questions-feat-login-form.md` |
| `student/a1`      | `reports/assessment.md`   | `reports/assessment-student-a1.md`        |

---

## Using action outputs

The action exposes two outputs for use in later steps:

```yaml
- uses: NSCC-ITC-Assessment/ReviewQuestions@v1
  id: assess
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: Upload assessment
  uses: actions/upload-artifact@v4
  with:
    name: assessment
    path: ${{ steps.assess.outputs.output-file }}

- name: Print questions
  run: echo "${{ steps.assess.outputs.questions }}"
```

---

## Exclude patterns behaviour

The default `exclude-patterns` list covers common non-code files (lock files, images, build artefacts, minified assets). **Providing a custom value completely replaces this list** — it does not extend it. If you want to add patterns while keeping the defaults, you must repeat them:

```yaml
exclude-patterns: 'node_modules/**,**/*.lock,dist/**,tests/**'
```

---

## Contributing

See [docs/contributing.md](docs/contributing.md) for local development setup, commit conventions, and the release process.

## Versioning

See [docs/versioning.md](docs/versioning.md) for the full release guide including how to cut patch, minor, and major releases, and how to backport fixes to older release lines.
