/*
  Lab 4 API Server Summary

  This file creates a small HTTP API server using Hono. The server exposes one
  endpoint, POST /api/generate, that receives course notes and a requested number
  of flashcards in JSON format. Before the request is used, Zod validates that
  the notes field exists and that cards is a number when provided.

  After validation, the route calls generateFlashcards(), which is implemented in
  flashcard-generator.ts. That function sends the notes to the AI model and asks
  for structured flashcard data. The server returns that structured data as JSON.

  The middleware helps the server behave more like a real production API:
  - logger() prints request information in the terminal.
  - timing() adds timing information so we can see how long requests take.
  - cors() allows a frontend or test client from another origin to call /api routes.
*/

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { timing } from 'hono/timing';
import { logger } from 'hono/logger';
import { zValidator } from '@hono/zod-validator';
import * as z from 'zod';

// This function contains the AI logic for creating flashcards.
import { generateFlashcards } from './flashcard-generator.js';

// Create the Hono app. This is similar to creating an Express app.
const app = new Hono();

// Global middleware runs on requests before the route handler.
// logger() shows request logs, and timing() adds request timing information.
app.use(logger(), timing());

// Enable CORS only for API routes so outside clients can call this API.
app.use('/api/*', cors());

// This schema defines the JSON body expected by POST /api/generate.
// notes is required, while cards is optional and defaults to 3.
const generateSchema = z.object({
  notes: z.string().min(1, "Field 'notes' is required."),
  cards: z.number().optional().default(3),
});

// This route receives notes, validates the JSON body, generates flashcards,
// then returns the flashcards as JSON.
app.post('/api/generate', zValidator('json', generateSchema), async (c) => {
  try {
    // c.req.valid('json') gives us the already-validated request body.
    const { notes, cards } = await c.req.valid('json');

    // Call the AI generation function and wait for structured flashcard data.
    const result = await generateFlashcards(notes, cards);

    // Send the structured result back to the client as JSON.
    return c.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Server Error:', error);

    // If something fails, return a 500 error with a simple JSON message.
    return c.json(
      {
        error: 'Failed to generate flashcards.',
        details: message,
      },
      500
    );
  }
});

const port = 3000;
console.log(`Server running on http://localhost:${port}`);

// Start the Hono server on port 3000.
serve({
  fetch: app.fetch,
  port,
});
