'use client';

import { Terminal } from 'lucide-react';
import { memo } from 'react';
import type { ReviewEvent } from '@/lib/use-review-events';
import { statusClasses } from './constants';

type ProcessedEvent = ReviewEvent & {
    startOffset: number;
    width: number;
    durationMs: number;
};

type EventListProps = {
    events: ProcessedEvent[];
    isLoading: boolean;
    onEventSelect: (event: ReviewEvent) => void;
};

export const EventList = memo(({ events, isLoading, onEventSelect }: EventListProps) => {
    if (isLoading && events.length === 0) {
        return <div className="py-4 text-center text-xs text-neutral-400">Initializing stream...</div>;
    }

    return (
        <div className="flex flex-col gap-2 py-2 px-3 max-h-100 overflow-y-auto">
            {events.map((event, idx) => (
                <div
                    key={`${event.stage}-${idx}`}
                    onClick={() => onEventSelect(event)}
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
                        />
                    </div>
                </div>
            ))}
        </div>
    );
});

EventList.displayName = 'EventList';
