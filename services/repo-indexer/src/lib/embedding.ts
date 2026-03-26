import { generateEmbedding } from '@repo/ai';
import prisma from '@repo/db';
import { logger } from '@repo/logger';
import { createHash } from 'crypto';
import type { ChangedFile, FileContent } from './github.js';
import { pineconeIndex } from './pinecone.js';

const BATCH_SIZE = 50;
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

interface VectorRecord {
    id: string;
    values: number[];
    metadata: {
        repoId: string;
        branchId: string;
        owner: string;
        repo: string;
        path: string;
        content: string;
    };
}

function chunkContent(content: string, startLine: number): { chunks: string[]; startLine: number } {
    const lines = content.split('\n');
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    const currentStartLine = startLine;
    let lineCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        currentChunk.push(line);
        lineCount++;

        if (lineCount >= CHUNK_SIZE) {
            chunks.push(currentChunk.join('\n'));
            currentChunk = lines.slice(Math.max(0, i - CHUNK_OVERLAP), i + 1);
            lineCount = currentChunk.length;
        }
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
    }

    return { chunks, startLine: currentStartLine };
}

export async function indexCodebase(
    files: FileContent[],
    params: { repoId: string; branchId: string; jobId: string; owner: string; repo: string },
): Promise<number> {
    const { repoId, branchId, jobId, owner, repo } = params;
    let indexedCount = 0;

    const vectors: VectorRecord[] = [];

    for (const file of files) {
        try {
            const existingFile = await prisma.indexedFile.findFirst({
                where: {
                    repositoryId: repoId,
                    branchId: branchId,
                    path: file.path,
                },
                include: { chunks: true },
            });

            if (existingFile && existingFile.hash === file.hash) {
                logger.info({ path: file.path }, 'File unchanged, skipping');
                continue;
            }

            if (existingFile) {
                await prisma.fileChunk.deleteMany({
                    where: { fileId: existingFile.id },
                });
                logger.info({ path: file.path }, 'File changed, re-indexing');
            }

            const fileHash = file.hash ?? '';

            const fileRecord = await prisma.indexedFile.upsert({
                where: {
                    repositoryId_branchId_path: {
                        repositoryId: repoId,
                        branchId: branchId,
                        path: file.path,
                    },
                },
                create: {
                    repositoryId: repoId,
                    branchId: branchId,
                    path: file.path,
                    hash: fileHash,
                    size: file.size,
                    language: detectLanguage(file.path),
                    status: 'indexed',
                    lastIndexedAt: new Date(),
                },
                update: {
                    hash: fileHash,
                    size: file.size,
                    language: detectLanguage(file.path),
                    status: 'indexed',
                    lastIndexedAt: new Date(),
                },
            });

            const { chunks } = chunkContent(file.content, 1);
            let chunkIndex = 0;

            for (const chunkContent of chunks) {
                try {
                    const embedding = await generateEmbedding(chunkContent, 1024);

                    await prisma.fileChunk.create({
                        data: {
                            fileId: fileRecord.id,
                            content: chunkContent,
                            embedding: Buffer.from(embedding),
                            startLine: chunkIndex * (CHUNK_SIZE - CHUNK_OVERLAP) + 1,
                            endLine: Math.min(
                                (chunkIndex + 1) * (CHUNK_SIZE - CHUNK_OVERLAP) + CHUNK_SIZE,
                                file.content.split('\n').length,
                            ),
                        },
                    });

                    vectors.push({
                        id: `${repoId}:${branchId}:${file.path}:chunk:${chunkIndex}`,
                        values: embedding,
                        metadata: {
                            repoId,
                            branchId,
                            owner,
                            repo,
                            path: file.path,
                            content: chunkContent,
                        },
                    });

                    chunkIndex++;
                } catch (error) {
                    logger.error({ error, path: file.path, chunkIndex }, 'Failed to generate embedding for chunk');
                    await prisma.indexedFile.update({
                        where: { id: fileRecord.id },
                        data: { status: 'failed' },
                    });
                    await prisma.indexingEvent.create({
                        data: {
                            jobId,
                            type: 'FILE_CHUNK_FAILED',
                            status: 'failed',
                            message: `Failed to index chunk ${chunkIndex} of ${file.path}`,
                            details: JSON.stringify({ path: file.path, error: String(error) }),
                        },
                    });
                }
            }

            indexedCount++;
            logger.info({ path: file.path, chunkCount: chunks.length }, 'File indexed successfully');

            if (vectors.length >= BATCH_SIZE) {
                await upsertVectors(vectors, repoId);
                vectors.length = 0;
            }
        } catch (error) {
            logger.error({ error, path: file.path }, 'Failed to index file');
            await prisma.indexingEvent.create({
                data: {
                    jobId,
                    type: 'FILE_INDEX_FAILED',
                    status: 'failed',
                    message: `Failed to index file: ${file.path}`,
                    details: JSON.stringify({ path: file.path, error: String(error) }),
                },
            });
        }
    }

    if (vectors.length > 0) {
        await upsertVectors(vectors, repoId);
    }

    logger.info({ repoId, branchId, totalFiles: files.length, indexedCount }, 'Indexed codebase to Pinecone');
    return indexedCount;
}

function detectLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const langMap: Record<string, string> = {
        ts: 'TypeScript',
        tsx: 'TypeScript',
        js: 'JavaScript',
        jsx: 'JavaScript',
        py: 'Python',
        rb: 'Ruby',
        go: 'Go',
        rs: 'Rust',
        java: 'Java',
        kt: 'Kotlin',
        c: 'C',
        cpp: 'C++',
        cs: 'C#',
        php: 'PHP',
        swift: 'Swift',
        scala: 'Scala',
        html: 'HTML',
        css: 'CSS',
        scss: 'SCSS',
        json: 'JSON',
        yaml: 'YAML',
        yml: 'YAML',
        md: 'Markdown',
    };
    return langMap[ext] ?? 'Unknown';
}

function computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
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

export async function indexChangedFiles(
    changedFiles: ChangedFile[],
    params: { repoId: string; branchId: string; jobId: string; owner: string; repo: string },
): Promise<{ indexedCount: number; removedCount: number }> {
    const { repoId, branchId, jobId, owner, repo } = params;
    let indexedCount = 0;
    let removedCount = 0;
    const vectors: VectorRecord[] = [];

    for (const file of changedFiles) {
        try {
            if (file.status === 'removed') {
                const existingFile = await prisma.indexedFile.findFirst({
                    where: {
                        repositoryId: repoId,
                        branchId: branchId,
                        path: file.path,
                    },
                });

                if (existingFile) {
                    await prisma.fileChunk.deleteMany({
                        where: { fileId: existingFile.id },
                    });
                    await prisma.indexedFile.delete({
                        where: { id: existingFile.id },
                    });

                    try {
                        await pineconeIndex.deleteMany({
                            filter: {
                                repoId: { $eq: repoId },
                                branchId: { $eq: branchId },
                                path: { $eq: file.path },
                            },
                        });
                    } catch (e) {
                        logger.warn({ error: e, path: file.path }, 'Failed to delete vectors from Pinecone');
                    }

                    removedCount++;
                    logger.info({ path: file.path }, 'Removed file from index');
                }
                continue;
            }

            if (!file.content) {
                logger.warn({ path: file.path }, 'No content for file, skipping');
                continue;
            }

            const fileHash = computeHash(file.content);

            const existingFile = await prisma.indexedFile.findFirst({
                where: {
                    repositoryId: repoId,
                    branchId: branchId,
                    path: file.path,
                },
                include: { chunks: true },
            });

            if (existingFile && existingFile.hash === fileHash) {
                logger.info({ path: file.path }, 'File unchanged, skipping');
                continue;
            }

            if (existingFile) {
                await prisma.fileChunk.deleteMany({
                    where: { fileId: existingFile.id },
                });
                logger.info({ path: file.path }, 'File changed, re-indexing');
            }

            const fileRecord = await prisma.indexedFile.upsert({
                where: {
                    repositoryId_branchId_path: {
                        repositoryId: repoId,
                        branchId: branchId,
                        path: file.path,
                    },
                },
                create: {
                    repositoryId: repoId,
                    branchId: branchId,
                    path: file.path,
                    hash: fileHash,
                    size: file.size ?? file.content.length,
                    language: detectLanguage(file.path),
                    status: 'indexed',
                    lastIndexedAt: new Date(),
                },
                update: {
                    hash: fileHash,
                    size: file.size ?? file.content.length,
                    language: detectLanguage(file.path),
                    status: 'indexed',
                    lastIndexedAt: new Date(),
                },
            });

            const { chunks } = chunkContent(file.content, 1);
            let chunkIndex = 0;

            for (const chunkContent of chunks) {
                try {
                    const embedding = await generateEmbedding(chunkContent, 1024);

                    await prisma.fileChunk.create({
                        data: {
                            fileId: fileRecord.id,
                            content: chunkContent,
                            embedding: Buffer.from(embedding),
                            startLine: chunkIndex * (CHUNK_SIZE - CHUNK_OVERLAP) + 1,
                            endLine: Math.min(
                                (chunkIndex + 1) * (CHUNK_SIZE - CHUNK_OVERLAP) + CHUNK_SIZE,
                                file.content.split('\n').length,
                            ),
                        },
                    });

                    vectors.push({
                        id: `${repoId}:${branchId}:${file.path}:chunk:${chunkIndex}`,
                        values: embedding,
                        metadata: {
                            repoId,
                            branchId,
                            owner,
                            repo,
                            path: file.path,
                            content: chunkContent,
                        },
                    });

                    chunkIndex++;
                } catch (error) {
                    logger.error({ error, path: file.path, chunkIndex }, 'Failed to generate embedding for chunk');
                }
            }

            indexedCount++;
            logger.info({ path: file.path, chunkCount: chunks.length }, 'File indexed successfully');

            if (vectors.length >= BATCH_SIZE) {
                await upsertVectors(vectors, repoId);
                vectors.length = 0;
            }
        } catch (error) {
            logger.error({ error, path: file.path }, 'Failed to process changed file');
            await prisma.indexingEvent.create({
                data: {
                    jobId,
                    type: 'FILE_INDEX_FAILED',
                    status: 'failed',
                    message: `Failed to process file: ${file.path}`,
                    details: JSON.stringify({ path: file.path, error: String(error) }),
                },
            });
        }
    }

    if (vectors.length > 0) {
        await upsertVectors(vectors, repoId);
    }

    logger.info({ repoId, branchId, indexedCount, removedCount }, 'Processed changed files');
    return { indexedCount, removedCount };
}
