'use client';

import { Activity, BookMarked, Check, ChevronLeft, ListFilter, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useMeasure from 'react-use-measure';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useReviewHistory } from '@/lib/review';
import { Review } from './_components/review';

const ReviewHistoryPage = () => {
    const { data: reviews, isLoading } = useReviewHistory();
    const [searchQuery, setSearchQuery] = useState('');
    const [repoSearchQuery, setRepoSearchQuery] = useState('');
    const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    const [popoverView, setPopoverView] = useState<'main' | 'repos' | 'status'>('main');
    const [direction, setDirection] = useState(0);
    const [sortBy, setSortBy] = useState<'name' | null>('name');

    const [contentRef, { height }] = useMeasure();

    const statuses = ['pending', 'completed', 'failed'];

    useEffect(() => {
        if (!isPopoverOpen) {
            setTimeout(() => {
                setPopoverView('main');
                setDirection(0);
            }, 200);
        }
    }, [isPopoverOpen]);

    const uniqueRepositories = useMemo(() => {
        if (!reviews) return [];
        const repos = reviews.map((review) => ({
            display: review.repository.fullName,
            filterBy: review.repository.name,
        }));
        const unique = [...new Map(repos.map((r) => [r.filterBy, r])).values()];
        return unique;
    }, [reviews]);

    const filteredReposInPopover = useMemo(() => {
        return uniqueRepositories.filter((repo) => repo.filterBy.toLowerCase().includes(repoSearchQuery.toLowerCase()));
    }, [uniqueRepositories, repoSearchQuery]);

    const filteredReviews = useMemo(() => {
        if (!reviews) return [];

        let result = reviews.filter((review) => {
            const matchesSearch =
                searchQuery === '' ||
                review.prTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                review.repository.name.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesRepo = selectedRepo === null || review.repository.name === selectedRepo;

            const matchesStatus =
                selectedStatus === null || review.status?.toLowerCase() === selectedStatus.toLowerCase();

            return matchesSearch && matchesRepo && matchesStatus;
        });

        if (sortBy === 'name') {
            result = [...result].sort((a, b) => a.repository.name.localeCompare(b.repository.name));
        }

        return result;
    }, [reviews, searchQuery, selectedRepo, selectedStatus, sortBy]);

    const handleRepoSelect = useCallback((repoName: string) => {
        setSelectedRepo((prev) => (prev === repoName ? null : repoName));
        setIsPopoverOpen(false);
    }, []);

    const handleStatusSelect = useCallback((status: string) => {
        setSelectedStatus((prev) => (prev === status ? null : status));
        setIsPopoverOpen(false);
    }, []);

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? '100%' : '-100%',
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (direction: number) => ({
            x: direction < 0 ? '100%' : '-100%',
            opacity: 0,
        }),
    };

    const navigateTo = (view: 'main' | 'repos' | 'status', dir: number) => {
        setDirection(dir);
        setPopoverView(view);
    };

    return (
        <div className="min-h-screen bg-neutral-50 text-neutral-700 selection:bg-orange-500/30">
            <div className="px-6 py-6 w-full max-w-7xl mx-auto">
                <div className="mb-6 w-full flex items-center gap-2">
                    <div className="w-full border border-neutral-200 px-2 py-2 focus-within:bg-neutral-100 transition-colors ease-in-out duration-200 flex items-center gap-2 rounded-md">
                        <label htmlFor="projects" className="cursor-pointer">
                            <Search size={14} />
                        </label>
                        <input
                            className="w-full outline-none placeholder:text-neutral-400 text-xs font-medium border-0 bg-transparent"
                            placeholder="Search Projects..."
                            value={searchQuery}
                            id="projects"
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                        <PopoverTrigger
                            className={`border border-neutral-200 hover:bg-neutral-100 group px-2 py-2 rounded-md transition-colors ease-in-out duration-200 ${selectedRepo || selectedStatus ? 'bg-neutral-100' : ''}`}
                        >
                            <ListFilter className="text-neutral-800" size={17} />
                        </PopoverTrigger>

                        <PopoverContent
                            className="w-[280px] p-0 bg-white border-neutral-200 shadow-2xl overflow-hidden"
                            align="end"
                        >
                            <motion.div
                                initial={false}
                                animate={{ height: height > 0 ? height : 'auto' }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                className="relative overflow-hidden"
                            >
                                <div ref={contentRef}>
                                    <AnimatePresence initial={false} custom={direction} mode="popLayout">
                                        {popoverView === 'main' && (
                                            <motion.div
                                                key={popoverView}
                                                custom={direction}
                                                variants={variants}
                                                initial="enter"
                                                animate="center"
                                                style={{
                                                    backfaceVisibility: 'hidden',
                                                    width: '100%',
                                                }}
                                                exit="exit"
                                                transition={{
                                                    type: 'spring',
                                                    stiffness: 300,
                                                    damping: 32,
                                                    opacity: { duration: 0.2 },
                                                }}
                                                className="flex flex-col py-2 w-full min-h-52"
                                            >
                                                <div className="px-4 py-2 text-[12px] font-medium text-neutral-400 font-mono">
                                                    Filter by
                                                </div>
                                                <button
                                                    onClick={() => navigateTo('repos', 1)}
                                                    className="flex items-center gap-2 px-4 py-2 hover:bg-neutral-100 font-medium font-mono transition-colors text-sm text-neutral-800"
                                                >
                                                    <BookMarked size={14} />
                                                    Repository
                                                </button>
                                                <button
                                                    onClick={() => navigateTo('status', 1)}
                                                    className="flex items-center gap-2 px-4 py-2 hover:bg-neutral-100 font-medium font-mono transition-colors text-sm text-neutral-800"
                                                >
                                                    <Activity size={14} />
                                                    Status
                                                </button>

                                                <div className="h-0.5 shadow-[0px_-0.5px_0px_0px_rgba(0,0,0,0.08)_inset] bg-neutral-200 my-2" />

                                                <div className="px-4 py-2 text-[12px] font-medium text-neutral-400 font-mono">
                                                    Sort by
                                                </div>
                                                <button
                                                    onClick={() => setSortBy(sortBy === 'name' ? null : 'name')}
                                                    className="flex items-center justify-between w-full px-4 py-2 hover:bg-neutral-100 transition-colors text-sm text-neutral-800 font-medium font-mono"
                                                >
                                                    <span className="tracking-wider">Name</span>
                                                    {sortBy === 'name' && (
                                                        <Check size={16} className="text-neutral-800" />
                                                    )}
                                                </button>
                                            </motion.div>
                                        )}

                                        {popoverView === 'repos' && (
                                            <motion.div
                                                key={popoverView}
                                                custom={direction}
                                                variants={variants}
                                                initial="enter"
                                                animate="center"
                                                exit="exit"
                                                style={{
                                                    backfaceVisibility: 'hidden',
                                                    width: '100%',
                                                }}
                                                transition={{
                                                    type: 'spring',
                                                    stiffness: 300,
                                                    damping: 32,
                                                    opacity: { duration: 0.2 },
                                                }}
                                                className="flex flex-col h-[350px] w-full"
                                            >
                                                <div className="px-2 py-1 border-b border-neutral-200 flex items-center gap-1">
                                                    <button
                                                        onClick={() => navigateTo('main', -1)}
                                                        className="p-1 hover:bg-neutral-100 rounded text-neutral-400 mt-0.5"
                                                    >
                                                        <ChevronLeft size={16} />
                                                    </button>
                                                    <div className="relative flex-1">
                                                        <div className="px-3 py-1.5">
                                                            <input
                                                                type="text"
                                                                value={repoSearchQuery}
                                                                onChange={(e) => setRepoSearchQuery(e.target.value)}
                                                                placeholder="Search..."
                                                                className="w-full text-neutral-800 bg-transparent placeholder:text-neutral-400 font-mono text-xs outline-none"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex-1 overflow-y-auto py-1 shadow-[0px_0.5px_0px_0px_rgba(0,0,0,0.08)_inset]">
                                                    {filteredReposInPopover.length > 0 ? (
                                                        filteredReposInPopover.map((repo) => (
                                                            <button
                                                                key={repo.filterBy}
                                                                onClick={() => handleRepoSelect(repo.filterBy)}
                                                                className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-neutral-800 font-mono hover:bg-neutral-100 transition-colors ${selectedRepo === repo.filterBy ? 'bg-neutral-100' : ''}`}
                                                            >
                                                                <svg
                                                                    width="16"
                                                                    height="16"
                                                                    viewBox="0 0 24 24"
                                                                    fill="currentColor"
                                                                >
                                                                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                                                                </svg>
                                                                <span className="truncate flex-1 text-left line-clamp-1">
                                                                    {repo.display}
                                                                </span>
                                                                {selectedRepo === repo.filterBy && (
                                                                    <Check size={14} className="text-neutral-800" />
                                                                )}
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <div className="p-4 text-center text-xs text-neutral-400 font-mono">
                                                            No repositories found
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}

                                        {popoverView === 'status' && (
                                            <motion.div
                                                key={popoverView}
                                                custom={direction}
                                                variants={variants}
                                                initial="enter"
                                                animate="center"
                                                exit="exit"
                                                style={{
                                                    backfaceVisibility: 'hidden',
                                                    width: '100%',
                                                }}
                                                transition={{
                                                    type: 'spring',
                                                    stiffness: 300,
                                                    damping: 32,
                                                    opacity: { duration: 0.2 },
                                                }}
                                                className="flex flex-col w-full"
                                            >
                                                <div className="px-2 py-2 border-b border-neutral-200 flex items-center gap-2">
                                                    <button
                                                        onClick={() => navigateTo('main', -1)}
                                                        className="p-1 hover:bg-neutral-100 rounded text-neutral-400"
                                                    >
                                                        <ChevronLeft size={16} />
                                                    </button>
                                                    <span className="text-neutral-800 font-mono text-xs font-bold tracking-tight">
                                                        Status
                                                    </span>
                                                </div>

                                                <div className="flex flex-col py-1 shadow-[0px_0.5px_0px_0px_rgba(0,0,0,0.08)_inset]">
                                                    {statuses.map((status) => (
                                                        <button
                                                            key={status}
                                                            onClick={() => handleStatusSelect(status)}
                                                            className={`w-full flex items-center justify-between px-4 py-2.5 text-xs text-neutral-800 font-mono hover:bg-neutral-100 transition-colors ${selectedStatus === status ? 'bg-neutral-100' : ''}`}
                                                        >
                                                            <div className="flex items-center gap-3 capitalize">
                                                                <div
                                                                    className={`w-2 h-2 rounded-full ${
                                                                        status === 'completed'
                                                                            ? 'bg-green-500'
                                                                            : status === 'pending'
                                                                              ? 'bg-orange-500'
                                                                              : 'bg-red-500'
                                                                    }`}
                                                                />
                                                                {status}
                                                            </div>
                                                            {selectedStatus === status && (
                                                                <Check size={14} className="text-neutral-800" />
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        </PopoverContent>
                    </Popover>
                </div>
                {/* ... (rest of the code remains the same) */}
                {isLoading ? (
                    <div className="py-20 text-center font-mono text-xs text-neutral-400 tracking-[0.2em] animate-pulse">
                        LOADING_DATA...
                    </div>
                ) : filteredReviews.length === 0 ? (
                    <div className="py-20 text-center font-mono text-xs text-neutral-400 tracking-[0.2em]">
                        NO_REVIEWS_FOUND
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredReviews.map((review) => (
                            <Review review={review} key={review.id} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewHistoryPage;
