# AIP444 Lab 3: GitHub PR Explainer

This is a CLI tool called `pr-advice` for Lab 3. It takes a public GitHub PR, fetches the code diff and issue comments, then asks OpenRouter to produce a senior-engineer style Markdown report.

## Setup

```bash
cd labs/lab-03
npm install
cp .env.example .env
```

Edit `.env` and paste your OpenRouter key:

```env
OPENROUTER_API_KEY=your_key_here
```

Do **not** commit `.env` to GitHub.

## Run

```bash
npm run dev -- https://github.com/microsoft/vscode/pull/289801 --save output.md
```

You can also use shorthand:

```bash
npm run dev -- microsoft/vscode#289801 --save output.md
```

## Type-check

```bash
npm run check
```

## What the tool does

1. Parses a GitHub PR URL or shorthand.
2. Rejects non-GitHub URLs.
3. Fetches the `.diff` version of the PR.
4. Truncates the diff if it is over 95,000 characters.
5. Fetches GitHub issue comments using the Issues Comments API.
6. Wraps the diff in a fenced `diff` block.
7. Wraps comments in XML-style tags.
8. Sends the system prompt and user prompt to OpenRouter.
9. Prints the Markdown report and optionally saves it to a file.

## Suggested test PR

```bash
npm run dev -- https://github.com/microsoft/vscode/pull/289801 --save output.md
```

That PR has real discussion, reviewer feedback, and enough changed files to test whether the prompt is useful.
