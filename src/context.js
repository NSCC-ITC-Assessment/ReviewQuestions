/**
 * GitHub Actions Context Helpers
 *
 * Interprets the GitHub Actions event context to resolve commit SHAs, branch
 * names, and output file paths. All functions in this module depend on the
 * Actions context (ctx / GITHUB_REF) or the Octokit client.
 */

import * as core from '@actions/core';
import path from 'path';
import { GIT_SHA_SHORT_LENGTH } from './constants.js';
import { advanceBasePastBotCommits, getFirstCommit } from './git.js';

/**
 * Determines the base and head commit SHAs for the diff based on the
 * GitHub Actions event type. Manual overrides take precedence.
 *
 * When inputs.skipInitialCommit is true the base SHA is always pinned to the
 * repository's very first commit, regardless of the event type. This ensures
 * that starter/template files committed by GitHub Classroom (the "Initial
 * commit") are never included in the assessed diff — only code added or
 * modified by the student after that first commit will appear.
 *
 * Manual base_sha / head_sha overrides always take precedence over this flag.
 */
export async function resolveSHAs(ctx, octokit, inputs) {
  // Manual override: both SHAs explicitly provided — honour them as-is.
  if (inputs.baseSha && inputs.headSha) {
    return {
      baseSha: sanitiseSha(inputs.baseSha),
      headSha: sanitiseSha(inputs.headSha),
      prNumber: null,
    };
  }

  const event = ctx.eventName;
  let baseSha,
    headSha,
    prNumber = null;

  // ── Determine the event-specific head SHA and PR number ─────────────────
  if (event === 'pull_request' || event === 'pull_request_target') {
    baseSha = ctx.payload.pull_request.base.sha;
    headSha = ctx.payload.pull_request.head.sha;
    prNumber = ctx.payload.pull_request.number;
  } else if (event === 'push') {
    headSha = sanitiseSha(ctx.payload.after);
    const before = ctx.payload.before;
    // All-zero SHA means this is the very first push to a new branch.
    baseSha = /^0+$/.test(before) ? getFirstCommit() : sanitiseSha(before);
  } else if (event === 'issue_comment') {
    const prNum = ctx.payload.issue.number;
    const { data: pr } = await octokit.rest.pulls.get({
      owner: ctx.repo.owner,
      repo: ctx.repo.repo,
      pull_number: prNum,
    });
    baseSha = pr.base.sha;
    headSha = pr.head.sha;
    prNumber = prNum;
  } else {
    // workflow_dispatch and all other events: HEAD of the current branch.
    baseSha = getFirstCommit();
    headSha = sanitiseSha(ctx.sha);
  }

  // ── Apply skip_initial_commit override ──────────────────────────────────
  if (inputs.skipInitialCommit) {
    const initialCommit = getFirstCommit();
    if (baseSha !== initialCommit) {
      core.info(
        `skip_initial_commit is enabled: overriding base SHA from ` +
          `${baseSha.substring(0, GIT_SHA_SHORT_LENGTH)} to initial commit ${initialCommit.substring(0, GIT_SHA_SHORT_LENGTH)} ` +
          `to exclude GitHub Classroom starter files from the diff.`,
      );
      baseSha = initialCommit;
    }
  }

  // ── Apply skip_committers ────────────────────────────────────────────────
  // Advance baseSha past any consecutive leading commits by bot accounts so
  // that automated Classroom/Actions commits are excluded from the diff.
  if (inputs.skipCommitters && inputs.skipCommitters.length > 0) {
    const advancedBase = advanceBasePastBotCommits(baseSha, headSha, inputs.skipCommitters);
    if (advancedBase !== baseSha) {
      core.info(
        `skip_committers: advanced base SHA from ${baseSha.substring(0, GIT_SHA_SHORT_LENGTH)} to ` +
          `${advancedBase.substring(0, GIT_SHA_SHORT_LENGTH)} to exclude consecutive bot commits from the diff.`,
      );
      baseSha = advancedBase;
    }
  }

  // Apply a manual base_sha-only override (head still auto-detected).
  if (inputs.baseSha) {
    baseSha = sanitiseSha(inputs.baseSha);
  }

  return { baseSha, headSha, prNumber };
}

/**
 * Validates that a string looks like a git SHA to prevent shell injection.
 */
export function sanitiseSha(sha) {
  if (!/^[0-9a-f]{4,64}$/i.test(sha)) {
    throw new Error(`Invalid git commit SHA: "${sha}"`);
  }
  return sha;
}

/**
 * Returns the branch name for the current event.
 * Falls back to parsing GITHUB_REF when context properties are absent.
 */
export function resolveBranch(ctx) {
  // pull_request / pull_request_target: the head branch of the PR
  if (ctx.payload.pull_request) {
    return ctx.payload.pull_request.head.ref;
  }
  // issue_comment: branch isn't directly available; return a placeholder
  if (ctx.eventName === 'issue_comment') {
    return '';
  }
  // push / workflow_dispatch / schedule / etc: parse from GITHUB_REF
  const ref = process.env.GITHUB_REF || ctx.ref || '';
  const match = ref.match(/^refs\/heads\/(.+)$/);
  return match ? match[1] : ref;
}

/**
 * Derives the effective output file path under the _assessment/ folder.
 *
 * On main/master (or when the branch is unknown) the file is named after
 * the configured output_file basename. On any other branch the sanitised
 * branch name is appended before the extension so each branch produces a
 * distinct file, all stored under _assessment/.
 */
export function resolveOutputFile(outputFile, branchName) {
  const ext = path.extname(outputFile);
  const base = path.basename(outputFile, ext);
  const isDefaultBranch = !branchName || branchName === 'main' || branchName === 'master';

  if (isDefaultBranch) return `_assessment/${base}${ext}`;

  const safeBranch = branchName
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  return `_assessment/${base}-${safeBranch}${ext}`;
}
