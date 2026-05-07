# Copilot Instructions

## Documentation & Example Workflow Updates

Any change to the action's functionality — including new inputs, changed defaults, modified behaviours, or removed features — **must** be accompanied by:

1. **Documentation updates** — Update all affected files under `docs/` and the inputs/outputs tables in `README.md` to reflect the change accurately.
2. **Example workflow updates** — Update any affected example workflows under `docs/example_workflows/`, and add a new example if the change introduces a capability not covered by an existing one.

Do not implement a functional change in isolation. Documentation and example workflows are part of the same deliverable.

## New Inputs

New inputs must be added consistently across **all five locations**:

1. `action.yml` — input declaration, description, and default
2. `src/inputs.js` — parsing and normalisation
3. `src/constants.js` — any associated defaults, limits, or threshold values
4. `README.md` — inputs table row
5. `docs/example_workflows/7-all-inputs.yml` — active or commented-out entry with an inline explanatory comment

## New AI Providers

Adding a new `ai_provider` value requires changes in all of the following places:

1. `src/ai.js` — new `case` in the provider `switch`
2. `action.yml` — updated `ai_provider` input description listing the new value
3. `README.md` — updated `ai_provider` description in the inputs table
4. A new dedicated example workflow under `docs/example_workflows/` following the naming and style of `5-openai-provider.yml` and `6-azure-openai-provider.yml`

## Constants vs Magic Numbers

Numeric limits, default values, threshold values, and external API version strings must be defined as named, documented exports in `src/constants.js`. Do not hard-code them inline in other modules.

## No Shell Interpolation

All `git` and external process invocations must use `spawnSync` with a plain args array. Do not use `exec`, `execSync`, or template-string shell commands. This prevents shell-injection vulnerabilities.

## Commit Messages

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/) as enforced by the `commit-msg` hook:

```
<type>(<optional scope>): <subject>
```

Functional changes use `feat:` or `fix:`. Documentation-only changes use `docs:`. A full list of allowed types is in `docs/contributing.md`.

## Example Workflow Numbering

New example workflows must be named `<N>-<short-description>.yml` where `<N>` is one greater than the current highest number. Existing example workflow numbers must never be changed.
