export type GitHubFile = {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
};

export type ReadGitHubFilesOptions = {
  maxLines?: number;
  fetchImpl?: typeof fetch;
};

const fileCache = new Map<string, string>();

function encodePath(value: string): string {
  return value
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function normalizeRef(ref: string | undefined): string {
  const selectedRef = ref?.trim() || 'main';

  // Commit SHAs and fully qualified refs already work as raw GitHub refs.
  if (/^[a-f0-9]{40}$/i.test(selectedRef) || selectedRef.startsWith('refs/')) {
    return selectedRef;
  }

  // This lab mainly uses branches. A branch like "main" becomes refs/heads/main.
  return `refs/heads/${selectedRef}`;
}

function buildRawGitHubUrl(file: GitHubFile): string {
  const owner = encodeURIComponent(file.owner.trim());
  const repo = encodeURIComponent(file.repo.trim());
  const ref = encodePath(normalizeRef(file.ref));
  const path = encodePath(file.path.trim());

  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
}

function validateFile(file: GitHubFile): string | null {
  if (!file || typeof file !== 'object') return 'File entry must be an object.';
  if (!file.owner?.trim()) return 'Missing required field: owner.';
  if (!file.repo?.trim()) return 'Missing required field: repo.';
  if (!file.path?.trim()) return 'Missing required field: path.';
  return null;
}

function formatFileContent(file: GitHubFile, content: string, maxLines: number): string {
  const lines = content.split(/\r?\n/);
  let visibleContent = content;

  if (lines.length > maxLines) {
    visibleContent = lines.slice(0, maxLines).join('\n');
    visibleContent += `\n\n[File truncated: showing first ${maxLines} of ${lines.length} lines]`;
  }

  const ref = file.ref?.trim() || 'main';
  return [
    `### ${file.owner}/${file.repo}/${file.path} @ ${ref}`,
    '',
    '```',
    visibleContent,
    '```',
  ].join('\n');
}

export async function readGitHubFiles(
  files: GitHubFile[],
  options: ReadGitHubFilesOptions = {},
): Promise<string> {
  const maxLines = options.maxLines ?? 1000;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!Array.isArray(files) || files.length === 0) {
    return 'ERROR: read_github_files requires a non-empty files array.';
  }

  const results: string[] = [];

  for (const file of files) {
    const validationError = validateFile(file);
    if (validationError) {
      results.push(`### Invalid file request\n\nERROR: ${validationError}`);
      continue;
    }

    const url = buildRawGitHubUrl(file);

    try {
      let content = fileCache.get(url);

      if (!content) {
        const response = await fetchImpl(url, {
          headers: {
            'User-Agent': 'pr-advice-lab-05',
          },
        });

        if (!response.ok) {
          results.push(
            [
              `### ${file.owner}/${file.repo}/${file.path}`,
              '',
              `ERROR: GitHub returned ${response.status} ${response.statusText}.`,
              `URL: ${url}`,
            ].join('\n'),
          );
          continue;
        }

        content = await response.text();
        fileCache.set(url, content);
      }

      results.push(formatFileContent(file, content, maxLines));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push(
        [
          `### ${file.owner}/${file.repo}/${file.path}`,
          '',
          `ERROR: Could not fetch file. ${message}`,
          `URL: ${url}`,
        ].join('\n'),
      );
    }
  }

  return results.join('\n\n---\n\n');
}
