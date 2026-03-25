'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDown, SquareArrowOutUpRight, Terminal } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { fetchReviewById } from '@/lib/review';
import { type ReviewEvent, useReviewEvents } from '@/lib/use-review-events';

type Props = {
    id: string;
};

function formatMs(ms: number): string {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms)}ms`;
}

function formatDate(isoString: string | null): string {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

const statusClasses: Record<ReviewEvent['status'], string> = {
    success: 'border-green-500 bg-green-500/50',
    pending: 'border-yellow-500 bg-yellow-500/50',
    error: 'border-red-500 bg-red-500/50',
};

export const ReviewContent = ({ id }: Props) => {
    const { events, isLoading } = useReviewEvents({ reviewId: id, fetchSavedEvents: true });
    const { data: review } = useQuery({
        queryKey: ['review', id],
        queryFn: () => fetchReviewById(id),
    });
    const [selectedEvent, setSelectedEvent] = useState<ReviewEvent | null>(null);
    const [now] = useState(() => Date.now());

    const timestamped = useMemo(
        () => events.filter((e): e is ReviewEvent & { timestamp: string } => typeof e.timestamp === 'string'),
        [events],
    );

    const totalMs = useMemo(() => {
        if (timestamped.length < 2) return 0;
        return (
            new Date(timestamped[timestamped.length - 1].timestamp).getTime() -
            new Date(timestamped[0].timestamp).getTime()
        );
    }, [timestamped]);

    const queuedAt = timestamped.length > 0 ? timestamped[0].timestamp : null;
    const startedAt = timestamped.length > 0 ? timestamped[0].timestamp : null;

    const processedEvents = useMemo(() => {
        if (timestamped.length === 0) return [];
        const startTime = new Date(timestamped[0].timestamp).getTime();
        const lastTime = new Date(timestamped[timestamped.length - 1].timestamp).getTime();
        const totalDuration = Math.max(lastTime - startTime, 1000);

        return timestamped.map((event, index) => {
            const currentTime = new Date(event.timestamp).getTime();
            const nextTs = timestamped[index + 1]?.timestamp;
            const nextTime = nextTs ? new Date(nextTs).getTime() : event.status === 'pending' ? now : currentTime + 500;

            const startOffset = ((currentTime - startTime) / totalDuration) * 100;
            const durationMs = nextTime - currentTime;
            const width = Math.max((durationMs / totalDuration) * 100, 2);

            return { ...event, startOffset, width, durationMs };
        });
    }, [timestamped, now]);

    return (
        <div className="h-full text-neutral-300 selection:bg-orange-500/30 p-6 font-mono">
            <div className="mx-auto max-w-7xl flex flex-col border rounded-lg border-neutral-200">
                <div className="flex items-center justify-between border-b border-neutral-200 py-2 px-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-black text-sm font-medium">PR Review Detail</h3>
                        {isLoading && (
                            <div className="flex gap-1">
                                <div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce" />
                                <div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                                <div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href={`https://github.com/${review?.repository?.fullName ?? ''}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 hover:bg-neutral-200/35 transition-colors ease-in-out duration-200 border border-neutral-200 rounded-md text-black text-xs px-2 py-1.5"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                            </svg>
                            Repository
                        </Link>
                        <Link
                            href={review?.prUrl ?? ''}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 transition-colors ease-in-out duration-200 border border-neutral-200 rounded-md text-white bg-black text-xs px-2 py-1.5"
                        >
                            Source Context
                            <SquareArrowOutUpRight size={12} />
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-2 border-b border-neutral-200">
                    <div className="border-r border-neutral-200 flex flex-col">
                        <div className="flex flex-wrap py-2 px-4 gap-y-2 gap-x-6 pb-2">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-neutral-600">PR No.</span>
                                <span className="text-black text-sm font-medium truncate max-w-[120px]">
                                    {review?.prNumber ?? id}
                                </span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-neutral-600">APP</span>
                                <Link
                                    href={review?.prUrl ?? ''}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-black"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                                    </svg>
                                    <span className="text-sm font-medium text-blue-400">
                                        {review?.repository?.fullName ?? 'Unknown'}
                                    </span>
                                </Link>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-neutral-600">Duration</span>
                                <span className="text-black text-sm font-medium">{formatMs(totalMs)}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-neutral-600">Queued at</span>
                                <span className="text-black text-sm font-medium">{formatDate(queuedAt)}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-neutral-600">Started at</span>
                                <span className="text-black text-sm font-medium">{formatDate(startedAt)}</span>
                            </div>
                        </div>

                        <div className="border-b border-neutral-200 px-2.5 py-2">
                            <button className="flex items-center gap-2 px-1.5 cursor-pointer w-fit text-black">
                                <span className="text-black text-sm font-medium">Trace</span>
                                <ArrowDown size={14} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-2 py-2 px-3 max-h-100 overflow-y-auto">
                            {isLoading && events.length === 0 ? (
                                <div className="py-4 text-center text-xs text-neutral-400">Initializing stream...</div>
                            ) : (
                                processedEvents.map((event, idx) => (
                                    <div
                                        key={`${event.stage}-${idx}`}
                                        onClick={() => setSelectedEvent(event)}
                                        className="flex items-center gap-2 hover:bg-neutral-300/30 rounded-lg w-full p-1 transition-colors ease-in-out duration-200 group cursor-pointer"
                                    >
                                        <div className="text-black rounded-md flex w-40 items-center gap-1 p-1.5 bg-neutral-50 border border-neutral-200 shrink-0">
                                            <Terminal size={12} />
                                            <span className="text-xs font-medium truncate">{event.stage}</span>
                                        </div>
                                        <div className="flex-1 min-w-0 h-7 relative">
                                            <div
                                                className={`h-full border transition-all duration-500 ease-out ${statusClasses[event.status]}`}
                                                style={{
                                                    width: `${event.width}%`,
                                                    marginLeft: `${event.startOffset}%`,
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="py-2 px-4 bg-neutral-50/30">
                        {selectedEvent && (
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] uppercase text-neutral-500 font-bold">Event Details</span>
                                <div className="text-black text-xs space-y-2">
                                    <p>
                                        <span className="text-neutral-500">Stage:</span> {selectedEvent.stage}
                                    </p>
                                    <p>
                                        <span className="text-neutral-500">Duration:</span>{' '}
                                        {formatMs((selectedEvent as any).durationMs || 0)}
                                    </p>
                                    <p>
                                        <span className="text-neutral-500">Status:</span> {selectedEvent.status}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="py-2 px-4 grid"></div>
            </div>
        </div>
    );
};
