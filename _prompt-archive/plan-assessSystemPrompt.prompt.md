# Plan: Redesign System Prompt in assess.js

## TL;DR

Update the hardcoded system prompt in `src/assess.js` to produce richer, more pedagogically structured questions. The new prompt adds per-question cognitive level tags, prefers second-person voice, is comprehension-only, adapts question depth to code complexity, flags self-revealing questions as forbidden, and handles thin diffs with a clearly-labelled "Broader Questions" section.

---

## Decisions (from user)

- **Cognitive level taxonomy**: Simplified 4-tier — [Recall], [Comprehension], [Analysis], [Evaluation]
- **Distribution**: Adaptive — AI judges distribution based on code complexity (could be intro syntax → MVC architecture)
- **Voice**: Prefer second-person ("Why did you...") but neutral phrasing allowed when more natural
- **Scope**: Comprehension ONLY — no critique, refactor, or improvement questions
- **Anti-patterns to forbid**: Questions that reveal the answer in the phrasing (explicitly stated); no other fixed exclusions
- **Thin diff handling**: Add a `## Broader Questions` section _after_ the main numbered list; broader questions must still relate to the code's concepts/patterns/technologies; numbered continuously
- **Per-question format**: `[CognitiveLevel] Question text`, numbered list

---

## Steps

### Phase 1 — Read current prompt location

1. Read `src/assess.js` (lines around the system prompt and user message construction) to confirm exact string variable names, where `numQuestions` and `additionalContext` are interpolated, and the user message structure.

### Phase 2 — Update the system prompt

2. Replace the existing `systemPrompt` string with the new version below.

**New system prompt (draft):**

```
You are an expert programming educator specialising in code comprehension assessment.
Your task is to analyse a student's code submission and generate targeted questions that require the student to demonstrate genuine understanding of the code they wrote.

Assess the complexity and scope of the submitted code to calibrate question depth appropriately — questions may address introductory syntax and logic, data structures and algorithms, language-specific patterns, or architectural concerns (such as MVC or layering), depending on what the code demonstrates.

Classify each question with one of the following cognitive levels:
- [Recall] — Factual knowledge about what the code does
- [Comprehension] — Understanding of why or how specific code works
- [Analysis] — Tracing execution, reasoning about logic, or identifying issues
- [Evaluation] — Judging design decisions, tradeoffs, or approach rationale

Generate exactly {numQuestions} questions that:
- Reference specific named elements from the submitted code (functions, variables, control structures, data structures, patterns)
- Are phrased in second person where natural (e.g. "Why did you choose..."), with neutral phrasing acceptable when more appropriate
- Require genuine understanding and cannot be answered by re-reading the code alone
- Are comprehension-focused only — do not ask the student to improve, critique, or refactor their code
- Do not reveal or imply the answer within the question itself
{additionalContextLine}

Format: present each question as a numbered item prefixed with its cognitive level tag — for example:
1. [Comprehension] Why did you use a guard clause at the start of this function rather than nesting the logic inside a conditional?

If the submitted diff is minimal or trivially simple, generate questions from the diff first (as many as warranted), then add a ## Broader Questions section — additional questions that relate to the underlying concepts, patterns, or technologies evident in the code, continuing the numbering. Do not add this section if the diff provides sufficient material.

Respond with the numbered list only — no preamble, no explanations, no answers.
```

Notes on interpolation:

- `{numQuestions}` → already interpolated in JS as template literal
- `{additionalContextLine}` → conditionally injected line: `- Are relevant to the following assignment/topic: ${additionalContext}` (same pattern as current prompt)

### Phase 3 — Verify output compatibility

3. Check that downstream output handling (Markdown report builder, `questions` action output extraction) works with the new format. The content is still one string block from `data.choices[0].message.content`; the `## Broader Questions` header and tags are additive — no parsing changes expected.

---

## Relevant files

- `src/assess.js` — Contains the `systemPrompt` string and user message builder; the only file requiring changes

---

## Verification

1. Manually inspect the updated system prompt string in `src/assess.js` for correct interpolation of `numQuestions` and `additionalContext`
2. Run a test workflow (or local invocation with a sample diff) and confirm output contains `[Recall]`/`[Comprehension]`/`[Analysis]`/`[Evaluation]` tags on each question
3. Test with a trivially small diff to confirm `## Broader Questions` section appears and is numbered continuously
4. Confirm the `grill-my-code.md` output file renders correctly in GitHub Markdown (the `## Broader Questions` header should render as a proper heading)

---

## Excluded scope

- No changes to the user message (the diff content passed to the AI)
- No changes to output file format, report template, or Markdown wrapper
- No changes to action inputs, outputs, or provider logic
- No UI/README changes
