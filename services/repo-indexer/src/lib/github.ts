import { logger } from '@repo/logger';
import { createHash } from 'crypto';
import type { Octokit } from 'octokit';

export interface RepoDetails {
    repoId: string;
    owner: string;
    repo: string;
    url: string;
}

export interface FileContent {
    path: string;
    content: string;
    sha: string;
    size: number;
    type: 'file' | 'dir';
    hash?: string;
}

const EXCLUDED_PATHS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'coverage',
    '.cache',
    '__pycache__',
    '.venv',
    'vendor',
    'public',
    'assets',
    'static',
];

const EXCLUDED_EXTENSIONS = [
    '.lock',
    '.min.js',
    '.min.css',
    '.map',
    '.svg',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.ico',
    '.pdf',
    '.zip',
    '.tar',
    '.gz',
    '.exe',
    '.dll',
    '.so',
    '.dylib',
    '.bin',
    '.wasm',
];

const EXCLUDED_FILE_NAMES = [
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'bun.lockb',
    '.DS_Store',
    'Thumbs.db',
];

const MAX_FILE_SIZE = 1 * 1024 * 1024;

function isExcluded(path: string): boolean {
    const parts = path.split('/');
    const fileName = parts[parts.length - 1] ?? '';
    if (EXCLUDED_FILE_NAMES.includes(fileName)) {
        return true;
    }
    return EXCLUDED_PATHS.some((excluded) => parts.includes(excluded));
}

function isExcludedExtension(path: string): boolean {
    return EXCLUDED_EXTENSIONS.some((ext) => path.endsWith(ext));
}

function computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

async function fetchAllFiles(
    octokit: Octokit,
    owner: string,
    repo: string,
    path: string,
    allFiles: FileContent[],
    onFileFetched?: (file: FileContent) => Promise<void>,
): Promise<void> {
    const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
    });

    const contents = response.data;
    if (!Array.isArray(contents)) {
        if (contents.type === 'file') {
            await processFile(contents, allFiles, octokit, onFileFetched);
        }
        return;
    }

    for (const item of contents) {
        if (isExcluded(item.path) || isExcludedExtension(item.path)) {
            continue;
        }

        if (item.type === 'dir') {
            await fetchAllFiles(octokit, owner, repo, item.path, allFiles, onFileFetched);
        } else if (item.type === 'file') {
            await processFile(item, allFiles, octokit, onFileFetched);
        }
    }
}

async function processFile(
    item: { path: string; sha: string; size: number; content?: string | null; download_url?: string | null },
    allFiles: FileContent[],
    octokit: Octokit,
    onFileFetched?: (file: FileContent) => Promise<void>,
): Promise<void> {
    if (item.size > MAX_FILE_SIZE) {
        logger.warn({ path: item.path, size: item.size }, 'Skipping large file');
        return;
    }

    try {
        let content = '';
        if (item.content) {
            content = Buffer.from(item.content, 'base64').toString('utf-8');
        } else if (item.download_url) {
            const fileResponse = await octokit.request(item.download_url);
            if (typeof fileResponse.data === 'string') {
                content = fileResponse.data;
            }
        }

        const fileData: FileContent = {
            path: item.path,
            content,
            sha: item.sha,
            size: item.size,
            type: 'file',
            hash: computeHash(content),
        };

        allFiles.push(fileData);

        if (onFileFetched) {
            await onFileFetched(fileData);
        }
    } catch (error) {
        logger.error({ error, path: item.path }, 'Failed to fetch file content');
    }
}

export async function fetchRepositoryFiles(
    octokit: Octokit,
    repoDetails: RepoDetails,
    onFileFetched?: (file: FileContent) => Promise<void>,
): Promise<FileContent[]> {
    const { owner, repo } = repoDetails;
    const allFiles: FileContent[] = [];

    try {
        await fetchAllFiles(octokit, owner, repo, '', allFiles, onFileFetched);
    } catch (error) {
        logger.error({ error, owner, repo }, 'Failed to fetch repository files');
        throw error;
    }

    logger.info({ fileCount: allFiles.length, owner, repo }, 'Fetched all files from repository');
    return allFiles;
}

export interface ChangedFile {
    path: string;
    status: 'added' | 'modified' | 'removed' | 'renamed';
    content?: string;
    sha?: string;
    size?: number;
}

export async function fetchChangedFiles(
    octokit: Octokit,
    owner: string,
    repo: string,
    baseCommitSha: string,
    headCommitSha: string,
): Promise<{ changedFiles: ChangedFile[]; isFullIndex: boolean }> {
    if (!baseCommitSha || !headCommitSha) {
        logger.info({ owner, repo }, 'No base/head commit SHA, falling back to full indexing');
        return { changedFiles: [], isFullIndex: true };
    }

    if (baseCommitSha === headCommitSha) {
        logger.info({ owner, repo, baseCommitSha, headCommitSha }, 'Commits are identical, no changes');
        return { changedFiles: [], isFullIndex: false };
    }

    try {
        const response = await octokit.rest.repos.compareCommits({
            owner,
            repo,
            base: baseCommitSha,
            head: headCommitSha,
        });

        const data = response.data;
        const files: ChangedFile[] = [];

        if (data.files) {
            for (const file of data.files) {
                if (isExcluded(file.filename) || isExcludedExtension(file.filename)) {
                    logger.info({ path: file.filename, status: file.status }, 'File excluded from indexing');
                    continue;
                }

                if (file.status === 'removed') {
                    files.push({
                        path: file.filename,
                        status: 'removed',
                    });
                } else if (file.status === 'added' || file.status === 'modified' || file.status === 'renamed') {
                    let content = '';
                    if (file.contents_url) {
                        try {
                            const contentResponse = await octokit.request(file.contents_url);
                            if (typeof contentResponse.data === 'string') {
                                content = contentResponse.data;
                            } else if (contentResponse.data?.content) {
                                content = Buffer.from(contentResponse.data.content, 'base64').toString('utf-8');
                            }
                        } catch (err) {
                            logger.error({ error: err, path: file.filename }, 'Failed to fetch file content');
                        }
                    }

                    files.push({
                        path: file.filename,
                        status: file.status as 'added' | 'modified' | 'renamed',
                        content,
                        sha: file.sha ?? '',
                    });
                }
            }
        }

        const totalChanges = (data.ahead_by ?? 0) + (data.behind_by ?? 0);
        const isLargeDiff = totalChanges > 500;

        if (isLargeDiff) {
            logger.warn(
                { totalChanges, ahead: data.ahead_by, behind: data.behind_by },
                'Large diff detected, falling back to full indexing',
            );
            return { changedFiles: [], isFullIndex: true };
        }

        logger.info(
            { changedCount: files.length, baseCommitSha, headCommitSha },
            'Fetched changed files via compare API',
        );
        return { changedFiles: files, isFullIndex: false };
    } catch (error) {
        logger.error(
            { error, owner, repo, baseCommitSha, headCommitSha },
            'Compare API failed, falling back to full indexing',
        );
        return { changedFiles: [], isFullIndex: true };
    }
}
