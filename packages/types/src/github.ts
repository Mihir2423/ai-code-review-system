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

export interface GitHubStats {
    repos: RepoStats;
    commits: CommitStats;
}
