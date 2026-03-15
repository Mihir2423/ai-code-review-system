'use client';

import { useQuery } from '@tanstack/react-query';
import { authClient } from './auth-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface IssueWithMetadata {
    file: string;
    line: number;
    severity: string;
    description: string;
    commentBody: string;
    diff: {
        oldCode: string;
        newCode: string;
    };
}

export interface ReviewHistoryItem {
    id: string;
    prNumber: number;
    prTitle: string;
    prUrl: string;
    review: string;
    issues: IssueWithMetadata[];
    status: string;
    createdAt: Date;
    updatedAt: Date;
    repository: {
        id: string;
        name: string;
        owner: string;
        fullName: string;
    };
}

export async function fetchReviewHistory(): Promise<ReviewHistoryItem[]> {
    const { data: session } = await authClient.getSession();

    if (!session) {
        throw new Error('No session found');
    }

    const response = await fetch(`${API_BASE_URL}/api/review/history`, {
        headers: {
            Authorization: `Bearer ${session.session?.token}`,
        },
        credentials: 'include',
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch review history');
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.message || 'Failed to fetch review history');
    }

    return result.content.map((item: ReviewHistoryItem & { issues: string[] }) => ({
        ...item,
        issues: item.issues.map((issueStr: string) => {
            try {
                return JSON.parse(issueStr) as IssueWithMetadata;
            } catch {
                return {
                    file: '',
                    line: 0,
                    severity: 'warning',
                    description: issueStr,
                    commentBody: issueStr,
                    diff: { oldCode: '', newCode: '' },
                } as IssueWithMetadata;
            }
        }),
    }));
}

export function useReviewHistory() {
    return useQuery({
        queryKey: ['review-history'],
        queryFn: fetchReviewHistory,
    });
}
