'use client';

import { useMemo, useState } from 'react';
import { type ReviewEvent, useReviewEvents } from '@/lib/use-review-events';

const statusDot: Record<ReviewEvent['status'], string> = {
    pending: 'bg-amber-400',
    success: 'bg-emerald-400',
    error: 'bg-red-400',
};

const barStyle: Record<ReviewEvent['status'], { bar: string; dot: string; label: string }> = {
    pending: {
        bar: 'bg-amber-500/15 border border-amber-500/30',
        dot: 'bg-amber-400',
        label: 'text-amber-400',
    },
    success: {
        bar: 'bg-emerald-500/15 border border-emerald-500/30',
        dot: 'bg-emerald-400',
        label: 'text-emerald-400',
    },
    error: {
        bar: 'bg-red-500/15 border border-red-500/30',
        dot: 'bg-red-400',
        label: 'text-red-400',
    },
};

function formatMs(ms: number): string {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${Math.round(ms)}ms`;
}

function formatTimestamp(ts: string): string {
    return new Date(ts).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function DetailModal({ event, onClose }: { event: ReviewEvent; onClose: () => void }) {
    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-[#111111] border border-[#222] rounded-xl max-w-lg w-full p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                        <div className={`w-2 h-2 rounded-full ${statusDot[event.status]}`} />
                        <h3 className="text-sm font-medium text-white tracking-tight">{event.stage}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-neutral-600 hover:text-neutral-300 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-3">
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-start">
                        <span className="text-[10px] text-neutral-600 uppercase tracking-widest pt-0.5">Type</span>
                        <span className="text-xs text-neutral-300 font-mono">{event.type}</span>
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-start">
                        <span className="text-[10px] text-neutral-600 uppercase tracking-widest pt-0.5">Queue</span>
                        <span className="text-xs text-neutral-300 font-mono">{event.queueName}</span>
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2 items-start">
                        <span className="text-[10px] text-neutral-600 uppercase tracking-widest pt-0.5">Message</span>
                        <span className="text-xs text-neutral-300">{event.message}</span>
                    </div>
                    {event.timestamp && (
                        <div className="grid grid-cols-[80px_1fr] gap-2 items-start">
                            <span className="text-[10px] text-neutral-600 uppercase tracking-widest pt-0.5">Time</span>
                            <span className="text-xs text-neutral-300 font-mono">{formatTimestamp(event.timestamp)}</span>
                        </div>
                    )}
                    {event.details && Object.keys(event.details).length > 0 && (
                        <div className="pt-1">
                            <span className="text-[10px] text-neutral-600 uppercase tracking-widest block mb-1.5">Details</span>
                            <pre className="text-[11px] font-mono text-neutral-400 p-3 bg-[#0a0a0a] rounded-lg border border-[#1e1e1e] overflow-x-auto leading-relaxed">
                                {JSON.stringify(event.details, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


type TimestampedEvent = ReviewEvent & { timestamp: string };

function isTimestamped(e: ReviewEvent): e is TimestampedEvent {
    return typeof e.timestamp === 'string';
}

interface ProcessedEvent extends TimestampedEvent {
    startOffset: number;
    width: number;
    durationMs: number;
}

export function ReviewTimeline({ reviewId }: { reviewId: string }) {
    const { events, isConnected, isLoading } = useReviewEvents({ reviewId, fetchSavedEvents: true });
    const [selectedEvent, setSelectedEvent] = useState<ReviewEvent | null>(null);

    const timestamped = useMemo<TimestampedEvent[]>(() => events.filter(isTimestamped), [events]);

    const processedEvents = useMemo<ProcessedEvent[]>(() => {
        if (timestamped.length === 0) return [];

        const startTime = new Date(timestamped[0].timestamp).getTime();
        const lastTime = new Date(timestamped[timestamped.length - 1].timestamp).getTime();
        const totalDuration = Math.max(lastTime - startTime, 1000);

        return timestamped.map((event, index) => {
            const currentTime = new Date(event.timestamp).getTime();
            const nextTs = timestamped[index + 1]?.timestamp;
            const nextTime = nextTs ? new Date(nextTs).getTime() : currentTime + 500;

            const startOffset = ((currentTime - startTime) / totalDuration) * 100;
            const durationMs = nextTime - currentTime;
            const rawWidth = ((nextTime - currentTime) / totalDuration) * 100;

            return { ...event, startOffset, width: Math.max(rawWidth, 2), durationMs };
        });
    }, [timestamped]);

    const totalMs = useMemo(() => {
        if (timestamped.length < 2) return 0;
        return (
            new Date(timestamped[timestamped.length - 1].timestamp).getTime() -
            new Date(timestamped[0].timestamp).getTime()
        );
    }, [timestamped]);

    if (isLoading) {
        return (
            <div className="py-16 flex flex-col items-center gap-3">
                <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="w-1 h-4 bg-neutral-700 rounded-full animate-pulse"
                            style={{ animationDelay: `${i * 150}ms` }}
                        />
                    ))}
                </div>
                <span className="text-[11px] text-neutral-600 uppercase tracking-widest font-mono">
                    Loading events
                </span>
            </div>
        );
    }

    if (events.length === 0 && !isConnected) {
        return (
            <div className="py-16 flex flex-col items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-neutral-700 animate-pulse" />
                <span className="text-[11px] text-neutral-600 uppercase tracking-widest font-mono">
                    Waiting for events
                </span>
            </div>
        );
    }

    return (
        <>

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                    <div
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            isConnected
                                ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                                : 'bg-neutral-600'
                        }`}
                    />
                    <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest">
                        {isConnected ? 'Live' : 'Disconnected'}&nbsp;&middot;&nbsp;{events.length} events
                    </span>
                </div>
                {totalMs > 0 && (
                    <div>
                        <span className="text-[11px] font-mono text-neutral-600">Total&nbsp;</span>
                        <span className="text-[11px] font-mono text-emerald-400 font-medium">{formatMs(totalMs)}</span>
                    </div>
                )}
            </div>


            <div className="relative">

                {totalMs > 0 && (
                    <div className="flex justify-between text-[10px] text-neutral-700 mb-1.5 font-mono pl-[180px] pr-[68px]">
                        <span>0ms</span>
                        <span>{formatMs(totalMs / 2)}</span>
                        <span>{formatMs(totalMs)}</span>
                    </div>
                )}


                <div className="absolute left-[180px] right-[68px] top-6 bottom-0 flex justify-between pointer-events-none">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="w-px bg-white/[0.04] h-full" />
                    ))}
                </div>


                <div className="relative z-10 divide-y divide-white/[0.03]">
                    {processedEvents.map((event, idx) => {
                        const style = barStyle[event.status];
                        return (
                            <div
                                key={`${event.type}-${idx}`}
                                className="group flex items-center py-0.5 hover:bg-white/[0.025] gap-2 rounded cursor-pointer transition-colors"
                                onClick={() => setSelectedEvent(event)}
                            >

                                <div className="w-[180px] shrink-0 flex items-center gap-2 px-2 overflow-hidden">
                                    <div
                                        className={`w-1.5 h-1.5 shrink-0 rounded-full ${style.dot} ${
                                            event.status === 'pending' ? 'animate-pulse' : ''
                                        }`}
                                    />
                                    <span className="text-[11px] text-neutral-400 group-hover:text-neutral-200 truncate transition-colors font-medium tracking-tight">
                                        {event.stage}
                                    </span>
                                </div>


                                <div className="flex-grow h-8 relative flex items-center">
                                    <div
                                        className={`h-[22px] rounded flex items-center px-2 transition-all duration-300 ${style.bar}`}
                                        style={{
                                            marginLeft: `${event.startOffset}%`,
                                            width: `${event.width}%`,
                                            minWidth: '36px',
                                        }}
                                        />
                                </div>


                                <div className="w-[68px] shrink-0 text-right pr-1">
                                    <span className="text-[10px] font-mono text-neutral-600 group-hover:text-neutral-400 transition-colors">
                                        {formatMs(event.durationMs)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>


            <div className="mt-6 pt-4 border-t border-white/[0.05] flex items-center gap-5 text-[10px] font-mono">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-neutral-600 uppercase tracking-wider">Success</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-neutral-600 uppercase tracking-wider">Pending</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-neutral-600 uppercase tracking-wider">Error</span>
                </div>
                <span className="ml-auto text-neutral-700">click row for details</span>
            </div>

            {selectedEvent && (
                <DetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
            )}
        </>
    );
}

export { DetailModal };
