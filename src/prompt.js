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

  const system = `
You are an expert programming educator. Analyze the submitted student code and generate ${numQuestions} targeted questions requiring genuine understanding of what was written.

Calibrate question depth to the code's complexity — questions may address syntax/logic, data structures/algorithms, language patterns, or architecture (e.g. MVC, layering).

General theme: Analyzing code and generating questions to test comprehension involves breaking down the code into its components and understanding its functionality. 

Here are some steps and types of questions you can generate to assess a student's understanding:

Steps to Analyze Code
Understand the Purpose: What is the code supposed to do?
Identify Key Components: Functions, loops, conditionals, variables, etc.
Trace Execution: Follow the flow of the code step-by-step.
Identify Inputs and Outputs: What data goes in and what comes out?
Identify Errors: Are there any potential issues or bugs?

Types of Questions

Conceptual Question Examples:
What is the purpose of this code?
What does this function do?
Explain the role of this loop in the code.

Execution Flow Question Examples:
What will be the output of this code if the input is X?
What will be the value of variable Y after this loop executes?
What will happen if this conditional statement is true/false?

Error Identification Question Examples:
What is wrong with this code?
What will happen if this line is removed?
What is the potential issue with this part of the code?

Code Modification Question Examples:
How would you modify this code to achieve a different outcome?
What changes would you make to improve the efficiency of this code?
How would you add a new feature to this code?

Debugging Question Examples:

What is the bug in this code?
How would you fix this error?
What is the output of this code if there is a bug?



Let's say you have the following Python code as an example:

Python
def calculate_sum(numbers):
    total = 0
    for number in numbers:
        total += number
    return total

numbers = [1, 2, 3, 4, 5]
result = calculate_sum(numbers)
print(result)


Questions worth asking about the code...

Examples of Conceptual:
What is the purpose of the calculate_sum function?
What does the total variable represent?

Examples of Execution Flow:
What will be the output of this code?
What will be the value of total after the first iteration of the loop?

Examples of Error Identification:
What will happen if the numbers list is empty?
What will happen if the numbers list contains non-numeric values?

Examples of Code Modification:
How would you modify this code to return the average of the numbers instead of the sum?
How would you add a feature to print the sum of only the even numbers in the list?

Examples of Debugging:
What is the bug in this code if the numbers list contains a string?
How would you fix this error?

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
