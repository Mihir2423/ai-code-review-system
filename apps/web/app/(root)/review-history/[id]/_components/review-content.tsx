'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDown } from 'lucide-react';
import { lazy, memo, Suspense, useCallback, useMemo, useState } from 'react';
import { fetchReviewById } from '@/lib/review';
import type { ReviewEvent } from '@/lib/use-review-events';
import { useReviewEvents } from '@/lib/use-review-events';
import { EventList } from './event-list';
import { ReviewHeader } from './review-header';

const ReviewInfo = lazy(() => import('./review-info').then((mod) => ({ default: mod.ReviewInfo })));
const EventDetails = lazy(() => import('./event-details').then((mod) => ({ default: mod.EventDetails })));

type Props = {
    id: string;
};

const MemoizedReviewHeader = memo(ReviewHeader);
const MemoizedReviewInfo = memo(ReviewInfo);
const MemoizedEventList = memo(EventList);
const MemoizedEventDetails = memo(EventDetails);

export const ReviewContent = ({ id }: Props) => {
    const { events, isLoading } = useReviewEvents({
        reviewId: id,
        fetchSavedEvents: true,
    });

    const { data: review } = useQuery({
        queryKey: ['review', id],
        queryFn: () => fetchReviewById(id),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    });

    const [selectedEvent, setSelectedEvent] = useState<ReviewEvent | null>(null);
    const [now] = useState(() => Date.now());

    const timestamped = useMemo(
        () => events.filter((e): e is ReviewEvent & { timestamp: string } => typeof e.timestamp === 'string'),
        [events],
    );

    const { totalMs, queuedAt, startedAt } = useMemo(() => {
        if (timestamped.length < 2) {
            return { totalMs: 0, queuedAt: null, startedAt: null };
        }

        const firstTimestamp = timestamped[0].timestamp;
        const lastTimestamp = timestamped[timestamped.length - 1].timestamp;

        return {
            totalMs: new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime(),
            queuedAt: firstTimestamp,
            startedAt: firstTimestamp,
        };
    }, [timestamped]);

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

    const handleEventSelect = useCallback((event: ReviewEvent) => {
        setSelectedEvent(event);
    }, []);

    return (
        <div className="h-full text-neutral-300 selection:bg-orange-500/30 p-6 font-mono">
            <div className="mx-auto max-w-7xl flex flex-col border rounded-lg border-neutral-200">
                <MemoizedReviewHeader
                    isLoading={isLoading}
                    repositoryFullName={review?.repository?.fullName}
                    prUrl={review?.prUrl}
                />

                <div className="grid grid-cols-2 border-b border-neutral-200">
                    <div className="border-r border-neutral-200 flex flex-col">
                        <div className="h-[141px] border-b border-neutral-200 flex flex-col justify-between">
                            <MemoizedReviewInfo
                                prNumber={review?.prNumber ?? id}
                                repositoryFullName={review?.repository?.fullName ?? 'Unknown'}
                                totalMs={totalMs}
                                queuedAt={queuedAt}
                                startedAt={startedAt}
                                prUrl={review?.prUrl}
                            />

                            <div className="px-2.5 py-2">
                                <button className="flex items-center gap-2 px-1.5 cursor-pointer w-fit text-black">
                                    <span className="text-black text-sm font-medium">Trace</span>
                                    <ArrowDown size={14} />
                                </button>
                            </div>
                        </div>

                        <Suspense fallback={<EventListSkeleton />}>
                            <MemoizedEventList
                                events={processedEvents}
                                isLoading={isLoading}
                                onEventSelect={handleEventSelect}
                            />
                        </Suspense>
                    </div>

                    <Suspense fallback={<EventDetailsSkeleton />}>
                        <MemoizedEventDetails selectedEvent={selectedEvent} />
                    </Suspense>
                </div>
                <div className="px-4 py-2"></div>
            </div>
        </div>
    );
};

const EventListSkeleton = () => (
    <div className="flex flex-col gap-2 py-2 px-3">
        {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-neutral-100 rounded animate-pulse" />
        ))}
    </div>
);

const EventDetailsSkeleton = () => (
    <div className="py-2 px-4 bg-neutral-50/30">
        <div className="space-y-2">
            <div className="h-4 bg-neutral-200 rounded w-24 animate-pulse" />
            <div className="h-8 bg-neutral-200 rounded w-full animate-pulse" />
            <div className="h-8 bg-neutral-200 rounded w-full animate-pulse" />
        </div>
    </div>
);
