import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);
export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!aiEnabled) {
    throw Object.assign(new Error('Er is geen AI-sleutel ingesteld.'), { status: 503 });
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/** Haalt de tekst uit het antwoord en strijkt eventuele markdown-fences weg. */
export function textOf(message: Anthropic.Message): string {
  const raw = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
  const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return (fence ? fence[1] : raw).trim();
}
