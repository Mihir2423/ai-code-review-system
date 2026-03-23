'use client';

import { useState } from 'react';
import type { ReviewEvent } from '@/lib/use-review-events';
import { DetailModal, ReviewTimeline } from './review-timeline';

type Props = {
    id: string;
};

export const ReviewContent = ({ id }: Props) => {
    const [selectedEvent, setSelectedEvent] = useState<ReviewEvent | null>(null);

    return (
        <div className="min-h-screen bg-[#121212] text-neutral-300 selection:bg-orange-500/30">
            <div className="mx-auto px-6 py-6">
                <header className="mb-6">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-neutral-800 bg-neutral-900/50 mb-6">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                            Review Timeline
                        </span>
                    </div>
                    <h1 className="text-4xl font-medium tracking-tight text-white mb-4">PR Review #{id.slice(0, 8)}</h1>
                    <p className="text-neutral-500 font-mono text-xs tracking-tight uppercase opacity-60">
                        Real-time progress of your AI Code Review
                    </p>
                </header>

                <div className="">
                    <ReviewTimeline reviewId={id} />
                </div>
            </div>

            {selectedEvent && <DetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
        </div>
    );
};
