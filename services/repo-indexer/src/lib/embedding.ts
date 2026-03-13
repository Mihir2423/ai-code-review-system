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

export async function indexCodebase(
    files: FileContent[],
    repoDetails: { repoId: string; owner: string; repo: string },
): Promise<void> {
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
            await upsertVectors(vectors, repoDetails.repoId);
            vectors.length = 0;
        }
    }

    if (vectors.length > 0) {
        await upsertVectors(vectors, repoDetails.repoId);
    }

    logger.info({ repoId: repoDetails.repoId, totalFiles: files.length }, 'Indexed codebase to Pinecone');
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
