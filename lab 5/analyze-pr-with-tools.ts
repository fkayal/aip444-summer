import 'dotenv/config';
import OpenAI from 'openai';
import { readFile } from 'node:fs/promises';
import { readGitHubFiles } from './tools';
import { systemPrompt } from './systemPrompt';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'read_github_files',
      description:
        'Read one or more full text files from a public GitHub repository when a PR diff needs more context.',
      parameters: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            description: 'Array of GitHub files to read for extra PR context.',
            items: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'GitHub repository owner or organization, for example microsoft.',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name, for example vscode.',
                },
                path: {
                  type: 'string',
                  description: 'Path to the file inside the repository, for example package.json.',
                },
                ref: {
                  type: 'string',
                  description: 'Branch, tag, or commit SHA. Use main if no better ref is known.',
                },
              },
              required: ['owner', 'repo', 'path', 'ref'],
              additionalProperties: false,
            },
          },
        },
        required: ['files'],
        additionalProperties: false,
      },
    },
  },
];

export async function analyzePrWithTools(prData: string): Promise<string> {
  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Analyze this Pull Request:\n\n${prData}` },
  ];

  const maxIterations = 5;
  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-5-mini';

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools,
    });

    const assistantMessage = response.choices[0]?.message;

    if (!assistantMessage) {
      return 'ERROR: The model did not return a message.';
    }

    messages.push(assistantMessage);

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      return assistantMessage.content ?? 'No final analysis was returned.';
    }

    for (const toolCall of assistantMessage.tool_calls) {
      const functionToolCall = toolCall as any;

      const functionName = functionToolCall.function?.name;
      const functionArguments = functionToolCall.function?.arguments ?? '{}';

      console.log('Tool requested:', functionName);
      console.log('Tool arguments:', functionArguments);

      let toolResult = '';

      if (functionName !== 'read_github_files') {
        toolResult = `ERROR: Unknown tool ${functionName}`;
      } else {
        try {
          const args = JSON.parse(functionArguments);
          toolResult = await readGitHubFiles(args.files);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          toolResult = `ERROR: Could not execute read_github_files. ${message}`;
        }
      }

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: toolResult,
      } as any);
    }
  }

  return 'Max tool-calling iterations reached before the model gave a final answer.';
}

async function main() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error('Usage: npx tsx analyze-pr-with-tools.ts pr-data.txt');
    process.exit(1);
  }

  const prData = await readFile(inputPath, 'utf8');
  const result = await analyzePrWithTools(prData);

  console.log('\nFinal PR analysis:\n');
  console.log(result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});