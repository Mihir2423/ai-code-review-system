import { generateEmbedding } from '@repo/ai';
import { logger } from '@repo/logger';
import type { FileContent } from './github.js';
import { pineconeIndex } from './pinecone.js';

const BATCH_SIZE = 50;

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

export async function deleteVectorsByRepoId(repoId: string): Promise<void> {
    try {
        await pineconeIndex.deleteMany({
            filter: { repoId: { $eq: repoId } },
        });
        logger.info({ repoId }, 'Deleted existing vectors for repository');
    } catch (error) {
        logger.error({ error, repoId }, 'Failed to delete existing vectors');
        throw error;
    }
}

export async function indexCodebase(
    files: FileContent[],
    repoDetails: { repoId: string; owner: string; repo: string },
): Promise<void> {
    const vectors: VectorRecord[] = [];
    let failedFiles = 0;
    let lastError: Error | null = null;

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
            failedFiles++;
            lastError = error instanceof Error ? error : new Error(String(error));

            if (
                error instanceof Error &&
                (error.message.includes('rate limit') ||
                    error.message.includes('RESOURCE_EXHAUSTED') ||
                    error.message.includes('429'))
            ) {
                throw new Error(`Rate limit exceeded: ${error.message}`);
            }
            continue;
        }

        if (vectors.length >= BATCH_SIZE) {
            await upsertVectors(vectors, repoDetails.repoId);
            vectors.length = 0;
        }
    }

    if (vectors.length > 0) {
        await upsertVectors(vectors, repoDetails.repoId);
    }

    if (failedFiles > 0 && failedFiles === files.length) {
        throw lastError || new Error('All files failed to index');
    }

    logger.info({ repoId: repoDetails.repoId, totalFiles: files.length, failedFiles }, 'Indexed codebase to Pinecone');
}

async function upsertVectors(vectors: VectorRecord[], repoId: string): Promise<void> {
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
