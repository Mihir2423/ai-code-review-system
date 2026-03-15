import { type JobsOptions, type Processor, Queue, Worker } from 'bullmq';

const createConnection = () => {
    const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
    const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

    return {
        host: REDIS_HOST,
        port: REDIS_PORT,
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
