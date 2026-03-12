import 'dotenv/config';

import { Pinecone } from '@pinecone-database/pinecone';

export const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_SECRET_KEY!,
});

export const pineconeIndex = pinecone.index('review-bot');
