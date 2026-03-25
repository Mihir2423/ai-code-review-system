'use client';

import { memo } from 'react';
import type { ReviewEvent } from '@/lib/use-review-events';
import { formatMs } from '@/lib/utils';

type EventDetailsProps = {
    selectedEvent: ReviewEvent | null;
};

export const EventDetails = memo(({ selectedEvent }: EventDetailsProps) => {
    if (!selectedEvent) {
        return (
            <div className="py-2 px-4 bg-neutral-50/30">
                <div className="flex items-center justify-center h-full min-h-50">
                    <span className="text-xs text-neutral-400">Select an event to view details</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            <div className="border-b border-neutral-200 flex flex-col justify-between h-[141px]">
                <div className="flex flex-col">
                    <div className="px-4 py-2 border-b border-neutral-200">
                        <p className="text-sm font-medium text-black">{selectedEvent.stage}</p>
                    </div>
                    <div className="flex flex-wrap py-2 px-4 gap-y-2 gap-x-6 pb-2">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-neutral-600">Duration</span>
                            <span className="text-black text-sm font-medium">
                                {formatMs(selectedEvent.durationMs || 0)}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-neutral-600">Status</span>
                            <span className="text-black text-sm font-medium capitalize">{selectedEvent.status}</span>
                        </div>
                    </div>
                </div>
                <div className="px-4 py-2">
                    <span className="text-black text-sm font-medium">Output</span>
                </div>
            </div>
            <div className="max-h-100 flex-1 min-h-0 bg-neutral-100 overflow-auto">
                <div className="flex font-mono text-xs leading-5 py-4 px-4">
                    <div className="flex flex-col text-neutral-400 text-right pr-4 select-none border-r border-neutral-300/50 shrink-0 min-w-[2rem]">
                        {(selectedEvent.details ? JSON.stringify(selectedEvent.details, null, 2) : 'null')
                            .split('\n')
                            .map((_, i) => (
                                <span key={i} className="tabular-nums">
                                    {i + 1}
                                </span>
                            ))}
                    </div>

                    <pre className="pl-4 text-black overflow-x-auto flex-1">
                        {selectedEvent.details ? JSON.stringify(selectedEvent.details, null, 2) : 'null'}
                    </pre>
                </div>
            </div>
        </div>
    );
});

EventDetails.displayName = 'EventDetails';
