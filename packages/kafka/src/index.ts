import { Kafka, logLevel, Partitioners } from 'kafkajs';

export const kafka = new Kafka({
    clientId: 'ai-code-review-system',
    brokers: ['localhost:9092'],
    logLevel: logLevel.WARN,
});

export const producer = kafka.producer({ createPartitioner: Partitioners.LegacyPartitioner });
export const consumer = kafka.consumer({ groupId: 'review-workers' });
export const admin = kafka.admin();

export async function ensureTopics(topics: string[]): Promise<void> {
    await admin.connect();
    const existingTopics = await admin.listTopics();
    const missingTopics = topics.filter((t) => !existingTopics.includes(t));

    if (missingTopics.length > 0) {
        await admin.createTopics({
            topics: missingTopics.map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })),
        });
    }
    await admin.disconnect();
}

export async function sendMessage(topic: string, message: object): Promise<void> {
    try {
        await producer.connect();
    } catch (error) {
        console.error('Failed to connect producer:', error);
        throw new Error('Failed to connect to Kafka');
    }

    try {
        await producer.send({
            topic,
            messages: [{ value: JSON.stringify(message) }],
        });
    } catch (error) {
        console.error('Failed to send message:', error);
        throw new Error('Failed to send message to Kafka');
    }
}
