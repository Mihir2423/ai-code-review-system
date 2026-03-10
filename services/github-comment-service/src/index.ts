import { logger } from "@repo/logger";
import express from "express";

const app = express();
const PORT = process.env.PORT || 4002;

app.use(express.json());

app.get("/health", (_req, res) => {
	res.json({ status: "ok", service: "github-comment-service" });
});

app.post("/comment", (req, res) => {
	logger.info({ body: req.body }, "Comment request received");
	res.sendStatus(200);
});

app.listen(PORT, () => {
	logger.info({ port: PORT }, "GitHub Comment service started");
});
