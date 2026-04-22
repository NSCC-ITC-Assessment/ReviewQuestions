/**
 * Delivery: GitHub Issue
 *
 * Closes any previously open assessment issues for the same branch, then
 * creates a new one containing the latest report.
 */

import * as core from '@actions/core';
import { GIT_SHA_SHORT_LENGTH, ISSUES_PER_PAGE } from '../constants.js';

export async function postIssue({ octokit, ctx, report, branchName, headSha }) {
  const shortHead = headSha.substring(0, GIT_SHA_SHORT_LENGTH);
  const branchPart = branchName ? ` (${branchName})` : '';
  const title = `Grill My Code${branchPart} — ${shortHead}`;
  const { owner, repo } = ctx.repo;

  // ── Close any open predecessor issues for this branch ────────────────────
  const searchStr = branchName ? `Grill My Code (${branchName})` : 'Grill My Code';

  const existing = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    labels: 'assessment',
    per_page: ISSUES_PER_PAGE,
  });

  const predecessors = existing.data.filter((i) => i.title.startsWith(searchStr));

  for (const prev of predecessors) {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prev.number,
      body: `> ℹ️ This assessment has been superseded by a new run triggered by commit \`${shortHead}\`. See the new issue for the latest questions.`,
    });
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: prev.number,
      state: 'closed',
    });
    core.info(`Closed superseded assessment Issue #${prev.number}`);
  }

  // ── Create the new issue ──────────────────────────────────────────────────
  const { data: issue } = await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body: report,
    labels: ['assessment'],
  });
  core.info(`Assessment created as Issue #${issue.number}: ${issue.html_url}`);
}
