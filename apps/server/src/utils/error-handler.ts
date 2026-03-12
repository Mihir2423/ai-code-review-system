import type { NextFunction, Request, Response } from 'express';

interface AppError extends Error {
    status?: number;
    errors?: Record<string, unknown>;
}

const catchErrors = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        return Promise.resolve(fn(req, res, next)).catch(next);
    };
};

const notFound = (req: Request, _res: Response, next: NextFunction) => {
    const err = new Error(`Route ${req.originalUrl} not found`) as AppError;
    err.status = 404;
    next(err);
};

const mongooseErrors = (err: AppError, _req: Request, res: Response, next: NextFunction) => {
    if (!err.errors) return next(err);

    const formattedErrors: Record<string, unknown> = {};
    Object.keys(err.errors).forEach((key) => {
        formattedErrors[key] = (err.errors as Record<string, unknown>)[key];
    });

    res.status(422).json({
        error: {
            message: 'Validation Error',
            status: 422,
            details: formattedErrors,
        },
    });
};

const developmentErrors = (err: AppError, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.status || 500).json({
        error: {
            message: err.message,
            status: err.status || 500,
            stack: err.stack || '',
            ...(err.errors && { details: err.errors }),
        },
    });
};

const productionErrors = (err: AppError, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.status || 500).json({
        error: {
            message: err.message,
            status: err.status || 500,
            ...(err.errors && { details: err.errors }),
        },
    });
};

export { catchErrors, notFound, mongooseErrors, developmentErrors, productionErrors };
