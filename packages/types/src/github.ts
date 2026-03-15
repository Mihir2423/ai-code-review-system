export interface RepoStats {
    total: number;
    thisMonth: number;
    trend: {
        month: string;
        count: number;
    }[];
}

export interface CommitStats {
    total: number;
    thisWeek: number;
    trend: {
        month: string;
        count: number;
    }[];
}

export interface GitHubRepository {
    id: string;
    name: string;
    fullName: string;
    description: string | null;
    private: boolean;
    htmlUrl: string;
    language: string | null;
    stargazersCount: number;
    forksCount: number;
    openIssuesCount: number;
    watchersCount: number;
    defaultBranch: string;
    createdAt: string;
    updatedAt: string;
    pushedAt: string | null;
}

export interface GitHubStats {
    repos: RepoStats;
    commits: CommitStats;
}

export interface IssueWithMetadata {
    file: string;
    line: number;
    severity: string;
    description: string;
    commentBody: string;
    diff: {
        oldCode: string;
        newCode: string;
    };
}
