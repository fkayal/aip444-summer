import { readGitHubFiles } from './tools';

async function test() {
  console.log('Testing read_github_files...\n');

  const content = await readGitHubFiles([
    {
      owner: 'microsoft',
      repo: 'vscode',
      path: 'package.json',
      ref: 'main',
    },
  ]);

  console.log(content);
}

test().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
