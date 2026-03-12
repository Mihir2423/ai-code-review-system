'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
    connectGitHubRepository,
    fetchGitHubRepositories,
    type PaginatedRepositories,
} from '@/lib/github/github-repositories';

export function AddRepositoriesButton() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <Plus size={16} />
                Add Repositories
            </Button>
            <AddRepositoriesDialog open={open} onOpenChange={setOpen} />
        </>
    );
}

interface AddRepositoriesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function AddRepositoriesDialog({ open, onOpenChange }: AddRepositoriesDialogProps) {
    const queryClient = useQueryClient();
    const [connectingRepo, setConnectingRepo] = useState<string | null>(null);

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<PaginatedRepositories>(
        {
            queryKey: ['github-repositories'],
            queryFn: ({ pageParam }) => fetchGitHubRepositories(pageParam as string | undefined),
            initialPageParam: undefined as string | undefined,
            getNextPageParam: (lastPage) => (lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined),
        },
    );

    const connectMutation = useMutation({
        mutationFn: ({ owner, repo }: { owner: string; repo: string }) => connectGitHubRepository(owner, repo),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['connected-repositories'] });
            setConnectingRepo(null);
            onOpenChange(false);
        },
        onError: () => {
            setConnectingRepo(null);
        },
    });

    const observerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    fetchNextPage();
                }
            },
            { threshold: 1.0 },
        );

        if (observerRef.current) {
            observer.observe(observerRef.current);
        }

        return () => observer.disconnect();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    useEffect(() => {
        if (!open) {
        }
    }, [open]);

    const handleConnect = (owner: string, repo: string) => {
        setConnectingRepo(repo);
        connectMutation.mutate({ owner, repo });
    };

    const repositories = data?.pages.flatMap((page) => page.repositories) ?? [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="flex flex-col p-0 gap-0 overflow-hidden"
                style={{
                    maxWidth: '440px',
                    maxHeight: '80vh',
                    background: '#0d0d0d',
                    border: '1px solid #242424',
                    borderRadius: '8px',
                }}
            >
                <style>{`
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 6px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: #0d0d0d;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: #242424;
                        border-radius: 3px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: #333333;
                    }
                `}</style>
                <div className="flex items-center justify-between flex-shrink-0 px-5 pb-[14px] pt-4 border-b border-[#1a1a1a]">
                    <div className="flex flex-col gap-[3px]">
                        <span className="font-mono text-[10px] text-[#444] tracking-[0.1em]">VCS · REPOSITORIES</span>
                        <span className="text-[15px] font-semibold text-[#f0f0f0] tracking-[-0.01em]">
                            All Repositories
                        </span>
                    </div>
                    {!isLoading && repositories.length > 0 && (
                        <div className="flex items-center gap-[5px] bg-[#141414] border border-[#242424] rounded px-[9px] py-1">
                            <div className="w-[6px] h-[6px] rounded-full bg-[#4ade80] shadow-[0_0_6px_#4ade8066]" />
                            <span className="font-mono text-[10px] text-[#4ade80] tracking-[0.05em]">
                                {repositories.length} found
                            </span>
                        </div>
                    )}
                </div>

                <div
                    className="flex-1 overflow-y-auto custom-scrollbar"
                    style={{
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                    }}
                >
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center gap-2.5 py-12">
                            <div className="w-5 h-5 border-2 border-[#242424] border-t-[#38bdf8] rounded-full animate-spin" />
                            <span className="font-mono text-[11px] text-[#444] tracking-[0.06em]">
                                Fetching repositories...
                            </span>
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        </div>
                    ) : repositories.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 py-12">
                            <span className="text-xl opacity-30">⬡</span>
                            <span className="font-mono text-[11px] text-[#444]">No repositories found</span>
                        </div>
                    ) : (
                        repositories.map((repo, i) => (
                            <div
                                key={repo.id}
                                className="flex items-center justify-between px-3 py-2.5 bg-[#141414] border border-[#1e1e1e] rounded-md gap-2.5 cursor-default transition-colors duration-150 hover:border-[#2a2a2a]"
                            >
                                <div className="flex flex-col gap-[3px] min-w-0">
                                    <span className="font-mono text-[9px] text-[#3a3a3a] tracking-[0.08em]">
                                        #{String(i + 1).padStart(3, '0')}
                                    </span>
                                    <span className="text-[12px] font-medium text-[#e8e8ea] truncate font-['JetBrains_Mono',monospace]">
                                        {repo.name}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <a
                                        href={repo.htmlUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center w-[26px] h-[26px] rounded border border-[#242424] bg-transparent text-[#555] hover:text-[#aaa] hover:border-[#333] transition-colors duration-150 no-underline"
                                    >
                                        <ExternalLink size={12} />
                                    </a>
                                    <button
                                        onClick={() => {
                                            const [owner, repoName] = repo.fullName.split('/');
                                            handleConnect(owner, repoName);
                                        }}
                                        disabled={connectingRepo === repo.name}
                                        className="h-[26px] px-2.5 rounded border border-[#f97316] bg-transparent text-[#f97316] font-mono text-[10px] tracking-[0.06em] cursor-pointer hover:bg-[#f9731614] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {connectingRepo === repo.name ? 'Connecting...' : 'Connect'}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}

                    <div ref={observerRef} className="h-1" />

                    {isFetchingNextPage && (
                        <div className="flex items-center justify-center gap-2 py-3">
                            <div className="w-3.5 h-3.5 border border-[#242424] border-t-[#38bdf8] rounded-full animate-spin" />
                            <span className="font-mono text-[10px] text-[#444]">Loading more...</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between flex-shrink-0 px-5 py-2.5 border-t border-[#1a1a1a]">
                    <span className="font-mono text-[9px] text-[#333] tracking-[0.06em]">
                        MF-REPO · SCROLL TO LOAD MORE
                    </span>
                    <div className="flex items-center gap-[5px]">
                        <div className="w-[5px] h-[5px] rounded-full bg-[#fbbf24] shadow-[0_0_5px_#fbbf2466]" />
                        <span className="font-mono text-[9px] text-[#555]">Syncing</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
