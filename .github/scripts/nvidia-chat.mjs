// Shared NVIDIA API Catalog chat helper.
// Imported by polish-release-notes.mjs and draft-changeset.mjs.
//
// Key behaviours
//   - Tries MODEL_CANDIDATES in order; moves to the next on 404/410 (gone).
//   - Retries 429/5xx with exponential backoff (unchanged from before).
//   - Strips a leading <think>…</think> block from content defensively
//     (several NVIDIA-hosted reasoning models emit one into message.content).
//   - On total exhaustion, throws a descriptive error — callers decide whether
//     to surface it as ::warning:: or ::error::.

export const API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

// Tried in order. First success wins; 404/410 advances to the next candidate.
// Override the whole list by setting NVIDIA_MODEL (single model, no fallback).
export const MODEL_CANDIDATES = process.env.NVIDIA_MODEL
  ? [process.env.NVIDIA_MODEL]
  : [
      'openai/gpt-oss-20b',               // verified working 2026-09-03
      'nvidia/nemotron-nano-3-30b-a3b',   // NVIDIA-own, likely longest-lived
      'mistralai/mistral-7b-instruct-v0.3', // small, historically long-lived
    ];

const MAX_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 2000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const GONE_STATUSES = new Set([404, 410]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Strip a leading <think>…</think> block that some reasoning-tuned models
 * emit into message.content (as opposed to the separate reasoning_content
 * field used by gpt-oss-20b). The block may span multiple lines.
 */
export function stripThinkBlock(text) {
  return text.replace(/^\s*<think>[\s\S]*?<\/think>\s*/i, '').trim();
}

/**
 * POST a single chat-completion request to one model with retry/backoff.
 * Returns the raw fetch Response (ok or not).
 * Throws only on network-level failures.
 */
async function fetchModel(model, apiKey, body) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...body, model }),
    });

    if (response.ok) return response;
    if (GONE_STATUSES.has(response.status)) return response; // caller advances candidate
    if (!RETRYABLE_STATUSES.has(response.status)) return response; // fail fast
    if (attempt === MAX_ATTEMPTS) return response;

    const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
    console.log(
      `NVIDIA API [${model}] returned ${response.status}, retrying in ${delayMs}ms` +
      ` (attempt ${attempt}/${MAX_ATTEMPTS})...`,
    );
    await sleep(delayMs);
  }
}

/**
 * Send a chat-completion request, falling through MODEL_CANDIDATES on 404/410.
 *
 * @param {string}   apiKey  NVIDIA_API_KEY value
 * @param {object}   body    Request body fields (except `model`; that's injected here)
 * @returns {Promise<string>} Polished content string (think-block stripped)
 * @throws  {Error}          When all candidates are exhausted or the last one fails
 */
export async function nvidiaChat(apiKey, body) {
  let lastError;

  for (const model of MODEL_CANDIDATES) {
    let response;
    try {
      response = await fetchModel(model, apiKey, body);
    } catch (err) {
      lastError = err;
      console.log(`NVIDIA API [${model}] network error: ${err.message} — trying next candidate`);
      continue;
    }

    if (GONE_STATUSES.has(response.status)) {
      const detail = await response.text().catch(() => '');
      console.log(
        `NVIDIA API [${model}] returned ${response.status} (model gone) — trying next candidate.\n  ${detail}`,
      );
      lastError = new Error(`Model gone: ${response.status} — ${detail}`);
      continue;
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `NVIDIA API [${model}] request failed: ${response.status} ${response.statusText} — ${detail}`,
      );
    }

    const json = await response.json();
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) {
      throw new Error(
        `NVIDIA API [${model}] response missing choices[0].message.content`,
      );
    }

    const content = stripThinkBlock(raw);
    console.log(`NVIDIA API: used model ${model}`);
    return content;
  }

  throw lastError ?? new Error('All NVIDIA model candidates exhausted with no response');
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
