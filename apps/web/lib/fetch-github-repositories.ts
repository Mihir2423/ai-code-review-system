'use client';

import type { GitHubRepository } from '@repo/types';
import { authClient } from './auth-client';

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
