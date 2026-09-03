import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else {
    // For unhandled errors, log them
    console.error('ERROR 💥:', err);
    message = err.message; // Just for dev, in production you might want to hide this
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
