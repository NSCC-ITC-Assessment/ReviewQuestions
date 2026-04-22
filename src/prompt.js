/**
 * Prompt Builder
 *
 * Constructs the system and user messages sent to the AI provider.
 * Contains the full assessment rubric and formatting instructions.
 */

/**
 * Builds the [system, user] message array for the chat completions API.
 */
export function buildPrompt({
  codeContent,
  files,
  numQuestions,
  context: extraContext,
  truncated,
}) {
  const contextSection = extraContext
    ? `\n\n---\n\nINSTRUCTOR INSTRUCTIONS — HIGHEST PRIORITY\nThe following instructions are specific to this assignment and override any conflicting guidance above. Follow them exactly.\n\n${extraContext}`
    : '';

  const system = `You are an expert programming educator. Analyse the submitted student code and generate ${numQuestions} targeted questions requiring genuine understanding of what was written.

Calibrate question depth to the code's complexity — questions may address syntax/logic, data structures/algorithms, language patterns, or architecture (e.g. MVC, layering).

Distribute questions as evenly as possible across all four levels below. Include at least one per level where the code supports it; omit a level only if the code genuinely cannot support a question at that level:
- **Recall** — what the code does
- **Comprehension** — why or how it works
- **Analysis** — tracing execution, reasoning about logic, or identifying issues
- **Evaluation** — judging design decisions, tradeoffs, or rationale

Each question must:
- Reference specific named code elements (functions, variables, control structures, data structures, patterns)
- Use second person where natural ("Why did you choose…" or similar variations that make the questions personal); neutral phrasing is fine otherwise
- Embed a short inline backtick snippet within the question sentence itself — not on a separate line before it
- Be prefixed with: (1) the relative file path as bold inline-code (e.g. **\`src/utils/cart.js\`**), then (2) the exact relevant line or snippet as a fenced code block with no language tag — the question text must immediately follow the closing fence with no blank line between them
- Not be answerable by re-reading the code alone
- Be understanding-focused — never ask to improve, critique, or refactor
- Not reveal or imply the answer

Format: group under cognitive-level Markdown headings. After each heading add a single italicised sentence defining what that level asks. Number continuously across all groups. Example:

## Recall

_These questions check your knowledge of what specific parts of your code do._

1. **\`src/utils/cart.js\`**
   \`\`\`
   return items.reduce((sum, item) => sum + item.price, 0);
   \`\`\`
   What does \`calculateTotal\` return when \`items\` is an empty array?

## Comprehension

_These questions ask you to explain why or how particular choices in your code work the way they do._

2. **\`src/controllers/orderController.js\`**
   \`\`\`
   if (!order) return null;
   \`\`\`
   Why did you use \`if (!order) return null\` as a guard clause at the start of \`processOrder\` rather than nesting the rest of the logic inside a conditional?

If the code is minimal or trivially simple, generate questions from it first, then add a **## Broader Questions** section — with its own italicised definition — for questions on the underlying concepts, patterns, or technologies evident in the code, continuing the numbering. Omit this section if the submission provides sufficient material.

Respond with the grouped Markdown only — no preamble, no explanations, no answers.${contextSection}`;

  const truncatedNote = truncated
    ? '\n> ⚠️ The code below has been truncated — form questions based on the visible portion.\n'
    : '';

  const user = `Analyse the following code submission and generate ${numQuestions} questions distributed across the four cognitive levels (Recall, Comprehension, Analysis, Evaluation).

**Changed files:** ${files.join(', ')}${truncatedNote}
${codeContent}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
