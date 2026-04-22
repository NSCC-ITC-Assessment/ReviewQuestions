/**
 * Code Comprehension Question Generator — Main Script
 *
 * Orchestrates the full assessment pipeline:
 *   1. Read and validate GitHub Actions inputs
 *   2. Resolve commit SHAs and branch name from the event context
 *   3. Collect changed files, filter them, strip comments, and build the prompt
 *   4. Call the configured AI provider to generate comprehension questions
 *   5. Write the report to a Markdown file and commit it to the repository
 *   6. Optionally post the report as a PR comment, GitHub Issue, or Discussion
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import fs from 'fs';
import path from 'path';
import { MAX_DIFF_CHARS, GIT_SHA_SHORT_LENGTH } from './constants.js';
import { readInputs } from './inputs.js';
import { resolveSHAs, resolveBranch, resolveOutputFile } from './context.js';
import { getChangedFiles, getDiff } from './git.js';
import { filterFiles, collectRawFiles, stripCommentsFromFiles, buildCodeContent } from './files.js';
import { buildPrompt } from './prompt.js';
import { callAI } from './ai.js';
import { formatReport } from './report.js';
import { commitAssessmentFile } from './delivery/commit.js';
import { postIssue } from './delivery/issue.js';
import { postDiscussion } from './delivery/discussion.js';

// ─── Entry Point ─────────────────────────────────────────────────────────────

async function run() {
  try {
    const inputs = readInputs();
    const octokit = github.getOctokit(inputs.githubToken, {
      headers: { 'X-GitHub-Api-Version': '2022-11-28' },
    });
    const ctx = github.context;

    // Prevent the external API key from appearing in workflow logs.
    if (inputs.apiKey && inputs.apiKey !== inputs.githubToken) {
      core.setSecret(inputs.apiKey);
    }

    // ── Resolve the commit range ────────────────────────────────────────────
    const { baseSha, headSha, prNumber } = await resolveSHAs(ctx, octokit, inputs);
    core.info(
      `Commit range: ${baseSha.substring(0, GIT_SHA_SHORT_LENGTH)}..${headSha.substring(0, GIT_SHA_SHORT_LENGTH)}`,
    );

    // ── Resolve the branch name ─────────────────────────────────────────────
    const branchName = resolveBranch(ctx);
    core.info(`Branch: ${branchName}`);

    // ── Collect changed files and apply filters ─────────────────────────────
    const allFiles = getChangedFiles(baseSha, headSha);
    const files = filterFiles(allFiles, inputs.includePatterns, inputs.excludePatterns);

    if (files.length === 0) {
      core.warning('No assessable files found after applying include/exclude filters. Skipping.');
      return;
    }
    core.info(`Assessing ${files.length} file(s): ${files.join(', ')}`);

    // ── Fetch diff content ──────────────────────────────────────────────────
    const diff = getDiff(baseSha, headSha, files);
    core.info(`Total diff size: ${diff.length} characters`);

    // ── Strip comments from changed files ──────────────────────────────────
    const rawFiles = collectRawFiles(files, headSha);
    const rawContent = buildCodeContent(rawFiles);
    core.info(`Code size before comment stripping: ${rawContent.length} characters`);
    core.info(
      `--- CODE BEFORE COMMENT STRIPPING ---\n${rawContent}\n--- END CODE BEFORE COMMENT STRIPPING ---`,
    );

    const { strippedFiles, strippedCharCount } = stripCommentsFromFiles(rawFiles);
    core.info(`Code size after comment stripping: ${strippedCharCount} characters`);
    core.info(
      `--- CODE AFTER COMMENT STRIPPING ---\n${buildCodeContent(strippedFiles)}\n--- END CODE AFTER COMMENT STRIPPING ---`,
    );

    let codeContent = buildCodeContent(strippedFiles);
    // Fall back to the raw diff if stripping produced no output
    if (codeContent.trim() === '') {
      codeContent = diff;
      core.warning('Comment stripping produced no content — falling back to raw diff.');
    }

    let truncated = false;
    if (codeContent.length > MAX_DIFF_CHARS) {
      codeContent =
        codeContent.substring(0, MAX_DIFF_CHARS) + '\n\n[content truncated due to size]';
      truncated = true;
      core.warning(
        `Content truncated to ${MAX_DIFF_CHARS} characters to stay within AI context limits.`,
      );
    }

    // ── Generate questions using AI ─────────────────────────────────────────
    const messages = buildPrompt({
      codeContent,
      files,
      numQuestions: inputs.numQuestions,
      context: inputs.additionalContext,
      truncated,
    });

    core.info(
      `Calling ${inputs.aiProvider} (model: ${inputs.aiModel}) to generate ${inputs.numQuestions} questions…`,
    );

    const effectiveApiKey =
      inputs.aiProvider === 'github-models' ? inputs.apiKey || inputs.githubToken : inputs.apiKey;

    const questions = await callAI({
      provider: inputs.aiProvider,
      model: inputs.aiModel,
      apiKey: effectiveApiKey,
      endpoint: inputs.azureEndpoint,
      messages,
    });

    // ── Write output ────────────────────────────────────────────────────────
    const report = formatReport({
      questions,
      files,
      baseSha,
      headSha,
      truncated,
      provider: inputs.aiProvider,
      model: inputs.aiModel,
      branchName,
    });
    const effectiveOutputFile = resolveOutputFile(inputs.outputFile, branchName);
    const outPath = path.resolve(
      process.env.GITHUB_WORKSPACE || process.cwd(),
      effectiveOutputFile,
    );
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, report, 'utf-8');
    core.info(`Assessment written to: ${effectiveOutputFile}`);

    // ── Commit assessment file to repository ───────────────────────────────
    await commitAssessmentFile({
      octokit,
      ctx,
      filePath: effectiveOutputFile,
      content: report,
      branchName,
      headSha,
    });

    core.setOutput('output_file', effectiveOutputFile);
    core.setOutput('questions', questions);
    core.setOutput('code_before_strip', rawContent);
    core.setOutput('code_after_strip', buildCodeContent(strippedFiles));

    // ── Post PR comment ─────────────────────────────────────────────────────
    if (inputs.postPrComment && prNumber) {
      await octokit.rest.issues.createComment({
        owner: ctx.repo.owner,
        repo: ctx.repo.repo,
        issue_number: prNumber,
        body: report,
      });
      core.info(`Assessment posted as a comment on PR #${prNumber}`);
    }

    // ── Create GitHub Issue ──────────────────────────────────────────────────
    if (inputs.postIssue) {
      await postIssue({ octokit, ctx, report, branchName, headSha });
    }

    // ── Create GitHub Discussion ─────────────────────────────────────────────
    if (inputs.postDiscussion) {
      await postDiscussion({
        octokit,
        ctx,
        report,
        branchName,
        headSha,
        categoryName: inputs.discussionCategory,
      });
    }
  } catch (err) {
    core.setFailed(`Assessment failed: ${err.message}`);
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

run();
