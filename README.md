# AI Code Review System

A monorepo for automated code review using AI.

## Data Flows

### 1. When a User Installs the Bot to a Repository

```mermaid
sequenceDiagram
    participant User
    participant GitHub
    participant Web as apps/web
    participant WS as services/webhook-service
    participant DB as packages/db
    participant RI as services/repo-indexer

    User->>Web: User initiates GitHub App installation
    Web->>GitHub: Redirect to GitHub OAuth
    GitHub->>Web: OAuth callback with installation token
    Note over Web,GitHub: User selects repositories to install

    GitHub->>WS: Webhook: installation created
    WS->>DB: Create installation record
    DB-->>WS: Installation created

    loop For each repository
        WS->>DB: Upsert repository
    end

    WS->>RI: Add job to repo-index queue
    RI->>GitHub: Fetch repository files
    RI->>RI: Generate embeddings
    RI->>RI: Store in vector database
```

### 2. When a User Raises a Pull Request

```mermaid
sequenceDiagram
    participant User
    participant GitHub
    participant WS as services/webhook-service
    participant DB as packages/db
    participant PP as services/pr-processor
    participant RI as services/repo-indexer
    participant AIR as services/ai-review-worker

    User->>GitHub: Creates/opens PR
    GitHub->>WS: Webhook: pull_request opened

    WS->>DB: Find repository
    DB-->>WS: Repository found
    WS->>PP: Add job to pr-review queue

    PP->>GitHub: Get PR details & diff
    PP->>DB: Create review record (status: pending)
    PP->>RI: Add job to pr-context queue
    PP->>PP: Add job to pr-comment (initial comment)

    PP->>GitHub: Post "processing" comment

    RI->>RI: Fetch similar code from vector store
    RI->>AIR: Add job to pr-ai-review queue

    AIR->>AIR: Generate AI code review
    AIR->>DB: Update review record (status: completed)
    AIR->>PP: Add job to pr-issues queue
    AIR->>PP: Add job to pr-comment (summary)

    PP->>GitHub: Post inline comments for each issue
    PP->>GitHub: Post summary comment
```

## What's inside?

### Apps and Packages

- `apps/web`: a [Next.js](https://nextjs.org/) app
- `apps/server`: a Node.js API server
- `packages/ai`: AI utilities shared across services
- `packages/config`: shared configuration
- `packages/db`: Prisma database client
- `packages/kafka`: Kafka utilities
- `packages/logger`: logging utility shared across services
- `packages/redis`: Redis client
- `packages/types`: shared TypeScript types
- `services/ai-review-worker`: AI review worker service
- `services/pr-processor`: PR processor and GitHub comment service
- `services/repo-indexer`: Repository indexing service
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
