/**
 * Input Handling
 *
 * Reads and normalises all INPUT_* environment variables set by the GitHub
 * Action. Responsible for parsing, applying defaults, and clamping values
 * to valid ranges.
 */

import * as core from '@actions/core';
import { DEFAULT_EXCLUDE_PATTERNS, MAX_QUESTIONS } from './constants.js';

export function readInputs() {
  const includeStr = core.getInput('include_patterns');
  const excludeStr = core.getInput('exclude_patterns');

  const rawNumQuestions = Math.max(1, parseInt(core.getInput('num_questions') || '5', 10));
  const numQuestions = Math.min(MAX_QUESTIONS, rawNumQuestions);
  if (rawNumQuestions > MAX_QUESTIONS) {
    core.warning(
      `num_questions was set to ${rawNumQuestions}, which exceeds the maximum of ${MAX_QUESTIONS}. Capping to ${MAX_QUESTIONS}.`,
    );
  }

  return {
    githubToken: core.getInput('github_token', { required: true }),
    aiProvider: core.getInput('ai_provider') || 'github-models',
    aiModel: core.getInput('ai_model') || 'gpt-4o',
    apiKey: core.getInput('api_key') || '',
    azureEndpoint: core.getInput('azure_endpoint') || '',
    numQuestions,
    includePatterns: includeStr
      ? includeStr
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
      : [],
    excludePatterns: excludeStr
      ? excludeStr
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
      : DEFAULT_EXCLUDE_PATTERNS,
    outputFile: core.getInput('output_file') || 'grill-my-code.md',
    postPrComment: core.getInput('post_pr_comment') !== 'false',
    postIssue: core.getInput('post_issue') === 'true',
    postDiscussion: core.getInput('post_discussion') === 'true',
    discussionCategory: core.getInput('discussion_category') || 'Assessments',
    additionalContext: core.getInput('additional_context') || '',
    skipInitialCommit: core.getInput('skip_initial_commit') !== 'false',
    baseSha: core.getInput('base_sha') || '',
    headSha: core.getInput('head_sha') || '',
  };
}
