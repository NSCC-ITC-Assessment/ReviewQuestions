/**
 * Delivery: GitHub Discussion
 *
 * Closes (locks) any previously open assessment discussions for the same
 * branch, then creates a new one containing the latest report.
 */

import * as core from '@actions/core';
import {
  DISCUSSION_CATEGORIES_FETCH_LIMIT,
  DISCUSSIONS_FETCH_LIMIT,
  GIT_SHA_SHORT_LENGTH,
} from '../constants.js';

export async function postDiscussion({ octokit, ctx, report, branchName, headSha, categoryName }) {
  const shortHead = headSha.substring(0, GIT_SHA_SHORT_LENGTH);
  const branchPart = branchName ? ` (${branchName})` : '';
  const title = `Grill My Code${branchPart} — ${shortHead}`;
  const searchStr = branchName ? `Grill My Code (${branchName})` : 'Grill My Code';

  // ── Step 1: resolve repo node ID, category ID, and existing discussions ──
  const repoQuery = await octokit.graphql(
    `query($owner: String!, $repo: String!) {
       repository(owner: $owner, name: $repo) {
         id
         discussionCategories(first: ${DISCUSSION_CATEGORIES_FETCH_LIMIT}) {
           nodes { id name }
         }
         discussions(first: ${DISCUSSIONS_FETCH_LIMIT}, orderBy: { field: CREATED_AT, direction: DESC }) {
           nodes { id number title isAnswered locked url }
         }
       }
     }`,
    { owner: ctx.repo.owner, repo: ctx.repo.repo },
  );

  const repoId = repoQuery.repository.id;
  const categories = repoQuery.repository.discussionCategories.nodes;
  const category = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());

  if (!category) {
    const available = categories.map((c) => `"${c.name}"`).join(', ');
    throw new Error(
      `Discussion category "${categoryName}" not found in this repository.\n` +
        `Available categories: ${available || '(none — Discussions may not be enabled)'}\n` +
        `Create the category in the repository's Discussions settings, or set ` +
        `discussion_category to one of the names listed above.`,
    );
  }

  // ── Step 2: lock predecessor discussions for this branch ─────────────────
  const predecessors = repoQuery.repository.discussions.nodes.filter(
    (d) => !d.locked && d.title.startsWith(searchStr),
  );

  for (const prev of predecessors) {
    await octokit.graphql(
      `mutation($discussionId: ID!, $body: String!) {
         addDiscussionComment(input: { discussionId: $discussionId, body: $body }) {
           comment { id }
         }
       }`,
      {
        discussionId: prev.id,
        body: `> ℹ️ This assessment has been superseded by a new run triggered by commit \`${shortHead}\`. See the new discussion for the latest questions.`,
      },
    );
    await octokit.graphql(
      `mutation($discussionId: ID!) {
         lockLockable(input: { lockableId: $discussionId, lockReason: RESOLVED }) {
           lockedRecord { locked }
         }
       }`,
      { discussionId: prev.id },
    );
    core.info(`Locked superseded assessment Discussion #${prev.number}`);
  }

  // ── Step 3: create the new discussion ────────────────────────────────────
  const mutation = await octokit.graphql(
    `mutation($repoId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
       createDiscussion(input: {
         repositoryId: $repoId,
         categoryId:   $categoryId,
         title:        $title,
         body:         $body
       }) {
         discussion { number url }
       }
     }`,
    { repoId, categoryId: category.id, title, body: report },
  );

  const disc = mutation.createDiscussion.discussion;
  core.info(`Assessment created as Discussion #${disc.number}: ${disc.url}`);
}
