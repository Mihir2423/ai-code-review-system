'use client';

interface StatCardSkeletonProps {
    index: number;
}

export function StatCardSkeleton({ index }: StatCardSkeletonProps) {
    return (
        <div
            className="relative overflow-hidden flex flex-col gap-3.5 justify-between rounded-md border border-neutral-800 bg-neutral-900 p-5 animate-pulse"
            style={{ minWidth: 0 }}
        >
            <div className="absolute left-0 right-0 top-0 h-0.5 bg-neutral-800" />
            <div className="flex flex-col gap-3.5">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <div className="h-3 w-12 bg-neutral-800 rounded" />
                        <div className="h-4 w-32 bg-neutral-800 rounded" />
                    </div>
                    <div className="flex items-center gap-1.5 rounded border border-neutral-700 bg-neutral-800 px-2 py-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-neutral-700" />
                        <div className="h-3 w-8 bg-neutral-800 rounded" />
                    </div>
                </div>

                <div className="flex justify-between items-end">
                    <div>
                        <div className="h-10 w-24 bg-neutral-800 rounded" />
                        <div className="mt-1.5 h-3 w-16 bg-neutral-800 rounded" />
                    </div>
                    <div className="h-12 w-24 bg-neutral-800 rounded" />
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-800 pt-2">
                <div className="flex items-center gap-1.5">
                    <div className="h-3 w-4 bg-neutral-800 rounded" />
                    <div className="h-3 w-12 bg-neutral-800 rounded" />
                </div>
                <div className="h-3 w-16 bg-neutral-800 rounded" />
            </div>
        </div>
    );
}
