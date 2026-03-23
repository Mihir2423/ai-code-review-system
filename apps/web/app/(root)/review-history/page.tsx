'use client';

import { useReviewHistory } from '@/lib/review';
import { Review } from './_components/review';

const ReviewHistoryPage = () => {
  const { data: reviews, isLoading } = useReviewHistory();

    return (
        <div className="min-h-screen bg-[#121212] text-neutral-300 selection:bg-orange-500/30">
            <div className="mx-auto px-6 py-6">
                <header className="mb-16">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-neutral-800 bg-neutral-900/50 mb-6">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                            Review Archive
                        </span>
                    </div>
                    <h1 className="text-4xl font-medium tracking-tight text-white mb-4">Review History</h1>
                    <p className="text-neutral-500 font-mono text-xs tracking-tight uppercase opacity-60">
                        List of all your PR on your Production Environment
                    </p>
                </header>

                {isLoading ? (
                    <div className="py-20 text-center font-mono text-xs text-neutral-600 tracking-[0.2em] animate-pulse">
                        INITIALIZING_RECORDS...
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-6">
                        {reviews?.map((review) => (
                          <Review review={review} key={review.id} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewHistoryPage;
