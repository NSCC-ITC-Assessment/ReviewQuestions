# Code Comprehension Assessment

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

| Input                 | Required | Default                   | Description                                                             |
| --------------------- | -------- | ------------------------- | ----------------------------------------------------------------------- |
| `github-token`        | Yes      | `${{ github.token }}`     | GitHub token for API access and GitHub Models credential                |
| `ai-provider`         | No       | `github-models`           | AI provider: `github-models`, `openai`, `openrouter`, or `azure-openai` |
| `ai-model`            | No       | `gpt-4o`                  | Model identifier for the chosen provider                                |
| `api-key`             | No       |                           | API key (not needed for `github-models`)                                |
| `azure-endpoint`      | No       |                           | Azure OpenAI endpoint URL (required for `azure-openai`)                 |
| `num-questions`       | No       | `5`                       | Number of questions to generate                                         |
| `include-patterns`    | No       |                           | Comma-separated globs for files to include                              |
| `exclude-patterns`    | No       | _(common non-code files)_ | Comma-separated globs for files to exclude                              |
| `output-file`         | No       | `assessment-questions.md` | Path for the output Markdown file                                       |
| `post-pr-comment`     | No       | `true`                    | Post assessment as a PR comment                                         |
| `post-issue`          | No       | `false`                   | Create a GitHub Issue with the assessment                               |
| `post-discussion`     | No       | `false`                   | Create a GitHub Discussion with the assessment                          |
| `discussion-category` | No       | `Assessments`             | Discussion category name                                                |
| `additional-context`  | No       |                           | Assignment/topic context for more relevant questions                    |
| `skip-initial-commit` | No       | `true`                    | Exclude GitHub Classroom starter files from the diff                    |
| `base-sha`            | No       |                           | Override the base commit SHA                                            |
| `head-sha`            | No       |                           | Override the head commit SHA                                            |

### Outputs

| Output        | Description                                    |
| ------------- | ---------------------------------------------- |
| `output-file` | Path to the generated assessment Markdown file |
| `questions`   | The raw generated questions as a string        |

## Example workflow

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
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: NSCC-ITC-Assessment/ReviewQuestions@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          num-questions: '5'
          additional-context: 'Assignment 3 — Python list comprehensions'
```
