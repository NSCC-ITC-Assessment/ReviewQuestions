/**
 * AI Client
 *
 * Calls the configured AI provider's chat completions endpoint and returns
 * the model's response text. Supports github-models, openai, openrouter,
 * and azure-openai.
 */

import {
  AI_TEMPERATURE,
  AI_TOP_P,
  MAX_OUTPUT_TOKENS,
  MIN_OUTPUT_TOKENS,
  TOKENS_PER_QUESTION,
} from './constants.js';

/**
 * Calls the configured AI provider and returns the generated questions text.
 */
export async function callAI({ provider, model, apiKey, endpoint, messages }) {
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
      headers['HTTP-Referer'] = 'https://github.com/NSCC-ITC-Assessment/GrillMyCode';
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

  // Allocate TOKENS_PER_QUESTION tokens per question to cover the file-path label,
  // code snippet, and question text, with MIN_OUTPUT_TOKENS as a floor for headings
  // and formatting overhead, and MAX_OUTPUT_TOKENS as the ceiling.
  const numQuestions = messages[1]?.content?.match(/(\d+) comprehension questions/)?.[1];
  const dynamicMaxTokens = numQuestions
    ? Math.min(
        MAX_OUTPUT_TOKENS,
        Math.max(MIN_OUTPUT_TOKENS, parseInt(numQuestions, 10) * TOKENS_PER_QUESTION),
      )
    : MAX_OUTPUT_TOKENS;

  const body = JSON.stringify({
    model,
    messages,
    temperature: AI_TEMPERATURE,
    max_tokens: dynamicMaxTokens,
    top_p: AI_TOP_P,
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
