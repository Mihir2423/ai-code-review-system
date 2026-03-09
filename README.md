# AI Code Review System

A monorepo for automated code review using AI.

## What's inside?

### Apps and Packages

- `apps/web`: a [Next.js](https://nextjs.org/) app
- `packages/logger`: a logging utility shared across services
- `services/ai-review-worker`: AI review worker service
- `services/github-comment-service`: GitHub comment service
- `services/pr-processor`: PR processor service
- `services/webhook-service`: Webhook service

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting
- [Turborepo](https://turbo.build/) for build orchestration

### Build

To build all apps and packages, run the following command:

```sh
pnpm build
```

### Develop

To develop all apps and packages, run the following command:

```sh
pnpm dev
```

You can develop a specific package by using a filter:

```sh
pnpm dev --filter=web
pnpm dev --filter=ai-review-worker
```

```
flowchart TD

    %% ---------- Frontend ----------
    A[User] --> B[apps/web Next.js Frontend]

    B --> C[Connect GitHub Repository]

    %% ---------- Repo Setup ----------
    C --> D[services/repo-indexer]

    D --> E[Clone Repository]
    E --> F[Chunk Code Files]
    F --> G[Generate Embeddings using packages/ai]
    G --> H[Pinecone Vector Database]

    C --> I[Attach GitHub Webhook]
    I --> J[GitHub Repository]

    %% ---------- PR Event ----------
    J --> K[User Creates Pull Request]

    K --> L[services/webhook-service]

    L --> M[Kafka Topic: pr-events]

    %% ---------- PR Processing ----------
    M --> N[services/pr-processor]

    N --> O[Fetch PR Diff from GitHub API]

    O --> P[Kafka Topic: review-jobs]

    %% ---------- AI Review ----------
    P --> Q[services/ai-review-worker]

    Q --> R[Retrieve Context from Pinecone]

    R --> S[Gemini Review via packages/ai]

    S --> T[Kafka Topic: review-results]

    %% ---------- Comment Posting ----------
    T --> U[services/github-comment-service]

    U --> V[Post Comment on GitHub PR]


    %% ---------- Shared Packages ----------
    subgraph Shared_Packages
        W[packages/ai]
        X[packages/kafka]
        Y[packages/redis]
        Z[packages/logger]
        AA[packages/config]
        AB[packages/types]
    end

    %% ---------- Infra ----------
    subgraph Infrastructure
        AC[Kafka]
        AD[Redis]
        AE[Pinecone]
    end
```
