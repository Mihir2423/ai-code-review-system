import prisma from '@repo/db';
import { redis } from '@repo/redis';
import type { GitHubRepository, GitHubStats } from '@repo/types';
import { Octokit } from 'octokit';

const STATS_CACHE_TTL = 30 * 60;
const REPOS_CACHE_TTL = 15 * 60;

export async function getGitHubStats(userId: string): Promise<GitHubStats> {
    const cacheKey = `github:stats:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    const account = await prisma.account.findFirst({
        where: { userId, providerId: 'github' },
        select: { accessToken: true },
    });

    if (!account?.accessToken) {
        throw new Error('GitHub account not connected');
    }

    const octokit = new Octokit({ auth: account.accessToken });

    const query = `
      query ($login: String!) {
        user(login: $login) {
          repositories(first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
            totalCount
            nodes {
              createdAt
            }
          }
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  contributionCount
                  date
                }
              }
            }
          }
        }
      }
    `;

    const { viewer } = await octokit.graphql<{ viewer: { login: string } }>(`{ viewer { login } }`);

    const data = await octokit.graphql<{
        user: {
            repositories: { totalCount: number; nodes: { createdAt: string }[] };
            contributionsCollection: {
                contributionCalendar: {
                    totalContributions: number;
                    weeks: { contributionDays: { contributionCount: number; date: string }[] }[];
                };
            };
        };
    }>(query, { login: viewer.login });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const repos = data.user.repositories.nodes;
    const totalRepos = data.user.repositories.totalCount;
    const reposThisMonth = repos.filter((r) => new Date(r.createdAt) >= startOfMonth).length;

    const repoTrendMap: Record<string, number> = {};
    const commitTrendMap: Record<string, number> = {};

    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toISOString().slice(0, 7);
        repoTrendMap[key] = 0;
        commitTrendMap[key] = 0;
    }

    repos.forEach((repo) => {
        const key = repo.createdAt.slice(0, 7);

        if (key in repoTrendMap) {
            repoTrendMap[key] = (repoTrendMap[key] ?? 0) + 1;
        }
    });

    const allDays = data.user.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays);

    let commitsThisWeek = 0;
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    allDays.forEach((day) => {
        const date = new Date(day.date);
        const monthKey = day.date.slice(0, 7);

        if (monthKey in commitTrendMap) {
            commitTrendMap[monthKey] = (commitTrendMap[monthKey] ?? 0) + day.contributionCount;
        }

        if (date >= monday) {
            commitsThisWeek += day.contributionCount;
        }
    });

    const stats: GitHubStats = {
        repos: {
            total: totalRepos,
            thisMonth: reposThisMonth,
            trend: Object.entries(repoTrendMap)
                .map(([month, count]) => ({ month, count }))
                .sort((a, b) => a.month.localeCompare(b.month)),
        },
        commits: {
            total: data.user.contributionsCollection.contributionCalendar.totalContributions,
            thisWeek: commitsThisWeek,
            trend: Object.entries(commitTrendMap)
                .map(([month, count]) => ({ month, count }))
                .sort((a, b) => a.month.localeCompare(b.month)),
        },
    };

    await redis.setex(cacheKey, STATS_CACHE_TTL, JSON.stringify(stats));

    return stats;
}

export interface PaginatedRepositories {
    repositories: GitHubRepository[];
    pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
    };
}

export async function getAllRepositories(userId: string, cursor?: string): Promise<PaginatedRepositories> {
    const cacheKey = cursor ? `github:repositories:${userId}:${cursor}` : `github:repositories:${userId}`;

    if (!cursor) {
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
    }

    const account = await prisma.account.findFirst({
        where: { userId, providerId: 'github' },
        select: { accessToken: true },
    });

    if (!account?.accessToken) {
        throw new Error('GitHub account not connected');
    }

    const octokit = new Octokit({ auth: account.accessToken });

    const { viewer } = await octokit.graphql<{ viewer: { login: string } }>(`{ viewer { login } }`);

    const data = await octokit.graphql<{
        user: {
            repositories: {
                nodes: {
                    id: string;
                    name: string;
                    nameWithOwner: string;
                    description: string | null;
                    isPrivate: boolean;
                    url: string;
                    primaryLanguage: { name: string } | null;
                    stargazerCount: number;
                    forkCount: number;
                    issues: { totalCount: number };
                    watchers: { totalCount: number };
                    defaultBranchRef: { name: string } | null;
                    createdAt: string;
                    updatedAt: string;
                    pushedAt: string | null;
                }[];
                pageInfo: { hasNextPage: boolean; endCursor: string };
            };
        };
    }>(
        `query ($login: String!, $cursor: String) {
            user(login: $login) {
                repositories(first: 100, orderBy: {field: PUSHED_AT, direction: DESC}, after: $cursor) {
                    nodes {
                        id
                        name
                        nameWithOwner
                        description
                        isPrivate
                        url
                        primaryLanguage { name }
                        stargazerCount
                        forkCount
                        issues { totalCount }
                        watchers { totalCount }
                        defaultBranchRef { name }
                        createdAt
                        updatedAt
                        pushedAt
                    }
                    pageInfo { hasNextPage endCursor }
                }
            }
        }`,
        { login: viewer.login },
    );

    const repositories: GitHubRepository[] = data.user.repositories.nodes.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.nameWithOwner,
        description: repo.description,
        private: repo.isPrivate,
        htmlUrl: repo.url,
        language: repo.primaryLanguage?.name ?? null,
        stargazersCount: repo.stargazerCount,
        forksCount: repo.forkCount,
        openIssuesCount: repo.issues.totalCount,
        watchersCount: repo.watchers.totalCount,
        defaultBranch: repo.defaultBranchRef?.name ?? 'main',
        createdAt: repo.createdAt,
        updatedAt: repo.updatedAt,
        pushedAt: repo.pushedAt,
    }));

    await redis.setex(
        cacheKey,
        REPOS_CACHE_TTL,
        JSON.stringify({
            repositories,
            pageInfo: {
                hasNextPage: data.user.repositories.pageInfo.hasNextPage,
                endCursor: data.user.repositories.pageInfo.endCursor,
            },
        }),
    );

    return {
        repositories,
        pageInfo: {
            hasNextPage: data.user.repositories.pageInfo.hasNextPage,
            endCursor: data.user.repositories.pageInfo.endCursor,
        },
    };
}
