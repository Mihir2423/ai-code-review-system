'use client';

import type { GitHubStats } from '@repo/types';
import { authClient } from './auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

type GithubStatsReponse = {
    content: GitHubStats;
};

export async function fetchGitHubStats(): Promise<GithubStatsReponse> {
    const { data: session } = await authClient.getSession();

    if (!session) {
        throw new Error('No session found');
    }

    const response = await fetch(`${API_BASE_URL}/api/github/stats`, {
        headers: {
            Authorization: `Bearer ${(session).session?.token}`,
        },
        credentials: 'include',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch stats');
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.message || 'Failed to fetch stats');
    }

    return result;
}
