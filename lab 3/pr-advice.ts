import 'dotenv/config';

interface ParsedPr {
  owner: string;
  repo: string;
  number: number;
  htmlUrl: string;
}

interface GitHubComment {
  username: string;
  body: string;
  date: string;
}

interface DiffResult {
  text: string;
  truncated: boolean;
}

const DIFF_LIMIT = 95_000;
const DEFAULT_MODEL = 'google/gemma-4-31b-it:free';

function usage(): never {
  console.error(`Usage:
  npm run dev -- <github-pr-url> [--save output.md] [--model model-name]

Examples:
  npm run dev -- https://github.com/microsoft/vscode/pull/289801
  npm run dev -- microsoft/vscode#289801 --save output.md

Required env:
  OPENROUTER_API_KEY=your_key_here`);
  process.exit(1);
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function firstPositionalArg(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const current = args[i];
    if (!current) continue;
    if (current.startsWith('--')) {
      i += 1;
      continue;
    }
    return current;
  }
  return undefined;
}

export function parseGitHubPr(input: string): ParsedPr {
  const trimmed = input.trim();

  const shorthand = trimmed.match(/^([^/\s]+)\/([^#\/\s]+)#(\d+)$/);
  if (shorthand) {
    const owner = shorthand[1];
    const repo = shorthand[2];
    const num = shorthand[3];
    if (!owner || !repo || !num) {
      throw new Error('Invalid shorthand. Expected owner/repo#number.');
    }
    const number = Number(num);
    return {
      owner,
      repo,
      number,
      htmlUrl: `https://github.com/${owner}/${repo}/pull/${number}`,
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Invalid input. Use a GitHub PR URL like https://github.com/owner/repo/pull/123 or shorthand owner/repo#123.');
  }

  if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
    throw new Error('Invalid GitHub PR URL. URL must start with https://github.com.');
  }

  const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/);
  if (!match) {
    throw new Error('Invalid GitHub PR URL path. Expected /owner/repo/pull/number.');
  }

  const owner = match[1];
  const repo = match[2];
  const num = match[3];
  if (!owner || !repo || !num) {
    throw new Error('Invalid GitHub PR URL path. Expected /owner/repo/pull/number.');
  }
  const number = Number(num);

  return {
    owner,
    repo,
    number,
    htmlUrl: `https://github.com/${owner}/${repo}/pull/${number}`,
  };
}

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export async function fetchDiff(pr: ParsedPr): Promise<DiffResult> {
  const diffUrl = `${pr.htmlUrl}.diff`;
  const raw = await fetchText(diffUrl, {
    'User-Agent': 'AIP444-Lab-03',
    Accept: 'text/plain',
  });

  if (raw.length <= DIFF_LIMIT) {
    return { text: raw, truncated: false };
  }

  const truncated = `${raw.slice(0, DIFF_LIMIT)}\n\n[Diff Truncated: original diff exceeded ${DIFF_LIMIT} characters.]`;
  console.warn(`Warning: diff was longer than ${DIFF_LIMIT} characters and was truncated.`);
  return { text: truncated, truncated: true };
}

export async function fetchComments(owner: string, repo: string, issueNum: number): Promise<GitHubComment[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNum}/comments`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'AIP444-Lab-03',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const hint = response.status === 403
      ? ' You may have hit GitHub\'s unauthenticated limit of 60 requests/hour. Wait, then retry.'
      : '';
    throw new Error(`GitHub API Error: ${response.status}.${hint}`);
  }

  const data = await response.json() as Array<any>;

  return data.map((item) => ({
    username: String(item?.user?.login ?? 'unknown'),
    body: String(item?.body ?? ''),
    date: String(item?.updated_at ?? item?.created_at ?? ''),
  }));
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildCommentsXml(comments: GitHubComment[]): string {
  if (comments.length === 0) {
    return '<thread>\n  <no-comments>No issue comments were returned for this PR.</no-comments>\n</thread>';
  }

  const body = comments.map((comment) => {
    return `  <comment username="${escapeXml(comment.username)}" date="${escapeXml(comment.date)}">\n${escapeXml(comment.body)}\n  </comment>`;
  }).join('\n');

  return `<thread>\n${body}\n</thread>`;
}

export function buildSystemPrompt(): string {
  return `You are a Senior Engineer reviewing a GitHub Pull Request for a junior developer.

Your job is to explain the PR accurately, rigorously, and educationally. Value correctness, maintainability, safety, readability, and long-term design over cleverness. Do not invent facts that are not supported by the diff or comments. If something is uncertain, say so.

Reasoning process to follow internally before writing the final report:
1. First, analyze the DIFF carefully to identify what technically changed, which files are involved, and what behavior is affected.
2. Next, analyze the <thread> comments to understand the human context: reviewer concerns, author responses, unresolved disagreements, approvals, and tradeoffs.
3. Next, reflect on assumptions, constraints, edge cases, implementation risk, lifecycle issues, UI/UX effects, and maintainability.
4. Finally, synthesize the technical and human context into the final Markdown report.

Input format:
- The code changes will appear inside a fenced \`\`\`diff code block.
- Conversation comments will appear inside <thread>...</thread>.
- Each comment will use <comment username="..." date="...">...</comment>.

Output only a Markdown report with these exact sections and no extra intro:

## tl;dr
A single-sentence summary of the PR's purpose, maximum 30 words.

## Stakeholders
A bulleted list of every person who participated, with a one-line description of their stance or contribution.

## Changes
A file-by-file breakdown of what changed and why, written for a junior developer.

## Risks
Identify potential bugs, unhandled edge cases, or hidden assumptions. Rate each risk as Low, Medium, or High severity.

## Learning
Generate exactly 3 Socratic questions that test the junior developer's understanding of the changes.`;
}

export function buildUserPrompt(pr: ParsedPr, diff: DiffResult, comments: GitHubComment[]): string {
  const truncationNote = diff.truncated
    ? '\nNote: The diff was truncated because it exceeded the 95,000 character limit. Some changed files or hunks may be missing.\n'
    : '';

  return `Analyze this GitHub Pull Request: ${pr.htmlUrl}${truncationNote}

DIFF:
\`\`\`diff
${diff.text}
\`\`\`

COMMENTS:
${buildCommentsXml(comments)}
`;
}

async function askOpenRouter(systemPrompt: string, userPrompt: string, model: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY. Create a .env file using .env.example.');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com',
      'X-Title': 'AIP444 Lab 03 PR Advice',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API Error: ${response.status} ${response.statusText}\n${errorBody}`);
  }

  const data = await response.json() as any;
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('OpenRouter returned no message content.');
  }

  return String(content);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const prInput = firstPositionalArg(args);
  if (!prInput || args.includes('--help') || args.includes('-h')) usage();

  const savePath = getFlagValue(args, '--save');
  const model = getFlagValue(args, '--model') ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;

  const pr = parseGitHubPr(prInput);
  console.error(`Fetching diff for ${pr.owner}/${pr.repo}#${pr.number}...`);
  const diff = await fetchDiff(pr);

  console.error('Fetching GitHub issue comments...');
  const comments = await fetchComments(pr.owner, pr.repo, pr.number);

  console.error(`Asking OpenRouter model: ${model}...`);
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(pr, diff, comments);
  const report = await askOpenRouter(systemPrompt, userPrompt, model);

  console.log(report);

  if (savePath) {
    const fs = await import('node:fs/promises');
    await fs.writeFile(savePath, report, 'utf8');
    console.error(`Saved output to ${savePath}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
