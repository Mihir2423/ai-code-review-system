'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react';
import { useState } from 'react';
import { fetchConnectedRepositories } from '@/lib/github/github-repositories';
import { AddRepositoriesButton } from './add-repositories-button';

export function DashboardContent() {
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const { data: connectedRepos, isLoading } = useQuery({
        queryKey: ['connected-repositories'],
        queryFn: fetchConnectedRepositories,
    });

    return (
        <main className="flex-1 overflow-y-auto px-8 py-6" style={{ background: '#fafafa' }}>
            <h1 className="text-2xl font-bold mb-1" style={{ color: '#18181b' }}>
                Repositories
            </h1>
            <p className="text-sm mb-5" style={{ color: '#71717a' }}>
                List of repositories accessible to CodeRabbit.
            </p>

            <div className="flex items-center justify-between mb-4">
                <div
                    className="flex items-center gap-2 rounded-lg px-3"
                    style={{
                        background: '#ffffff',
                        border: '1px solid #e4e4e7',
                        height: 38,
                        maxWidth: 320,
                    }}
                >
                    <Search size={14} color="#a1a1aa" />
                    <input
                        placeholder="Search repositories"
                        className="flex-1 bg-transparent text-sm outline-none"
                        style={{ color: '#18181b', caretColor: '#18181b' }}
                    />
                </div>
                <AddRepositoriesButton />
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e4e4e7' }}>
                <div
                    className="flex items-center px-4 py-2.5"
                    style={{
                        background: '#f4f4f5',
                        borderBottom: '1px solid #e4e4e7',
                    }}
                >
                    <button
                        className="flex items-center gap-1.5 text-xs font-medium"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#71717a',
                        }}
                        type="button"
                    >
                        Repository
                        <ArrowUpDown size={12} color="#a1a1aa" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-5 h-5 border-2 border-neutral-200 border-t-blue-400 rounded-full animate-spin" />
                    </div>
                ) : connectedRepos && connectedRepos.length > 0 ? (
                    connectedRepos.map((repo: unknown) => {
                        const r = repo as { fullName: string };
                        return (
                            <div
                                key={r.fullName}
                                className="flex items-center px-4 py-3.5 cursor-pointer transition-colors"
                                style={{ borderBottom: '1px solid #f4f4f5', background: '#ffffff' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                            >
                                <span className="text-sm font-medium" style={{ color: '#2563eb' }}>
                                    {r.fullName}
                                </span>
                            </div>
                        );
                    })
                ) : (
                    <div className="flex items-center justify-center py-12 bg-white" style={{ color: '#a1a1aa' }}>
                        <span>No connected repositories</span>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-3" style={{ color: '#71717a', fontSize: 13 }}>
                <div className="flex items-center gap-2">
                    <span>Rows per page</span>
                    <div
                        className="flex items-center gap-1 rounded px-2 py-1"
                        style={{
                            background: '#ffffff',
                            border: '1px solid #e4e4e7',
                            cursor: 'pointer',
                        }}
                    >
                        <span style={{ color: '#18181b' }}>{rowsPerPage}</span>
                        <ChevronDown size={12} color="#a1a1aa" />
                    </div>
                </div>
                <span style={{ color: '#71717a' }}>Page 1 of 1</span>
                <div className="flex items-center gap-0.5">
                    {[ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight].map((Icon, i) => (
                        <button
                            key={i}
                            type="button"
                            className="flex items-center justify-center rounded"
                            style={{
                                width: 26,
                                height: 26,
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#a1a1aa',
                            }}
                        >
                            <Icon size={14} />
                        </button>
                    ))}
                </div>
            </div>
        </main>
    );
}
