import { Queue, Worker } from 'bullmq';
const createConnection = () => {
    const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
    const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
    return {
        host: REDIS_HOST,
        port: REDIS_PORT,
    };
};
export const createQueue = (name) => {
    return new Queue(name, {
        connection: createConnection(),
        defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: false,
        },
    });
};
export const createWorker = (name, processor, options) => {
    return new Worker(name, processor, {
        connection: createConnection(),
        concurrency: options?.concurrency || 5,
    });
};
export const addJob = async (queue, name, data, options) => {
    return queue.add(name, data, options);
};
export const closeQueue = async (queue) => {
    await queue.close();
};
export const closeWorker = async (worker) => {
    await worker.close();
};
export { Queue, Worker };
//# sourceMappingURL=index.js.map