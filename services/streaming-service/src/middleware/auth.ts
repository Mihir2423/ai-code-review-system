import type { NextFunction, Request, Response } from 'express';
import { auth } from '../auth.js';

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        name: string;
    };
}

async function validateToken(token: string) {
    const session = await auth.api.getSession({
        headers: new Headers({
            Authorization: `Bearer ${token}`,
        }),
    });
    return session?.user;
}

export async function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const headerToken = req.headers.authorization?.slice(7);
    const queryToken = req.query.token as string | undefined;
    const token = headerToken || queryToken;

    if (!token) {
        res.status(401).json({ error: 'Missing token' });
        return;
    }

    const user = await validateToken(token);

    if (!user) {
        res.status(401).json({ error: 'Invalid or expired session' });
        return;
    }

    req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
    };

    next();
}
