import { Request, Response, NextFunction } from 'express';
import { UserService } from './services/UserService.js';
import { WhatsAppAccountService } from './services/WhatsAppAccountService.js';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    // Extract account token from Authorization Bearer header
    const authHeader = req.headers['authorization'] as string;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : null;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: API Key is required in X-API-Key header'
      });
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Account token is required in Authorization header (Bearer token)'
      });
    }

    // Validate user and API key
    const user = await UserService.validateApiKey(apiKey);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid API Key'
      });
    }

    // Validate WhatsApp account connection
    const connectionResult = await WhatsAppAccountService.validateWhatsAppConnection(token);
    if (!connectionResult.success || !connectionResult.account) {
      return res.status(401).json({
        success: false,
        error: connectionResult.error || 'WhatsApp account validation failed'
      });
    }

    const account = connectionResult.account;

    // Add account to request for use in routes
    req.account = {
      token: account.accountToken,
      apiKey: user.apiKey,
      userId: user.id,
      ...(account.phoneNumber !== undefined && { phoneNumber: account.phoneNumber }),
      ...(account.whatsappName !== undefined && { whatsappName: account.whatsappName }),
      isConnected: account.isConnected,
      createdAt: account.createdAt
    };

    next();

  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

// Extend Express Request type to include account
declare global {
  namespace Express {
    interface Request {
      account?: {
        token: string;
        apiKey: string;
        userId: number;
        phoneNumber?: string;
        whatsappName?: string;
        isConnected: boolean;
        createdAt: Date;
      };
    }
  }
}