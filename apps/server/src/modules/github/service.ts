import prisma from '@repo/db';
import { redis } from '@repo/redis';
import type { GitHubStats } from '@repo/types';
import { Octokit } from 'octokit';

const STATS_CACHE_TTL = 30 * 60;

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
