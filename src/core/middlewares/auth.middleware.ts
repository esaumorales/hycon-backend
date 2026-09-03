import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

// Placeholder Auth Middleware for future implementation
export const protect = (req: Request, res: Response, next: NextFunction) => {
  // Here we will check for Bearer Token
  // For now, let's just pass
  next();
};

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if user role is in roles array
    next();
  };
};
