'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { ExternalLink, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchGitHubRepositories, type PaginatedRepositories } from '@/lib/fetch-github-repositories';

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
    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery<PaginatedRepositories>(
        {
            queryKey: ['github-repositories'],
            queryFn: ({ pageParam }) => fetchGitHubRepositories(pageParam as string | undefined),
            initialPageParam: undefined as string | undefined,
            getNextPageParam: (lastPage) => (lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined),
        },
    );

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

    const handleConnect = (repoName: string) => {
        console.log(repoName);
    };

    const repositories = data?.pages.flatMap((page) => page.repositories) ?? [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>All Repositories</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-2 -mx-2 px-2">
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading repositories...</div>
                    ) : repositories.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No repositories found</div>
                    ) : (
                        repositories.map((repo) => (
                            <div
                                key={repo.id}
                                className="flex items-center justify-between p-3 rounded-lg"
                                style={{ background: '#0e0e12', border: '1px solid #1e1e24' }}
                            >
                                <span className="text-sm font-medium truncate" style={{ color: '#e8e8ea' }}>
                                    {repo.name}
                                </span>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={repo.htmlUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded hover:bg-white/5"
                                        style={{ color: '#808088' }}
                                    >
                                        <ExternalLink size={14} />
                                    </a>
                                    <Button size="sm" variant="outline" onClick={() => handleConnect(repo.name)}>
                                        Connect
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}

                    <div ref={observerRef} className="h-4" />

                    {isFetchingNextPage && (
                        <div className="text-center py-4 text-muted-foreground">Loading more...</div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
