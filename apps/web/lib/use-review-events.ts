'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authClient } from './auth-client';
import { fetchReviewEvents, type ReviewEventItem } from './review';

export interface ReviewEvent {
    reviewId: string;
    type: string;
    queueName: string;
    stage: string;
    status: 'pending' | 'success' | 'error';
    message: string;
    details?: Record<string, unknown>;
    timestamp?: string;
}

const STREAMING_URL = process.env.NEXT_PUBLIC_STREAMING_URL || 'http://localhost:5002';

interface UseReviewEventsOptions {
    reviewId: string;
    onEvent?: (event: ReviewEvent) => void;
    onError?: (error: Event) => void;
    onConnect?: () => void;
    fetchSavedEvents?: boolean;
}

export function useReviewEvents({
    reviewId,
    onEvent,
    onError,
    onConnect,
    fetchSavedEvents = false,
}: UseReviewEventsOptions) {
    const [events, setEvents] = useState<ReviewEvent[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(fetchSavedEvents);
    const [error, setError] = useState<string | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const savedEventIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!fetchSavedEvents || !reviewId) {
            setIsLoading(false);
            return;
        }

        const loadSavedEvents = async () => {
            try {
                const savedEvents = await fetchReviewEvents(reviewId);
                savedEventIdsRef.current = new Set(savedEvents.map((e: ReviewEventItem) => e.id));

                const mappedEvents: ReviewEvent[] = savedEvents.map((e: ReviewEventItem) => ({
                    reviewId: e.reviewId,
                    type: e.type,
                    queueName: e.queueName || '',
                    stage: e.stage || '',
                    status: e.status as 'pending' | 'success' | 'error',
                    message: e.message,
                    details: e.details ? JSON.parse(e.details) : undefined,
                    timestamp: new Date(e.createdAt).toISOString(),
                }));

                setEvents(mappedEvents);
                mappedEvents.forEach((e) => onEvent?.(e));
            } catch (err) {
                console.error('Failed to fetch saved events:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadSavedEvents();
    }, [fetchSavedEvents, reviewId, onEvent]);

    const connect = useCallback(async () => {
        if (!reviewId) return;

        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const { data: session } = await authClient.getSession();
        const token = session?.session?.token;
        const url = token
            ? `${STREAMING_URL}/stream/${reviewId}?token=${encodeURIComponent(token)}`
            : `${STREAMING_URL}/stream/${reviewId}`;

        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            setIsConnected(true);
            setError(null);
            onConnect?.();
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'connected') {
                    return;
                }

                const reviewEvent: ReviewEvent = {
                    ...data,
                    timestamp: new Date().toISOString(),
                };

                setEvents((prev) => [...prev, reviewEvent]);
                onEvent?.(reviewEvent);
            } catch {
                console.error('Failed to parse SSE event');
            }
        };

        eventSource.onerror = (err) => {
            setIsConnected(false);
            setError('Connection lost');
            onError?.(err);

            eventSource.close();
            eventSourceRef.current = null;

            reconnectTimeoutRef.current = setTimeout(() => {
                connect();
            }, 3000);
        };
    }, [reviewId, onEvent, onError, onConnect]);

    useEffect(() => {
        connect();

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [connect]);

    return {
        events,
        isConnected,
        isLoading,
        error,
        clearEvents: () => setEvents([]),
    };
}
