import { Router, type Request, type Response } from "express";
import type { Router as ExpressRouter } from "express";
import { Octokit } from "octokit";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/auth.js";
import prisma from "@repo/db";

const router: ExpressRouter = Router();

router.get("/stats", authMiddleware, async (req: AuthenticatedRequest, res) => {
	try {
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const account = await prisma.account.findFirst({
			where: {
				userId,
				providerId: "github",
			},
			select: {
				accessToken: true,
			},
		});

		if (!account?.accessToken) {
			return res.status(401).json({ error: "GitHub account not connected" });
		}

		const octokit = new Octokit({
			auth: account.accessToken,
		});

		const { data: repos } = await octokit.request("GET /user/repos", {
			per_page: 100,
			sort: "updated",
		});

		const totalRepositories = repos.length;

		let totalCommits = 0;
		for (const repo of repos) {
			try {
				const { data: commits } = await octokit.request(
					"GET /repos/{owner}/{repo}/commits",
					{
						owner: repo.owner!.login,
						repo: repo.name,
						per_page: 1,
					}
				);
				if (commits.length > 0) {
					totalCommits += 1;
				}
			} catch {
				// Skip repos where we can't fetch commits
			}
		}

		res.json({
			totalRepositories,
			totalCommits,
		});
	} catch (error) {
		console.error("Error fetching GitHub stats:", error);
		res.status(500).json({ error: "Failed to fetch GitHub stats" });
	}
});

export default router;
