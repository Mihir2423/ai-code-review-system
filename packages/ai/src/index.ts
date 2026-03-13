import { google } from '@ai-sdk/google';
import { logger } from '@repo/logger';
import { embed, generateText } from 'ai';

export interface ReviewIssue {
    file: string;
    line: number;
    severity: 'critical' | 'warning' | 'suggestion';
    description: string;
    oldCode: string;
    newCode: string;
    suggestion: string;
}

export interface ReviewResult {
    issues: ReviewIssue[];
    summary: string;
    strengths: string;
}

export interface FileContent {
    path: string;
    content: string;
}

export interface RepoDetails {
    repoId: string;
    owner: string;
    repo: string;
}

const BATCH_SIZE = 50;

export async function generateEmbedding(text: string, dimensions?: number): Promise<number[]> {
    const result = await embed({
        model: google.textEmbeddingModel('gemini-embedding-001'),
        value: text,
    });

    return dimensions ? result.embedding.slice(0, dimensions) : result.embedding;
}

interface VectorRecord {
    id: string;
    values: number[];
    metadata: {
        repoId: string;
        owner: string;
        repo: string;
        path: string;
        content: string;
    };
}

async function upsertVectors(vectors: VectorRecord[], repoId: string, pineconeIndex: any): Promise<void> {
    try {
        await pineconeIndex.upsert({
            records: vectors,
        });
        logger.info({ repoId, batchSize: vectors.length }, 'Upserted vectors to Pinecone');
    } catch (error) {
        logger.error({ error, repoId }, 'Failed to upsert vectors to Pinecone');
        throw error;
    }
}

export async function indexCodebase(files: FileContent[], repoDetails: RepoDetails, pineconeIndex: any): Promise<void> {
    const vectors: VectorRecord[] = [];

    for (const file of files) {
        const content = `File: ${file.path}\n\n${file.content}`;

        try {
            const embedding = await generateEmbedding(content, 1024);

            vectors.push({
                id: `${repoDetails.repoId}:${file.path}`,
                values: embedding,
                metadata: {
                    repoId: repoDetails.repoId,
                    owner: repoDetails.owner,
                    repo: repoDetails.repo,
                    path: file.path,
                    content: file.content,
                },
            });
        } catch (error) {
            logger.error({ error, path: file.path }, 'Failed to generate embedding for file');
            continue;
        }

        if (vectors.length >= BATCH_SIZE) {
            await upsertVectors(vectors, repoDetails.repoId, pineconeIndex);
            vectors.length = 0;
        }
    }

    if (vectors.length > 0) {
        await upsertVectors(vectors, repoDetails.repoId, pineconeIndex);
    }

    logger.info({ repoId: repoDetails.repoId, totalFiles: files.length }, 'Indexed codebase to Pinecone');
}

export function findLineNumberInDiff(diff: string, file: string, code: string): number {
    const lines = diff.split('\n');
    let currentFile = '';
    let hunkStartLine = 0;
    const searchCode = code.substring(0, 30).trim();

    for (const line of lines) {
        if (line.startsWith('diff --git')) {
            const match = line.match(/b\/(.+)/);
            if (match && match[1]) currentFile = match[1];
        } else if (line.startsWith('@@')) {
            const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
            if (match && match[1]) hunkStartLine = parseInt(match[1], 10);
        } else if (currentFile === file && line.includes(searchCode)) {
            return hunkStartLine;
        } else if (currentFile === file && (line.startsWith('+') || line.startsWith(' '))) {
            hunkStartLine++;
        }
    }

    return 1;
}

export function createIssueHash(issue: ReviewIssue): string {
    return `${issue.file}:${issue.line}:${issue.description.substring(0, 50)}`;
}

export function deduplicateIssues(issues: ReviewIssue[]): ReviewIssue[] {
    const seen = new Set<string>();
    const deduplicated: ReviewIssue[] = [];

    for (const issue of issues) {
        const hash = createIssueHash(issue);
        if (!seen.has(hash)) {
            seen.add(hash);
            deduplicated.push(issue);
        } else {
            logger.warn({ issue }, 'Duplicate issue found, skipping');
        }
    }

    return deduplicated;
}

export async function generateCodeReview(
    title: string,
    description: string,
    context: string[],
    diff: string,
): Promise<ReviewResult> {
    const prompt = `You are an expert code reviewer. Analyze the following pull request and provide a structured code review.

PR Title: ${title}
PR Description: ${description || 'No description provided'}

Context from Codebase:
${context.join('\n\n')}

Code Changes:
\`\`\`diff
${diff}
\`\`\`

Analyze the changes and return a JSON object with the following structure:
{
  "issues": [
    {
      "file": "filename.ts",
      "severity": "critical|warning|suggestion",
      "description": "What's wrong - be specific and concise",
      "oldCode": "exact code that was removed (leave empty if new code only)",
      "newCode": "exact code that was added (leave empty if removal only)",
      "suggestion": "how to fix it - be specific"
    }
  ],
  "summary": "Brief overview of the changes in 2-3 sentences",
  "strengths": "What's done well - mention specific positive aspects"
}

IMPORTANT:
1. For oldCode and newCode, provide the EXACT code from the diff (without +/- prefixes)
2. Only report actual issues - bugs, security vulnerabilities, logic errors, performance concerns
3. If no significant issues found, return empty array for issues
4. Each issue should be unique - don't report the same issue multiple times

Return ONLY valid JSON, no markdown formatting.`;

    const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        prompt,
    });

    try {
        let cleanedText = text.trim();

        cleanedText = cleanedText
            .replace(/^```[\w]*\n?/, '')
            .replace(/\n?```$/, '')
            .trim();

        const startIdx = cleanedText.indexOf('{');
        const endIdx = cleanedText.lastIndexOf('}');
        if (startIdx === -1 || endIdx === -1) {
            throw new Error('No JSON object found in response');
        }
        cleanedText = cleanedText.slice(startIdx, endIdx + 1);

        const result = JSON.parse(cleanedText) as ReviewResult;

        if (!Array.isArray(result.issues)) result.issues = [];
        if (typeof result.summary !== 'string') result.summary = '';
        if (typeof result.strengths !== 'string') result.strengths = '';

        return result;
    } catch (parseError) {
        logger.error(
            {
                parseErrorMessage: parseError instanceof Error ? parseError.message : String(parseError),
                parseErrorName: parseError instanceof Error ? parseError.name : 'UnknownError',
                rawTextSnippet: text.substring(0, 500),
            },
            'Failed to parse AI response as JSON',
        );
        return { issues: [], summary: 'AI review could not be parsed.', strengths: '' };
    }
}

export async function reviewCode(prompt: string) {
    const result = await generateText({
        model: google('gemini-1.5-pro'),
        prompt,
    });

    return result.text;
}
