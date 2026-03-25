import { createPubSub } from '@repo/redis';

const EVENTS_CHANNEL_PREFIX = 'review-events:';

export type ReviewEventType =
    | 'REVIEW_STARTED'
    | 'PR_DETAILS_FETCHED'
    | 'CHECK_RUN_CREATED'
    | 'COMMENT_POSTED'
    | 'REVIEW_RECORD_CREATED'
    | 'CONTEXT_RETRIEVAL_STARTED'
    | 'CONTEXT_RETRIEVED'
    | 'AI_REVIEW_STARTED'
    | 'AI_REVIEW_COMPLETED'
    | 'ISSUES_POSTED'
    | 'SUMMARY_POSTED'
    | 'REVIEW_COMPLETED'
    | 'REVIEW_FAILED'
    | 'CHECK_RUN_UPDATED';

export interface ReviewEventMessage {
    reviewId: string;
    type: ReviewEventType;
    queueName: string;
    stage: string;
    status: 'pending' | 'success' | 'error';
    message: string;
    details?: Record<string, unknown>;
}

export const getReviewChannel = (reviewId: string): string => {
    return `${EVENTS_CHANNEL_PREFIX}${reviewId}`;
};

export const createEventPublisher = () => {
  const publisher = createPubSub();

    return {
        async publish(reviewId: string, event: Omit<ReviewEventMessage, 'reviewId'>): Promise<void> {
            const channel = getReviewChannel(reviewId);
            const fullEvent: ReviewEventMessage = {
                ...event,
                reviewId,
            };
            await publisher.publish(channel, JSON.stringify(fullEvent));
        },

        async publishStage(
            reviewId: string,
            type: ReviewEventType,
            queueName: string,
            stage: string,
            status: 'pending' | 'success' | 'error',
            message: string,
            details?: Record<string, unknown>,
        ): Promise<void> {
            await this.publish(reviewId, {
                type,
                queueName,
                stage,
                status,
                message,
                details,
            });
        },

        async close(): Promise<void> {
            await publisher.quit();
        },
    };
};

export type EventPublisher = ReturnType<typeof createEventPublisher>;
