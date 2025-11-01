import { Request, Response, NextFunction } from 'express';
import { UserService } from './services/UserService.js';

export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API Key is required in X-API-Key header'
      });
    }

    // Validate API key
    const user = await UserService.validateApiKey(apiKey);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API Key'
      });
    }

    // Add user to request for use in routes
    req.user = user;

    next();

  } catch (error) {
    console.error('API Key middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        mobile: string;
        passwordHash: string;
        apiKey: string;
        createdAt: Date;
        lastLogin?: Date;
        isActive: boolean;
      };
    }
  }
}