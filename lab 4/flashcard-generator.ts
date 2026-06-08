import 'dotenv/config';
import OpenAI from 'openai';
import { readFile } from 'node:fs/promises';
import { zodResponseFormat } from 'openai/helpers/zod';
import { FlashcardResponseSchema, type FlashcardResponse } from './schemas.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'AIP444 Lab 4',
  },
});

/**
 * Generates flashcards from the provided notes using Structured Outputs.
 * @param notes - The raw text of the course notes
 * @param cards - The number of cards to generate
 * @returns A Promise resolving to the structured JSON data
 */
export async function generateFlashcards(notes: string, cards: number): Promise<FlashcardResponse> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY. Create a .env file based on .env.example.');
  }

  // Load the system prompt from a separate file so it is easy to edit and submit.
  const systemPrompt = await readFile('SYSTEM_PROMPT.md', 'utf-8');

  // Ask the model to create flashcards and force the response to match our Zod schema.
  const completion = await openai.chat.completions.parse({
    model: process.env.MODEL ?? 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Create exactly ${cards} flashcards from these notes. Use direct quotes from the notes for the evidence fields.\n\nNOTES:\n${notes}`,
      },
    ],
    response_format: zodResponseFormat(FlashcardResponseSchema, 'flashcards'),
  });

  const parsed = completion.choices[0]?.message.parsed;

  if (!parsed) {
    throw new Error('The model did not return parsed flashcard data.');
  }

  return parsed;
}
