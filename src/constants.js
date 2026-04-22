/**
 * Shared constants for the Code Comprehension Question Generator.
 *
 * Centralising these values avoids magic numbers scattered throughout the
 * codebase and makes tuning easier — change a value here and it takes effect
 * everywhere automatically.
 */

/**
 * Default glob patterns for files that should never be assessed.
 * Applied when the user has not supplied a custom exclude_patterns input.
 */
export const DEFAULT_EXCLUDE_PATTERNS = [
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
  '_assessment/**',
];

/**
 * Maximum number of characters from the diff sent to the AI.
 * Keeps token usage within model context-window limits while leaving
 * enough headroom for the system prompt and the generated response.
 */
export const MAX_DIFF_CHARS = 12000;

/**
 * Maximum number of questions that can be generated in a single run.
 * Values supplied via num_questions above this limit are silently capped.
 */
export const MAX_QUESTIONS = 50;

/**
 * Number of characters to display from a git SHA in log messages and reports.
 */
export const GIT_SHA_SHORT_LENGTH = 7;

/**
 * Maximum stdout buffer size for git spawnSync calls.
 */
export const GIT_MAX_BUFFER = 20 * 1024 * 1024; // 20 MB

/**
 * Timeout in milliseconds for the comment-stripping (rmcm) child process.
 */
export const COMMENT_STRIP_TIMEOUT_MS = 10_000;

/**
 * AI model sampling temperature (0 = deterministic, 1 = most random).
 */
export const AI_TEMPERATURE = 0.7;

/**
 * AI nucleus-sampling probability mass cutoff.
 */
export const AI_TOP_P = 0.95;

/**
 * Estimated output tokens consumed per generated question (file label +
 * code snippet + question text).
 */
export const TOKENS_PER_QUESTION = 150;

/**
 * Minimum output token budget, covering headings and formatting overhead.
 */
export const MIN_OUTPUT_TOKENS = 500;

/**
 * Maximum output token budget, keeping responses within model output limits.
 */
export const MAX_OUTPUT_TOKENS = 7500;

/**
 * Maximum number of open issues to fetch when searching for predecessors.
 */
export const ISSUES_PER_PAGE = 100;

/**
 * Maximum number of discussion categories to fetch via GraphQL.
 */
export const DISCUSSION_CATEGORIES_FETCH_LIMIT = 25;

/**
 * Maximum number of recent discussions to fetch when searching for predecessors.
 */
export const DISCUSSIONS_FETCH_LIMIT = 50;

/**
 * Path to the comment-remover binary (rmcm) installed in the Docker image.
 */
export const COMMENT_REMOVER_BIN = '/usr/local/bin/rmcm';
