import { type ConnectionOptions, type JobsOptions, type Processor, Queue, Worker } from 'bullmq';

const createConnection = (): ConnectionOptions => {
    const REDIS_URL = process.env.REDIS_URL;

    if (REDIS_URL) {
        return {
            url: REDIS_URL,
            tls: { rejectUnauthorized: false },
            maxRetriesPerRequest: null,
        };
    }

    return {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: null,
    };
};

export const createQueue = (name: string) => {
    return new Queue(name, {
        connection: createConnection(),
        defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: false,
        },
    });
};

export const createWorker = (
    name: string,
    processor: Processor,
    options?: {
        concurrency?: number;
    },
) => {
    return new Worker(name, processor, {
        connection: createConnection(),
        concurrency: options?.concurrency || 5,
    });
};

export const addJob = async (queue: Queue, name: string, data: unknown, options?: JobsOptions) => {
    return queue.add(name, data, options);
};

export const closeQueue = async (queue: Queue) => {
    await queue.close();
};

export const closeWorker = async (worker: Worker) => {
    await worker.close();
};

export { Queue, Worker };

export * from './events.js';
