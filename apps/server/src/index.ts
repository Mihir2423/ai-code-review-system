import { logger } from "@repo/logger";
import express from "express";
import cors from "cors";
import "dotenv/config";
import githubRoutes from "./modules/github.js";

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors({
	origin: "http://localhost:3000",
	credentials: true,
}));

app.use(express.json());

app.get("/health", (_req, res) => {
	res.json({ status: "ok", service: "server" });
});

app.use("/api/github", githubRoutes);

app.listen(PORT, () => {
	logger.info({ port: PORT }, "Server started");
});
