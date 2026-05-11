---
sidebar_position: 2
---

# Exclude Patterns

The `exclude_patterns` input controls which files are excluded from the assessed diff.

## Default behaviour

When no `exclude_patterns` value is provided, a built-in list of common non-code files is used automatically. This list covers:

- Package lock files (`**/*.lock`, `**/pnpm-lock.yaml`, etc.)
- Dependency directories (`node_modules/**`, `vendor/**`)
- Build outputs and minified assets (`dist/**`, `build/**`, `**/*.min.js`)
- Images and binary files (`**/*.png`, `**/*.jpg`, `**/*.pdf`, etc.)

## Custom patterns

:::warning Replacement, not extension

Providing a custom `exclude_patterns` value **completely replaces** the default list — it does not extend it. If you want to keep the defaults and add more patterns, you must repeat the defaults explicitly.

:::

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    # Extend the defaults by repeating them alongside your additions
    exclude_patterns: 'node_modules/**,**/*.lock,dist/**,tests/**'
```

## Include patterns

Use `include_patterns` to restrict the assessed files to a specific subset. Only files matching at least one include pattern are assessed. If left empty, all files not matching the exclude patterns are included.

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    # Only assess Python source files
    include_patterns: 'src/**/*.py'
```

## Workflow files

GitHub Actions workflow files (`.github/workflows/**`) are excluded by default via the `exclude_workflow_files` input (which defaults to `true`). Set it to `"false"` to include them:

```yaml
exclude_workflow_files: 'false'
```
