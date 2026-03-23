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


type Status = 'success' | 'pending' | 'error';
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
            const rawWidth = (durationMs / totalDuration) * 100;
            return { ...event, startOffset, width: Math.max(rawWidth, 1.5), durationMs };
        });
    }, [timestamped]);

    const totalMs = useMemo(() => {
        if (timestamped.length < 2) return 0;
        return new Date(timestamped[timestamped.length - 1].timestamp).getTime() - new Date(timestamped[0].timestamp).getTime();
    }, [timestamped]);

    if (isLoading) {
        return (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
                <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="w-1 h-1 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                    ))}
                </div>
                <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-[0.2em]">Initialising</span>
            </div>
        );
    }

    return (
        <div className="w-full p-8 rounded-xl bg-[#0a0a0a] border border-white/[0.05] shadow-2xl relative overflow-hidden">

            <div className="absolute inset-0 opacity-3 pointer-events-none"
                 style={{ backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`, width: '40px', height: '40px' }}
            />

            <div className="relative z-10">

                <div className="flex items-center gap-2 justify-between mb-10 pb-6 border-b border-white/[0.05]">
                    <div className="flex items-center gap-4">
                        <div className="relative flex items-center justify-center">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-neutral-700'}`} />
                            {isConnected && <div className="absolute w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-[0.2em] mb-1">Status</span>
                            <span className="text-xs font-mono text-neutral-200">{isConnected ? 'LIVE_STREAMING' : 'DISCONNECTED'}</span>
                        </div>
                    </div>

                    <div className="flex gap-12">
                        <div className="text-right">
                            <span className="block text-[10px] font-mono text-neutral-500 uppercase tracking-[0.2em] mb-1">Total Time</span>
                            <span className="text-sm font-mono text-emerald-500 font-medium tracking-tight">{formatMs(totalMs)}</span>
                        </div>
                        <div className="text-right">
                            <span className="block text-[10px] font-mono text-neutral-500 uppercase tracking-[0.2em] mb-1">Events</span>
                            <span className="text-sm font-mono text-neutral-200 tracking-tight">{events.length}</span>
                        </div>
                    </div>
                </div>


                {totalMs > 0 && (
                    <div className="flex justify-between text-[10px] text-neutral-600 mb-4 font-mono pl-[200px] pr-[80px] uppercase tracking-widest opacity-50">
                        <span>0ms</span>
                        <span>{formatMs(totalMs / 2)}</span>
                        <span>{formatMs(totalMs)}</span>
                    </div>
                )}


                <div className="relative border-t border-white/3">

                    <div className="absolute left-[200px] right-[80px] top-0 bottom-0 flex justify-between pointer-events-none">
                        <div className="w-px bg-white/3 h-full" />
                        <div className="w-px bg-white/3 h-full" />
                        <div className="w-px bg-white/3 h-full" />
                    </div>

                    <div className="divide-y divide-white/3">
                        {processedEvents.map((event, idx) => {
                            const style = barStyle[event.status];
                            return (
                                <div
                                    key={`${event.type}-${idx}`}
                                    className="group flex gap-2 items-center py-2 hover:bg-white/2 transition-all cursor-pointer"
                                    onClick={() => setSelectedEvent(event)}
                                >

                                    <div className="w-[200px] shrink-0 flex items-center gap-3 px-4">
                                        <div className={`w-1 h-1 rounded-full ${style.dot}`} />
                                        <span className="text-[11px] font-mono text-neutral-400 group-hover:text-white transition-colors uppercase tracking-wider truncate">
                                            {event.stage}
                                        </span>
                                    </div>


                                    <div className="grow h-6 relative flex items-center">
                                        <div
                                            className={`h-full rounded-sm transition-all duration-500 ease-out ${style.bar}`}
                                            style={{
                                                marginLeft: `${event.startOffset}%`,
                                                width: `${event.width}%`,
                                                minWidth: '4px',
                                            }}
                                        />
                                    </div>


                                    <div className="w-[80px] shrink-0 text-right pr-4">
                                        <span className="text-[10px] font-mono text-neutral-500 group-hover:text-neutral-300">
                                            {formatMs(event.durationMs)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>


                <div className="mt-12 pt-6 border-t border-white/[0.05] flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        {(['success', 'pending', 'error'] as Status[]).map((status) => (
                            <div key={status} className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${barStyle[status].dot} ${status === 'pending' ? 'animate-pulse' : ''}`} />
                                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-[0.2em]">{status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {selectedEvent && (
                <DetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
            )}
        </div>
    );
}

export { DetailModal };
