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
