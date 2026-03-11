import type { Request, Response, NextFunction } from "express";
import * as jose from "jose";

const secret = new TextEncoder().encode(process.env.BETTER_AUTH_SECRET);

export interface AuthenticatedRequest extends Request {
	user?: {
		id: string;
		email: string;
		name: string;
	};
}

export async function authMiddleware(
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
) {
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return res.status(401).json({ error: "Missing or invalid authorization header" });
	}

	const token = authHeader.slice(7);

	try {
		const { payload } = await jose.jwtVerify(token, secret);

		req.user = {
			id: payload.sub as string,
			email: payload.email as string,
			name: payload.name as string,
		};

		next();
	} catch {
		return res.status(401).json({ error: "Invalid token" });
	}
}
