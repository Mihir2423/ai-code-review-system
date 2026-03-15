'use client';

import type { GitHubRepository } from '@repo/types';
import { authClient } from '../auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface PaginatedRepositories {
    repositories: GitHubRepository[];
    pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
    };
}

export type GitHubRepositoriesResponse = PaginatedRepositories;

export async function fetchGitHubRepositories(cursor?: string): Promise<GitHubRepositoriesResponse> {
    const { data: session } = await authClient.getSession();

    if (!session) {
        throw new Error('No session found');
    }

    const url = new URL(`${API_BASE_URL}/api/github/repositories`);
    if (cursor) {
        url.searchParams.set('cursor', cursor);
    }

    const response = await fetch(url.toString(), {
        headers: {
            Authorization: `Bearer ${(session).session?.token}`,
        },
        credentials: 'include',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch repositories');
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.message || 'Failed to fetch repositories');
    }

    return result.content;
}

export async function connectGitHubRepository(owner: string, repo: string): Promise<unknown> {
    const { data: session } = await authClient.getSession();

    if (!session) {
        throw new Error('No session found');
    }

    const response = await fetch(`${API_BASE_URL}/api/github/connect`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session?.token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ owner, repo }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to connect repository');
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.message || 'Failed to connect repository');
    }

    return result.content;
}

export async function fetchConnectedRepositories(): Promise<unknown[]> {
    const { data: session } = await authClient.getSession();

    if (!session) {
        throw new Error('No session found');
    }

    const response = await fetch(`${API_BASE_URL}/api/github/connected`, {
        headers: {
            Authorization: `Bearer ${session.session?.token}`,
        },
        credentials: 'include',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch connected repositories');
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.message || 'Failed to fetch connected repositories');
    }

    return result.content;
}

export async function reindexRepository(repoId: string): Promise<unknown> {
    const { data: session } = await authClient.getSession();

    if (!session) {
        throw new Error('No session found');
    }

    const response = await fetch(`${API_BASE_URL}/api/github/reindex`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session?.token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ repoId }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reindex repository');
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.message || 'Failed to reindex repository');
    }

    return result.content;
}
