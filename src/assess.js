/**
 * Code Comprehension Question Generator — Main Script
 *
 * Triggered by the Docker action defined in action.yml.
 * Reads inputs from INPUT_* environment variables (set by the action),
 * collects the git diff for the event, calls an AI provider to generate
 * comprehension questions, and writes the result to a Markdown file and
 * (optionally) a PR comment.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Default glob patterns for files that should never be assessed.
 * Applied when the user has not supplied a custom exclude_patterns input.
 */
const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules/**',
  '**/*.lock',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '**/*.min.js',
  '**/*.min.css',
  'dist/**',
  'build/**',
  '.next/**',
  '.nuxt/**',
  '__pycache__/**',
  '**/*.pyc',
  '.git/**',
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.gif',
  '**/*.ico',
  '**/*.svg',
  '**/*.woff',
  '**/*.woff2',
  '**/*.ttf',
  '**/*.eot',
  '**/*.pdf',
  '**/*.zip',
  '**/*.tar.gz',
];

/**
 * Maximum number of characters from the diff sent to the AI.
 * Keeps token usage within model context-window limits while leaving
 * enough headroom for the system prompt and the generated response.
 */
const MAX_DIFF_CHARS = 12000;

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
    core.info(`Commit range: ${baseSha.substring(0, 7)}..${headSha.substring(0, 7)}`);

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
    let diff = getDiff(baseSha, headSha, files);
    let truncated = false;
    if (diff.length > MAX_DIFF_CHARS) {
      diff = diff.substring(0, MAX_DIFF_CHARS) + '\n\n[diff truncated due to size]';
      truncated = true;
      core.warning(
        `Diff truncated to ${MAX_DIFF_CHARS} characters to stay within AI context limits.`,
      );
    }

    // ── Generate questions using AI ─────────────────────────────────────────
    const messages = buildPrompt({
      diff,
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

    core.setOutput('output_file', effectiveOutputFile);
    core.setOutput('questions', questions);

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

// ─── Input Handling ───────────────────────────────────────────────────────────

function readInputs() {
  const includeStr = core.getInput('include_patterns');
  const excludeStr = core.getInput('exclude_patterns');

  return {
    githubToken: core.getInput('github_token', { required: true }),
    aiProvider: core.getInput('ai_provider') || 'github-models',
    aiModel: core.getInput('ai_model') || 'gpt-4o',
    apiKey: core.getInput('api_key') || '',
    azureEndpoint: core.getInput('azure_endpoint') || '',
    numQuestions: Math.max(1, parseInt(core.getInput('num_questions') || '5', 10)),
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
    outputFile: core.getInput('output_file') || 'assessment-questions.md',
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

// ─── SHA Resolution ───────────────────────────────────────────────────────────

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
async function resolveSHAs(ctx, octokit, inputs) {
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
          `${baseSha.substring(0, 7)} to initial commit ${initialCommit.substring(0, 7)} ` +
          `to exclude GitHub Classroom starter files from the diff.`,
      );
      baseSha = initialCommit;
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
function sanitiseSha(sha) {
  if (!/^[0-9a-f]{4,64}$/i.test(sha)) {
    throw new Error(`Invalid git commit SHA: "${sha}"`);
  }
  return sha;
}

// ─── Branch Resolution ───────────────────────────────────────────────────────

/**
 * Returns the branch name for the current event.
 * Falls back to parsing GITHUB_REF when context properties are absent.
 */
function resolveBranch(ctx) {
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
 * Derives the effective output file path.
 *
 * On main/master (or when the branch is unknown) the configured output_file
 * is used as-is. On any other branch the sanitised branch name is inserted
 * before the file extension so each branch produces a distinct file.
 */
function resolveOutputFile(outputFile, branchName) {
  const isDefaultBranch = !branchName || branchName === 'main' || branchName === 'master';
  if (isDefaultBranch) return outputFile;

  const safeBranch = branchName
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  const ext = path.extname(outputFile);
  const base = path.basename(outputFile, ext);
  const dir = path.dirname(outputFile);
  const name = `${base}-${safeBranch}${ext}`;
  return dir === '.' ? name : `${dir}/${name}`;
}

// ─── Git Utilities ────────────────────────────────────────────────────────────

/**
 * Runs a git command using spawnSync (no shell interpolation) and returns stdout.
 * Throws on non-zero exit.
 */
function git(...args) {
  const result = spawnSync('git', args, {
    encoding: 'utf-8',
    maxBuffer: 20 * 1024 * 1024, // 20 MB
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args[0]} failed:\n${result.stderr}`);
  return result.stdout;
}

function getFirstCommit() {
  return git('rev-list', '--max-parents=0', 'HEAD').trim();
}

function getChangedFiles(baseSha, headSha) {
  return git('diff', '--name-only', baseSha, headSha)
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
}

function getDiff(baseSha, headSha, files) {
  return git('diff', baseSha, headSha, '--', ...files);
}

// ─── File Filtering ───────────────────────────────────────────────────────────

function filterFiles(files, includePatterns, excludePatterns) {
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

// ─── Prompt Building ──────────────────────────────────────────────────────────

function buildPrompt({ diff, files, numQuestions, context: extraContext, truncated }) {
  const contextLine = extraContext
    ? `- Are relevant to the following assignment/topic: ${extraContext}`
    : '';

  const system = `You are an expert programming educator specialising in code comprehension assessment.
Your task is to analyse a student's code submission and generate targeted questions that require the student to demonstrate genuine understanding of the code they wrote.

Assess the complexity and scope of the submitted code to calibrate question depth appropriately — questions may address introductory syntax and logic, data structures and algorithms, language-specific patterns, or architectural concerns (such as MVC or layering), depending on what the code demonstrates.

Classify each question with one of the following cognitive levels:
- [Recall] — Factual knowledge about what the code does
- [Comprehension] — Understanding of why or how specific code works
- [Analysis] — Tracing execution, reasoning about logic, or identifying issues
- [Evaluation] — Judging design decisions, tradeoffs, or approach rationale

Generate exactly ${numQuestions} questions that:
- Reference specific named elements from the submitted code (functions, variables, control structures, data structures, patterns)
- Are phrased in second person where natural (e.g. "Why did you choose..."), with neutral phrasing acceptable when more appropriate
- Require genuine understanding and cannot be answered by re-reading the code alone
- Are comprehension-focused only — do not ask the student to improve, critique, or refactor their code
- Do not reveal or imply the answer within the question itself
${contextLine}

Format: present each question as a numbered item prefixed with its cognitive level tag — for example:
1. [Comprehension] Why did you use a guard clause at the start of this function rather than nesting the logic inside a conditional?

If the submitted diff is minimal or trivially simple, generate questions from the diff first (as many as warranted), then add a ## Broader Questions section — additional questions that relate to the underlying concepts, patterns, or technologies evident in the code, continuing the numbering. Do not add this section if the diff provides sufficient material.

Respond with the numbered list only — no preamble, no explanations, no answers.`;

  const truncatedNote = truncated
    ? '\n> ⚠️ The diff below has been truncated — form questions based on the visible portion.\n'
    : '';

  const user = `Analyse the following code changes and generate ${numQuestions} comprehension questions.

**Changed files:** ${files.join(', ')}
${truncatedNote}
\`\`\`diff
${diff}
\`\`\``;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

// ─── AI Client ────────────────────────────────────────────────────────────────

/**
 * Calls the configured AI provider's chat completions endpoint and returns
 * the model's response text.
 */
async function callAI({ provider, model, apiKey, endpoint, messages }) {
  let url;
  const headers = { 'Content-Type': 'application/json' };

  switch (provider) {
    case 'github-models':
      url = 'https://models.inference.ai.azure.com/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      break;

    case 'openai':
      url = 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      break;

    case 'openrouter':
      url = 'https://openrouter.ai/api/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['HTTP-Referer'] = 'https://github.com/NSCC-ITC-Assessment/ReviewQuestions';
      headers['X-Title'] = 'Code Comprehension Questions';
      break;

    case 'azure-openai':
      if (!endpoint) {
        throw new Error(
          'The azure_endpoint input is required when using the azure-openai provider.\n' +
            'Expected format: https://<resource>.openai.azure.com/openai/deployments/<deployment>',
        );
      }
      url = endpoint.endsWith('/chat/completions')
        ? endpoint
        : `${endpoint.replace(/\/$/, '')}/chat/completions?api-version=2024-02-01`;
      headers['api-key'] = apiKey;
      break;

    default:
      throw new Error(
        `Unknown ai_provider: "${provider}". Valid values: github-models | openai | openrouter | azure-openai`,
      );
  }

  const body = JSON.stringify({
    model,
    messages,
    temperature: 0.7,
    max_tokens: 2000,
    top_p: 0.95,
  });

  const response = await fetch(url, { method: 'POST', headers, body });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(no body)');
    throw new Error(`AI API error ${response.status} ${response.statusText}: ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('AI API returned an empty choices array — no questions were generated.');
  }

  return data.choices[0].message.content.trim();
}

// ─── Report Formatting ────────────────────────────────────────────────────────

function formatReport({
  questions,
  files,
  baseSha,
  headSha,
  truncated,
  provider,
  model,
  branchName,
}) {
  const date = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const shortBase = baseSha.substring(0, 7);
  const shortHead = headSha.substring(0, 7);
  const fileList = files.map((f) => `\`${f}\``).join(', ');
  const truncNote = truncated
    ? '> **⚠️ Note:** The diff was truncated — questions may not cover all changes.\n'
    : '';

  const isDefaultBranch = !branchName || branchName === 'main' || branchName === 'master';
  const branchNote = isDefaultBranch ? '' : `> **Branch:** \`${branchName}\`\n`;

  return [
    '## Review Questions Generator',
    '',
    `> **Generated:** ${date}`,
    `> **Commits reviewed:** \`${shortBase}\` → \`${shortHead}\``,
    branchNote,
    `> **Files assessed:** ${fileList}`,
    truncNote,
    '---',
    '',
    questions,
    '',
    '---',
    '',
    `<sub>Generated by [question-gen](https://github.com/NSCC-ITC-Assessment/ReviewQuestions) · ${model} via ${provider}</sub>`,
  ].join('\n');
}

// ─── Delivery: GitHub Issue ───────────────────────────────────────────────────

/**
 * Closes any previously open assessment issues for the same branch, then
 * creates a new one containing the latest report.
 */
async function postIssue({ octokit, ctx, report, branchName, headSha }) {
  const shortHead = headSha.substring(0, 7);
  const branchPart = branchName ? ` (${branchName})` : '';
  const title = `Review Questions Generator${branchPart} — ${shortHead}`;
  const { owner, repo } = ctx.repo;

  // ── Close any open predecessor issues for this branch ────────────────────
  const searchStr = branchName
    ? `Review Questions Generator (${branchName})`
    : 'Review Questions Generator';

  const existing = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    labels: 'assessment',
    per_page: 100,
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

// ─── Delivery: GitHub Discussion ─────────────────────────────────────────────

/**
 * Closes (locks) any previously open assessment discussions for the same
 * branch, then creates a new one containing the latest report.
 */
async function postDiscussion({ octokit, ctx, report, branchName, headSha, categoryName }) {
  const shortHead = headSha.substring(0, 7);
  const branchPart = branchName ? ` (${branchName})` : '';
  const title = `Review Questions Generator${branchPart} — ${shortHead}`;
  const searchStr = branchName
    ? `Review Questions Generator (${branchName})`
    : 'Review Questions Generator';

  // ── Step 1: resolve repo node ID, category ID, and existing discussions ──
  const repoQuery = await octokit.graphql(
    `query($owner: String!, $repo: String!) {
       repository(owner: $owner, name: $repo) {
         id
         discussionCategories(first: 25) {
           nodes { id name }
         }
         discussions(first: 50, orderBy: { field: CREATED_AT, direction: DESC }) {
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

// ─── Run ─────────────────────────────────────────────────────────────────────

run();
