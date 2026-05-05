/**
 * Git Utilities
 *
 * Low-level wrappers around git CLI commands using spawnSync (no shell
 * interpolation). These functions have no GitHub Actions or Octokit
 * dependencies and can be used or tested independently.
 */

import { spawnSync } from 'child_process';
import { GIT_MAX_BUFFER } from './constants.js';

/**
 * Runs a git command using spawnSync and returns stdout.
 * Throws on non-zero exit.
 */
export function git(...args) {
  const result = spawnSync('git', args, {
    encoding: 'utf-8',
    maxBuffer: GIT_MAX_BUFFER,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args[0]} failed:\n${result.stderr}`);
  return result.stdout;
}

export function getFirstCommit() {
  return git('rev-list', '--max-parents=0', 'HEAD').trim();
}

export function getChangedFiles(baseSha, headSha) {
  return git('diff', '--name-only', baseSha, headSha)
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
}

export function getDiff(baseSha, headSha, files) {
  return git('diff', baseSha, headSha, '--', ...files);
}

/**
 * Advances baseSha past any consecutive commits (oldest-first from baseSha
 * towards headSha) whose author name or email contains one of the
 * skipCommitters substrings (case-insensitive).
 *
 * The walk stops as soon as a non-matching commit is encountered, so only a
 * leading run of bot commits is skipped — any bot commits that appear after
 * student work are left in the range.
 *
 * Returns the new baseSha (unchanged if no matching commits were found at
 * the start of the range).
 */
export function advanceBasePastBotCommits(baseSha, headSha, skipCommitters) {
  const raw = git('log', '--format=%H\t%ae\t%an', '--reverse', `${baseSha}..${headSha}`);
  const commits = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split('\t');
      return { sha: parts[0], email: parts[1] || '', name: parts[2] || '' };
    });

  let newBase = baseSha;
  for (const commit of commits) {
    const isBotCommit = skipCommitters.some((sc) => {
      const scLower = sc.toLowerCase();
      return (
        commit.email.toLowerCase().includes(scLower) || commit.name.toLowerCase().includes(scLower)
      );
    });
    if (isBotCommit) {
      newBase = commit.sha;
    } else {
      break;
    }
  }
  return newBase;
}
