/**
 * File Collection, Filtering, and Comment Stripping
 *
 * Handles the pipeline from a list of changed file paths through to formatted
 * code content ready for inclusion in the AI prompt: glob-based filtering,
 * fetching file contents from git, stripping comments via rmcm, and rendering
 * fenced code blocks.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';
import { COMMENT_REMOVER_BIN, COMMENT_STRIP_TIMEOUT_MS } from './constants.js';
import { git } from './git.js';

/**
 * Filters a list of file paths against include and exclude glob patterns.
 */
export function filterFiles(files, includePatterns, excludePatterns) {
  const opts = { dot: true, matchBase: true };
  let result = files;

  if (includePatterns.length > 0) {
    result = result.filter((f) => includePatterns.some((p) => minimatch(f, p, opts)));
  }

  if (excludePatterns.length > 0) {
    result = result.filter((f) => !excludePatterns.some((p) => minimatch(f, p, opts)));
  }

  return result;
}

/**
 * Fetches the content of each file at headSha and returns raw file entries.
 * Files that cannot be read (e.g. deleted) are silently skipped.
 */
export function collectRawFiles(files, headSha) {
  const rawFiles = [];
  for (const filepath of files) {
    let content;
    try {
      content = git('show', `${headSha}:${filepath}`);
    } catch {
      // Deleted files or other git errors — skip
      continue;
    }
    rawFiles.push({ filepath, content });
  }
  return rawFiles;
}

/**
 * Accepts pre-fetched raw file entries, runs rmcm on each, and returns
 * stripped entries. Falls back silently to the original content when the
 * file type is unsupported or the binary is unavailable.
 *
 * Returns the stripped file entries and cumulative character count.
 */
export function stripCommentsFromFiles(rawFiles) {
  const strippedFiles = [];
  let strippedCharCount = 0;

  for (const { filepath, content } of rawFiles) {
    const tmpFile = path.join('/tmp', `rmcm_${process.pid}_${path.basename(filepath)}`);
    let stripped = content;

    try {
      fs.writeFileSync(tmpFile, content, 'utf-8');
      const result = spawnSync(COMMENT_REMOVER_BIN, ['--collapse-whitespace', '1', tmpFile], {
        encoding: 'utf-8',
        timeout: COMMENT_STRIP_TIMEOUT_MS,
      });
      if (result.status === 0) {
        stripped = result.stdout;
      }
      // Non-zero exit means unsupported/unrecognised type — silently use original
    } catch {
      // Binary unavailable or other error — silently use original
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        /* ignore */
      }
    }

    strippedCharCount += stripped.length;
    strippedFiles.push({ filepath, content: stripped });
  }

  return { strippedFiles, strippedCharCount };
}

/**
 * Formats file entries as a series of fenced code blocks, one per file,
 * for inclusion in the AI prompt.
 */
export function buildCodeContent(files) {
  return files
    .map(({ filepath, content }) => {
      const ext = path.extname(filepath).slice(1);
      return `### \`${filepath}\`\n\`\`\`${ext}\n${content.trimEnd()}\n\`\`\``;
    })
    .join('\n\n');
}
