import { logger } from "@repo/logger";
import express from "express";

const app = express();
const PORT = process.env.PORT || 4001;

app.use(express.json());

app.get("/health", (_req, res) => {
	res.json({ status: "ok", service: "server" });
});

app.listen(PORT, () => {
	logger.info({ port: PORT }, "Server started");
});
