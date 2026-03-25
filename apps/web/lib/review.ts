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

export interface ReviewEventItem {
    id: string;
    reviewId: string;
    type: string;
    queueName: string | null;
    stage: string | null;
    status: string;
    message: string;
    details: string | null;
    createdAt: Date;
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

export async function fetchReviewEvents(reviewId: string): Promise<ReviewEventItem[]> {
    const { data: session } = await authClient.getSession();

    if (!session) {
        throw new Error('No session found');
    }

    const response = await fetch(`${API_BASE_URL}/api/review/events/${reviewId}`, {
        headers: {
            Authorization: `Bearer ${session.session?.token}`,
        },
        credentials: 'include',
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch review events');
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.message || 'Failed to fetch review events');
    }

    return result.content;
}

export async function fetchReviewById(reviewId: string): Promise<ReviewHistoryItem> {
    const { data: session } = await authClient.getSession();

    if (!session) {
        throw new Error('No session found');
    }

    const response = await fetch(`${API_BASE_URL}/api/review/${reviewId}`, {
        headers: {
            Authorization: `Bearer ${session.session?.token}`,
        },
        credentials: 'include',
    });
    if (response.status === 404) {
        throw new Error('Review not found');
    }
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch review');
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.message || 'Failed to fetch review');
    }

    const item = result.content as ReviewHistoryItem & { issues: string[] };
    return {
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
    };
}

export function useReviewHistory() {
    return useQuery({
        queryKey: ['review-history'],
        queryFn: fetchReviewHistory,
    });
}
