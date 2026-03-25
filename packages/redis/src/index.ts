import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
const useTLS = REDIS_URL?.startsWith('rediss://');
const redisOptions = { ...(useTLS ? { tls: { rejectUnauthorized: false } } : {}), maxRetriesPerRequest: null };

export const redis = REDIS_URL
    ? new Redis(REDIS_URL, redisOptions)
    : new Redis({ host: 'localhost', port: 6379, maxRetriesPerRequest: null });

export const createPubSub = (): Redis => {
    const connectionUrl = REDIS_URL || 'redis://localhost:6379';
    console.log('Creating Redis connection with:', connectionUrl);
    return new Redis(connectionUrl, redisOptions);
};

export type { Redis };
