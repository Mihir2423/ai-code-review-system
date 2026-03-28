'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchGitHubStats } from '@/lib/github/github-stats';
import { fetchReviewStats } from '@/lib/review';
import { StatCard, StatCardSkeleton } from './_components';

function transformGitHubStatsToStats(githubStats: {
    repos: { total: number; thisMonth: number; trend: { month: string; count: number }[] };
    commits: { total: number; thisWeek: number; trend: { month: string; count: number }[] };
}) {
    return [
        {
            id: 'STAT-001',
            label: 'Total Repositories',
            value: githubStats.repos.total,
            change: `+${githubStats.repos.thisMonth} this month`,
            status: 'Active',
            statusColor: '#16a34a',
            tag: 'VCS',
            tagIcon: '◈',
            tagColor: '#0284c7',
            accentColor: '#f97316',
            trend: githubStats.repos.trend.map((t) => t.count),
        },
        {
            id: 'STAT-002',
            label: 'Total Commits',
            value: githubStats.commits.total,
            change: `+${githubStats.commits.thisWeek} this week`,
            status: 'Live',
            statusColor: '#6366f1',
            tag: 'Activity',
            tagIcon: '◈',
            tagColor: '#db2777',
            accentColor: '#0284c7',
            trend: githubStats.commits.trend.map((t) => t.count),
        },
    ];
}

function transformReviewStatsToStats(reviewStats: {
    total: number;
    thisWeek: number;
    completed: number;
    pending: number;
    failed: number;
    critical: number;
    warning: number;
    suggestion: number;
    avgIssuesPerReview: number;
    trend: { week: string; count: number }[];
}) {
    return [
        {
            id: 'STAT-003',
            label: 'Total Reviews',
            value: reviewStats.total,
            change: `+${reviewStats.thisWeek} this week`,
            status: reviewStats.pending > 0 ? 'Pending' : 'Complete',
            statusColor: reviewStats.pending > 0 ? '#f59e0b' : '#16a34a',
            tag: 'Reviews',
            tagIcon: '◈',
            tagColor: '#8b5cf6',
            accentColor: '#8b5cf6',
            trend: reviewStats.trend.map((t) => t.count),
        },
        {
            id: 'STAT-004',
            label: 'Issues Found',
            value: reviewStats.critical + reviewStats.warning + reviewStats.suggestion,
            change: `${reviewStats.critical} critical, ${reviewStats.warning} warning`,
            status: reviewStats.completed > 0 ? 'Analyzed' : 'No Data',
            statusColor: reviewStats.completed > 0 ? '#6366f1' : '#9ca3af',
            tag: 'AI Analysis',
            tagIcon: '◈',
            tagColor: '#ec4899',
            accentColor: '#ec4899',
            trend: reviewStats.trend.map((t) => t.count * 2),
        },
    ];
}

export default function DashboardPage() {
    const {
        data: githubData,
        isLoading: githubLoading,
        error: githubError,
    } = useQuery({
        queryKey: ['github-stats'],
        queryFn: fetchGitHubStats,
    });

    const {
        data: reviewData,
        isLoading: reviewLoading,
        error: reviewError,
    } = useQuery({
        queryKey: ['review-stats'],
        queryFn: fetchReviewStats,
    });

    const githubStats = githubData ? transformGitHubStatsToStats(githubData.content) : [];
    const reviewStats = reviewData ? transformReviewStatsToStats(reviewData) : [];
    const allStats = [...githubStats, ...reviewStats];

    const isLoading = githubLoading || reviewLoading;
    const error = githubError || reviewError;

    return (
        <div className="min-h-screen bg-neutral-50 p-0 text-neutral-700">
            <div className="px-7 py-8">
                <div className={`mb-7 transition-all duration-500 ease-out opacity-100 translate-y-0`}>
                    <h1 className="mb-1.5 text-[22px] font-semibold tracking-wide text-neutral-900">
                        Dashboard Overview
                    </h1>
                    <p className="font-mono text-xs text-neutral-400">
                        Tracking your codebase activity and AI code review patterns.
                    </p>
                </div>

                {error ? (
                    <div className="flex items-center justify-center p-8">
                        <div className="text-red-500 font-mono text-sm">Failed to load stats: {error.message}</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {isLoading
                            ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} index={i} />)
                            : allStats.map((stat, i) => <StatCard key={stat.id} stat={stat} index={i} />)}
                    </div>
                )}
            </div>
        </div>
    );
}
