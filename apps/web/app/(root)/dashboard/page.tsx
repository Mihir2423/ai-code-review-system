'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchGitHubStats } from '@/lib/github/github-stats';
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

export default function DashboardPage() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['github-stats'],
        queryFn: fetchGitHubStats,
    });

    const stats = data ? transformGitHubStatsToStats(data?.content) : [];

    return (
        <div className="min-h-screen bg-neutral-50 p-0 text-neutral-700">
            <div className="px-7 py-8">
                <div className={`mb-7 transition-all duration-500 ease-out opacity-100 translate-y-0`}>
                    <h1 className="mb-1.5 text-[22px] font-semibold tracking-wide text-neutral-900">
                        Dashboard Overview
                    </h1>
                    <p className="font-mono text-xs text-neutral-400">
                        Tracking your codebase activity across all connected sources.
                    </p>
                </div>

                {error ? (
                    <div className="flex items-center justify-center p-8">
                        <div className="text-red-500 font-mono text-sm">Failed to load stats: {error.message}</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {isLoading
                            ? Array.from({ length: 2 }).map((_, i) => <StatCardSkeleton key={i} index={i} />)
                            : stats.map((stat, i) => <StatCard key={stat.id} stat={stat} index={i} />)}
                    </div>
                )}

                <div
                    className={`mt-5 flex items-center justify-between rounded-md border border-neutral-200 bg-white px-[18px] py-3.5 transition-all duration-700 ease-out opacity-100`}
                >
                    <div className="flex gap-6">
                        {[
                            { label: 'Last sync', value: '2 min ago' },
                            { label: 'Active branches', value: '12' },
                            { label: 'Open PRs', value: '7' },
                            { label: 'Pending reviews', value: '3' },
                        ].map(({ label, value }) => (
                            <div key={label}>
                                <div className="mb-0.5 font-mono text-[10px] text-neutral-400">{label}</div>
                                <div className="font-mono text-[13px] text-neutral-600">{value}</div>
                            </div>
                        ))}
                    </div>
                    <div className="text-right font-mono text-[10px] text-neutral-400">
                        <div>MF-DASH · v2.4.1</div>
                        <div className="mt-0.5 text-neutral-500">Auto-refresh enabled</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
