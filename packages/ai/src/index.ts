import 'dotenv/config';

import { google } from '@ai-sdk/google';
import { logger } from '@repo/logger';
import { embed, generateText } from 'ai';
import { jsonrepair } from 'jsonrepair';

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
    suggestions: string[];
    summary: string;
    strengths: string;
    walkthrough: string;
    sequenceDiagram: string;
    poem: string;
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

export async function generateCodeReview(
    title: string,
    description: string,
    context: string[],
    diff: string,
): Promise<ReviewResult> {
    const prompt = `You are an expert code reviewer. Analyze the following pull request and provide a detailed structured code review.

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
  "walkthrough": "A detailed file-by-file explanation of the changes. Explain what each file does, why the changes were made, and how they fit together.",
  "sequenceDiagram": "A Mermaid JS sequence diagram visualizing the flow of the changes (if applicable). Use \`\`\`mermaid ... \`\`\` block. IMPORTANT: Ensure the Mermaid syntax is valid. Do not use special characters (like quotes, braces, parentheses) inside Note text or labels as it breaks rendering. Keep the diagram simple. If not applicable, return empty string.",
  "summary": "Comprehensive overview of the changes, what they accomplish, and their impact on the codebase.",
  "strengths": "What's done well - mention specific positive aspects with code examples if applicable",
  "issues": [
    {
      "file": "filename.ts",
      "line": 42,
      "severity": "critical|warning|suggestion",
      "description": "What's wrong - be specific and concise",
      "oldCode": "exact code that was removed (plain code, no markdown fences)",
      "newCode": "exact code that was added (plain code, no markdown fences)",
      "suggestion": "how to fix it - be specific"
    }
  ],
  "suggestions": ["Specific code improvement suggestions that are not bugs but could enhance the code quality"],
  "poem": "A short, creative poem (4-8 lines) summarizing the changes at the very end. Make it clever and relevant to the code being reviewed."
}

IMPORTANT:
1. For oldCode and newCode, provide the EXACT code from the diff (without +/- prefixes) and format them nicely like \`\`\`ts\\ncode\\n\`\`\`
2. Only report actual issues - bugs, security vulnerabilities, logic errors, performance concerns
3. If no significant issues found, return empty array for issues
4. Each issue should be unique - don't report the same issue multiple times
5. Make walkthrough, summary, strengths, and poem detailed and comprehensive

Return ONLY valid JSON, no markdown formatting.`;

    const { text } = await generateText({
        model: google('gemini-2.5-flash'),
        prompt,
    });

    try {
        let cleanedText = text.trim();

        const startIdx = cleanedText.indexOf('{');
        const endIdx = cleanedText.lastIndexOf('}');
        if (startIdx === -1 || endIdx === -1) {
            throw new Error('No JSON object found in response');
        }
        cleanedText = cleanedText.slice(startIdx, endIdx + 1);
        const result = JSON.parse(jsonrepair(cleanedText)) as ReviewResult;

        if (!Array.isArray(result.issues)) result.issues = [];
        if (!Array.isArray(result.suggestions)) result.suggestions = [];
        if (typeof result.summary !== 'string') result.summary = '';
        if (typeof result.strengths !== 'string') result.strengths = '';
        if (typeof result.walkthrough !== 'string') result.walkthrough = '';
        if (typeof result.sequenceDiagram !== 'string') result.sequenceDiagram = '';
        if (typeof result.poem !== 'string') result.poem = '';

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
        return {
            issues: [],
            suggestions: [],
            summary: 'AI review could not be parsed.',
            strengths: '',
            walkthrough: '',
            sequenceDiagram: '',
            poem: '',
        };
    }
}

export async function generateEmbedding(text: string, dimensions?: number): Promise<number[]> {
    const result = await embed({
        model: google.textEmbeddingModel('gemini-embedding-001'),
        value: text,
    });

    return dimensions ? result.embedding.slice(0, dimensions) : result.embedding;
}
