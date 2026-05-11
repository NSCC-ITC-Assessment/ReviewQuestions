---
sidebar_position: 7
---

# All Inputs

A fully annotated workflow showing every available input. Inputs that don't apply to the pull-request scenario are commented out with an explanation of when they would be used instead.

Copy this file to `.github/workflows/assess.yml` in the student repository and remove or adjust inputs as needed.

```yaml
name: Code Assessment

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: write       # required to commit the output file back to the repo
      pull-requests: write  # required to post the PR comment
      models: read          # required to call GitHub Models API
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          # ── Authentication ────────────────────────────────────────────────

          # GitHub token used for API access and as the GitHub Models credential.
          # The built-in token is sufficient for most setups; supply an instructor
          # PAT here if you need an account with a higher GitHub Models rate limit.
          github_token: ${{ secrets.GITHUB_TOKEN }}

          # ── AI Provider ───────────────────────────────────────────────────

          # Provider to use for question generation.
          # Supported values: github-models | openai | openrouter | azure-openai
          ai_provider: "github-models"

          # Model identifier for the chosen provider.
          # GitHub Models: gpt-4o, gpt-4o-mini, Phi-3-mini-128k-instruct
          # OpenAI:        gpt-4o, gpt-4-turbo
          # Azure OpenAI:  your deployment name
          # OpenRouter:    provider/model-name format (e.g. anthropic/claude-3-5-sonnet)
          ai_model: "gpt-4o"

          # API key for the provider. Leave empty when using github-models with
          # the built-in GITHUB_TOKEN. Required for openai, openrouter, azure-openai.
          # api_key: ${{ secrets.OPENAI_API_KEY }}

          # Azure OpenAI only: full endpoint URL including deployment path.
          # azure_endpoint: ${{ secrets.AZURE_OPENAI_ENDPOINT }}

          # ── Question generation ───────────────────────────────────────────

          # Number of comprehension questions to generate. Minimum 1, maximum 50.
          num_questions: "5"

          # Assignment-specific instructions for the AI. Injected at the end of
          # the system prompt and takes precedence over default behaviour.
          # Supports multi-line YAML strings.
          additional_context: |
            Assignment 3 — Python list comprehensions.
            Focus questions on: when list comprehensions are appropriate,
            performance trade-offs, and readability.

          # Comma-separated file glob(s) whose contents are read from the repo
          # and injected into the prompt as assignment context (before
          # additional_context). Useful for README files, assignment briefs, or
          # coding style guides. Leave empty (default) to disable.
          # assignment_context: "README.md, assignment.md, coding_style.md"

          # ── File filtering ────────────────────────────────────────────────

          # Comma-separated glob patterns for files to include.
          # Leave empty to include all files not matched by exclude_patterns.
          # include_patterns: 'src/**/*.py'

          # Comma-separated glob patterns for files to exclude.
          # WARNING: providing a value here REPLACES the default list entirely.
          # Repeat the defaults alongside your additions if you want both.
          # exclude_patterns: 'node_modules/**,**/*.lock,dist/**'

          # Whether to exclude .github/workflows/** from the assessed diff.
          # Set to "false" to include workflow files in comprehension questions.
          exclude_workflow_files: "true"

          # ── Output & delivery ─────────────────────────────────────────────

          # Filename for the written assessment file (basename only — directory
          # components are ignored). Always written under _assessment/.
          output_file: "grill-my-code.md"

          # Post the assessment as a pull request comment.
          post_pr_comment: "true"

          # Create a GitHub Issue with the assessment.
          # Requires issues: write permission.
          post_issue: "false"

          # Create a GitHub Discussion with the assessment.
          # Requires discussions: write (and administration: write if not yet enabled).
          post_discussion: "false"

          # Discussion category name (must already exist in repository settings).
          discussion_category: "Assessments"

          # ── Comment stripping ─────────────────────────────────────────────

          # When false (default), inline and block comments are stripped from
          # the code before sending it to the AI. Set to "true" to preserve them.
          keep_comments: "false"

          # ── Diff resolution ───────────────────────────────────────────────

          # Pin the diff base to the repository's first commit (default: true).
          # Set to "false" to use the empty tree as the base instead,
          # which includes the initial commit's files in the diff.
          skip_initial_commit: "true"

          # Comma-separated list of author names or email substrings.
          # A leading run of commits whose author matches any entry is skipped.
          # Only skips a contiguous leading run — not all matching commits.
          # Set to '' to disable entirely.
          skip_committers: "github-classroom[bot],github-actions[bot]"

          # Manually override the base and/or head commit SHA.
          # These take precedence over all automatic SHA resolution.
          # base_sha: ''
          # head_sha: ''
```
