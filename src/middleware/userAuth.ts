import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/UserService.js';

interface AuthenticatedRequest extends Request {
  user?: any;
}

export async function userAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // Get API key from header
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'API key is required. Include it in X-API-Key header.'
      });
      return;
    }

    // Validate API key and get user
    const user = await UserService.validateApiKey(apiKey);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
      return;
    }

    // Add user to request object
    req.user = user;
    next();

  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}