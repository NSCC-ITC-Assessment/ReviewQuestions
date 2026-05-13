---
sidebar_position: 1
---

# Inputs & Outputs

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `github_token` | Yes | `${{ github.token }}` | GitHub token for API access and GitHub Models credential |
| `ai_provider` | No | `github-models` | AI provider: `github-models`, `openai`, `openrouter`, or `azure-openai` |
| `ai_model` | No | `gpt-4o` | Model identifier for the chosen provider |
| `api_key` | No | | API key for the provider. For `github-models`, leave empty to use `github_token`, or supply an instructor PAT to override it |
| `azure_endpoint` | No | | Azure OpenAI endpoint URL (required for `azure-openai`) |
| `num_questions` | No | `5` | Number of questions to generate (minimum 1, maximum 50). Values above 50 are automatically capped |
| `include_patterns` | No | | Comma-separated globs for files to include |
| `exclude_patterns` | No | *(common non-code files)* | Comma-separated globs for files to exclude |
| `output_file` | No | `grill-my-code.md` | Filename for the output Markdown file |
| `post_pr_comment` | No | `true` | Post assessment as a PR comment |
| `post_issue` | No | `false` | Create a GitHub Issue with the assessment. Automatically assigned to the student who authored the head commit |
| `post_discussion` | No | `false` | Create a GitHub Discussion with the assessment. Discussions are enabled automatically if not already on |
| `discussion_category` | No | `Assessments` | Discussion category name |
| `additional_context` | No | | Instructor-specific instructions for this assignment. Injected into the system prompt and takes precedence over default behaviour. Supports multi-line instructions |
| `assignment_context` | No | | Comma-separated file glob(s) read from the repository and injected into the AI prompt before `additional_context`. Supported file types: plain text / source files (UTF-8), PDF (`.pdf` — text layer only), Microsoft Word (`.doc`/`.docx` — text only). If no files match, a workflow warning is emitted and the action continues without context. Example: `"README.md, docs/brief.pdf, rubric.docx"` |
| `assignment_context_max_chars` | No | `20000` | Maximum total characters read from all `assignment_context` files combined. Prevents large files from flooding the prompt. Values below 1 are clamped to 1 |
| `exclude_workflow_files` | No | `true` | Exclude `.github/workflows/**` files from the assessed diff. Set to `"false"` to include workflow files |
| `keep_comments` | No | `false` | When `false` (default), inline and block comments are stripped before sending code to the AI. Set to `"true"` to preserve comments |
| `skip_initial_commit` | No | `true` | When `true` (default), pins the diff base to the first commit so starter/template files are excluded. When `false`, uses the empty tree as the base |
| `skip_committers` | No | `github-classroom[bot],github-actions[bot]` | Comma-separated list of commit author names or email substrings. Leading bot commits after the base SHA are excluded from the diff. Set to `''` to disable |
| `base_sha` | No | | Override the base commit SHA |
| `head_sha` | No | | Override the head commit SHA |

## Outputs

| Output | Description |
|---|---|
| `output_file` | Path to the generated assessment Markdown file |
| `questions` | The raw generated questions as a string |
| `code_before_strip` | Full code content of all assessed files before comment stripping |
| `code_after_strip` | Full code content of all assessed files after comment stripping |

## Using outputs in subsequent steps

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
