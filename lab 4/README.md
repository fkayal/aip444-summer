# Lab 4: Structured Outputs and Code Reading

This is a TypeScript/Hono version of the Lab 4 flashcard API.

## Setup

```bash
cd labs/lab-04
npm install
copy .env.example .env
```

On macOS/Linux use:

```bash
cp .env.example .env
```

Then open `.env` and replace the fake key with your real API key.

## Run the server

```bash
npm run dev
```

Keep this terminal open.

## Test the API

Open a second terminal in the same folder and run:

```bash
node test-client.js
```

Take a screenshot when the terminal shows:

```text
Success! Received Structured Data:
{
  "flashcards": [
    ...
  ]
}
```

## Submit

Push the code to GitHub under `labs/lab-04/*`, then submit the Word/PDF document with your GitHub link and screenshot.
