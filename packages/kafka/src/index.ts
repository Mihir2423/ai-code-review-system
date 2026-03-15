import { type Admin, type Consumer, Kafka, logLevel, Partitioners, type Producer } from 'kafkajs';

const BROKERS = ['localhost:9092'];
const CLIENT_ID = 'ai-code-review-system';
const CONNECT_TIMEOUT = 30000;
const REQUEST_TIMEOUT = 30000;

class KafkaManager {
    private _kafka: Kafka | null = null;
    private _producer: Producer | null = null;
    private _admin: Admin | null = null;
    private _producerConnected = false;
    private _adminConnected = false;
    private initializationPromise: Promise<void> | null = null;

    get kafka(): Kafka {
        if (!this._kafka) {
            this._kafka = new Kafka({
                clientId: CLIENT_ID,
                brokers: BROKERS,
                logLevel: logLevel.WARN,
                connectionTimeout: CONNECT_TIMEOUT,
                requestTimeout: REQUEST_TIMEOUT,
                retry: {
                    initialRetryTime: 100,
                    retries: 20,
                    factor: 0.2,
                    multiplier: 2,
                    maxRetryTime: 30000,
                },
            });
        }
        return this._kafka;
    }

    async getProducer(): Promise<Producer> {
        if (this._producer && this._producerConnected) {
            return this._producer;
        }

        if (!this.initializationPromise) {
            this.initializationPromise = this.initialize();
        }

        await this.initializationPromise;
        return this._producer!;
    }

    async getAdmin(): Promise<Admin> {
        if (this._admin && this._adminConnected) {
            return this._admin;
        }

        if (!this.initializationPromise) {
            this.initializationPromise = this.initialize();
        }

        await this.initializationPromise;
        return this._admin!;
    }

    private async initialize(): Promise<void> {
        this._producer = this.kafka.producer({
            createPartitioner: Partitioners.LegacyPartitioner,
            transactionTimeout: 30000,
            allowAutoTopicCreation: true,
        });

        this._admin = this.kafka.admin();

        try {
            await this._producer.connect();
            this._producerConnected = true;
            console.log('[Kafka] Producer connected');
        } catch (error) {
            console.error('[Kafka] Failed to connect producer:', error);
            throw error;
        }

        try {
            await this._admin.connect();
            this._adminConnected = true;
            console.log('[Kafka] Admin connected');
        } catch (error) {
            console.error('[Kafka] Failed to connect admin:', error);
            throw error;
        }
    }

    consumer(config?: { groupId: string; sessionTimeout?: number; heartbeatInterval?: number }): Consumer {
        return this.kafka.consumer({
            groupId: config?.groupId || 'default-group',
            sessionTimeout: config?.sessionTimeout || 300000,
            heartbeatInterval: config?.heartbeatInterval || 30000,
            maxWaitTimeInMs: 5000,
            maxBytes: 1048576,
        });
    }

    async ensureTopics(topics: string[]): Promise<void> {
        const admin = await this.getAdmin();
        const DESIRED_PARTITIONS = 4;

        try {
            const existingTopics = await admin.listTopics();
            const missingTopics = topics.filter((t) => !existingTopics.includes(t));

            if (missingTopics.length > 0) {
                console.log(`[Kafka] Creating missing topics: ${missingTopics.join(', ')}`);
                await admin.createTopics({
                    topics: missingTopics.map((topic) => ({
                        topic,
                        numPartitions: DESIRED_PARTITIONS,
                        replicationFactor: 1,
                    })),
                });
                console.log(`[Kafka] Created topics: ${missingTopics.join(', ')}`);
            }

            const existingTopicMetadatas = await admin.fetchTopicMetadata();
            for (const topic of topics) {
                const topicMetadata = existingTopicMetadatas.topics.find((t) => t.name === topic);
                if (topicMetadata && topicMetadata.partitions.length < DESIRED_PARTITIONS) {
                    console.log(`[Kafka] Altering topic ${topic} to have ${DESIRED_PARTITIONS} partitions`);
                    await (admin as any).alterTopicPartitionCount({
                        topic: topic,
                        count: DESIRED_PARTITIONS,
                    });
                    console.log(`[Kafka] Altered topic ${topic}`);
                }
            }
        } catch (error) {
            console.error('[Kafka] Failed to ensure topics:', error);
            throw error;
        }
    }

    async sendMessage(topic: string, message: object): Promise<void> {
        const producer = await this.getProducer();

        try {
            await producer.send({
                topic,
                messages: [{ value: JSON.stringify(message) }],
                acks: 1,
                timeout: 10000,
            });
        } catch (error) {
            console.error(`[Kafka] Failed to send message to topic ${topic}:`, error);
            throw error;
        }
    }

    async sendMessageWithKey(topic: string, message: object, key: string): Promise<void> {
        const producer = await this.getProducer();

        try {
            await producer.send({
                topic,
                messages: [{ key, value: JSON.stringify(message) }],
                acks: 1,
                timeout: 10000,
            });
        } catch (error) {
            console.error(`[Kafka] Failed to send message to topic ${topic}:`, error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (this._producer && this._producerConnected) {
            try {
                await this._producer.disconnect();
                this._producerConnected = false;
            } catch (error) {
                console.error('[Kafka] Error disconnecting producer:', error);
            }
        }

        if (this._admin && this._adminConnected) {
            try {
                await this._admin.disconnect();
                this._adminConnected = false;
            } catch (error) {
                console.error('[Kafka] Error disconnecting admin:', error);
            }
        }
    }
}

const kafkaManager = new KafkaManager();

export const kafka = kafkaManager.kafka;
export const producer = kafkaManager.getProducer();
export const consumer = kafkaManager.consumer.bind(kafkaManager);
export const admin = kafkaManager.getAdmin();
export const ensureTopics = kafkaManager.ensureTopics.bind(kafkaManager);
export const sendMessage = kafkaManager.sendMessage.bind(kafkaManager);
export const sendMessageWithKey = kafkaManager.sendMessageWithKey.bind(kafkaManager);
export { kafkaManager };
