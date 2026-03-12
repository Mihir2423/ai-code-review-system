import { logger } from '@repo/logger';
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
];

const EXCLUDED_EXTENSIONS = ['.lock', '.min.js', '.min.css', '.map'];

const MAX_FILE_SIZE = 1 * 1024 * 1024;

function isExcluded(path: string): boolean {
    const parts = path.split('/');
    return EXCLUDED_PATHS.some((excluded) => parts.includes(excluded));
}

function isExcludedExtension(path: string): boolean {
    return EXCLUDED_EXTENSIONS.some((ext) => path.endsWith(ext));
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
