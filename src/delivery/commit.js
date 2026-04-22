/**
 * Delivery: Commit Assessment File to Repository
 *
 * Creates or replaces the assessment Markdown file in the repository by
 * committing it via the GitHub Contents API. This works for all event types
 * (push, pull_request, workflow_dispatch) without requiring a git checkout.
 *
 * For pull requests from forks the GITHUB_TOKEN will not have write access to
 * the fork — in that case a warning is logged and the step is skipped rather
 * than failing the workflow.
 */

import * as core from '@actions/core';
import { Buffer } from 'node:buffer';
import { GIT_SHA_SHORT_LENGTH } from '../constants.js';

export async function commitAssessmentFile({
  octokit,
  ctx,
  filePath,
  content,
  branchName,
  headSha,
}) {
  const { owner, repo } = ctx.repo;
  const shortHead = headSha.substring(0, GIT_SHA_SHORT_LENGTH);
  const message = `chore: update assessment questions for ${shortHead} [skip ci]`;

  // Fetch the existing file's blob SHA (required by the API when updating).
  let existingSha;
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branchName || undefined,
    });
    existingSha = data.sha;
  } catch (err) {
    if (err.status !== 404) throw err;
    // File does not exist yet — will be created.
  }

  try {
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      sha: existingSha,
      branch: branchName || undefined,
    });
    core.info(`Assessment file committed to repository: ${filePath}`);
  } catch (err) {
    if (err.status === 403 || err.status === 422) {
      core.warning(
        `Could not commit assessment file (status ${err.status}) — ` +
          'this is expected for pull requests from forks where the token lacks write access.',
      );
    } else {
      throw err;
    }
  }
}
