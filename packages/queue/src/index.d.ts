import { type JobsOptions, type Processor, Queue, Worker } from 'bullmq';
export declare const createQueue: (name: string) => Queue<any, any, string, any, any, string>;
export declare const createWorker: (name: string, processor: Processor, options?: {
    concurrency?: number;
}) => Worker<any, any, string>;
export declare const addJob: (queue: Queue, name: string, data: unknown, options?: JobsOptions) => Promise<import("bullmq").Job<any, any, string>>;
export declare const closeQueue: (queue: Queue) => Promise<void>;
export declare const closeWorker: (worker: Worker) => Promise<void>;
export { Queue, Worker };
//# sourceMappingURL=index.d.ts.map