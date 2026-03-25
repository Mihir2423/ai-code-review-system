import type { ReviewEvent } from '@/lib/use-review-events';

export const statusClasses: Record<ReviewEvent['status'], string> = {
    success: 'border-green-500 bg-green-500/50',
    pending: 'border-yellow-500 bg-yellow-500/50',
    error: 'border-red-500 bg-red-500/50',
};
