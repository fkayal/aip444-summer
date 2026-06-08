import { z } from 'zod/v3';

// One ACE-style flashcard. Each field is a string because the API should return
// clear text that can be shown directly to a student.
export const FlashcardSchema = z.object({
  application: z
    .string()
    .describe('A 1-2 sentence real-world workplace task where this concept is needed.'),
  challenge: z
    .string()
    .describe('A specific problem to solve in the scenario. Expand all acronyms.'),
  answer: z
    .string()
    .describe('Correct solution with a brief explanation.'),
  evidence: z
    .string()
    .describe('Direct quote from the source notes supporting this card.'),
  misconception: z
    .string()
    .describe('Quote of what a junior developer or student might incorrectly believe.'),
  correction: z
    .string()
    .describe('Why the misconception is wrong, citing the notes.'),
});

// The full API response must be an object containing a flashcards list.
export const FlashcardResponseSchema = z.object({
  flashcards: z.array(FlashcardSchema),
});

export type FlashcardResponse = z.infer<typeof FlashcardResponseSchema>;
