---
sidebar_position: 8
---

# Assignment Context

Automatically injects assignment files (README, brief, rubric, style guide, etc.) into the AI prompt so questions are targeted to the specific requirements of the assignment — without manually copying content into `additional_context`.

Copy this file to `.github/workflows/assess.yml` in the student repository.

```yaml
name: Code Assessment

on:
  push:
    branches-ignore:
      - main
      - master

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: write  # required to commit the output file back to the repo
      models: read     # required to call GitHub Models API
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          num_questions: "5"
          # Read files from the repository and inject their contents into the
          # AI prompt automatically. Globs are matched against the full relative
          # path from the repo root, so subdirectory paths and wildcards work
          # (e.g. "docs/assignment.md", "**/*.md").
          assignment_context: "README.md, assignment.md"
```

## Notes

- `assignment_context` accepts a comma-separated list of glob patterns — all matching files are concatenated and injected before `additional_context` in the prompt
- If no files match the globs, a workflow warning is emitted and the action continues without assignment context
- Combined file contents are capped at `assignment_context_max_chars` characters (default `20000`) to prevent extremely large files from flooding the prompt
- Common files to include: `README.md`, assignment brief, rubric, or any instructor-maintained requirements document
