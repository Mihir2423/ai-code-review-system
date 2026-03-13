import 'dotenv/config';

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

        // Strip opening fence (e.g. ```json\n or ```\n)
        cleanedText = cleanedText
            .replace(/^```[\w]*\n?/, '')
            .replace(/\n?```$/, '')
            .trim();

        // Extract outermost JSON object
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
        // Fix: serialize the error message explicitly so Pino captures it
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

export async function generateEmbedding(text: string, dimensions?: number): Promise<number[]> {
    const result = await embed({
        model: google.textEmbeddingModel('gemini-embedding-001'),
        value: text,
    });

    return dimensions ? result.embedding.slice(0, dimensions) : result.embedding;
}
