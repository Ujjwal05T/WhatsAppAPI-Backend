import { Request, Response } from 'express';
import { normalizeAndValidatePhoneNumber, validateMessage, checkRateLimit, formatToJID, humanDelay, processTemplate } from '../utils/index.js';
import { getClient } from '../whatsapp/index.js';
import { UserService } from '../services/UserService.js';
import { WhatsAppAccountService } from '../services/WhatsAppAccountService.js';
import { getMediaType } from '../middleware/upload.js';

interface AuthenticatedRequest extends Request {
  user?: any;
  account?: any;
}

interface SendMessageRequest extends AuthenticatedRequest {
  body: {
    to: string;
    message?: string;
    template?: string;
    templateData?: Record<string, any>;
  };
}

interface TemplateRequest extends AuthenticatedRequest {
  body: {
    name: string;
    template: string;
  };
}

export class MessagingController {
  // Send WhatsApp message
  static async sendMessage(req: SendMessageRequest, res: Response): Promise<void> {
    try {
      const { to, message, template, templateData } = req.body;

      // Get account token from middleware (set by authMiddleware via Bearer token)
      const token = req.account?.token;
      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized: Account token not found'
        });
        return;
      }

      // Validate required fields
      if (!to) {
        res.status(400).json({
          success: false,
          error: 'Recipient phone number is required'
        });
        return;
      }

      if (!message && !template) {
        res.status(400).json({
          success: false,
          error: 'Either message or template must be provided'
        });
        return;
      }

      // Normalize and validate phone number format
      const phoneValidation = normalizeAndValidatePhoneNumber(to);
      if (!phoneValidation.valid) {
        res.status(400).json({
          success: false,
          error: phoneValidation.error,
          providedNumber: phoneValidation.original
        });
        return;
      }

      // Use normalized phone number
      const normalizedPhoneNumber = phoneValidation.normalized!;

      // Account is already validated by authMiddleware, get account and user from req.account
      const account = req.account;
      const user = await UserService.getUserById(account.userId);

      // Check rate limiting
      const rateLimit = checkRateLimit(token);
      if (!rateLimit.allowed) {
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          resetTime: rateLimit.resetTime
        });
        return;
      }

      // Get WhatsApp client
      const client = getClient(token);
      if (!client) {
        res.status(503).json({
          success: false,
          error: 'WhatsApp client not available. Please try reconnecting.',
          help: 'Start a new QR session: POST /api/auth/start-qr-with-user'
        });
        return;
      }

      let finalMessage: string;

      // Handle template usage
      if (template) {
        // Simple in-memory template storage (in production, use database)
        const templates = new Map<string, string>();
        templates.set('welcome', 'Hello {{name}}! Welcome to our service. Thank you for joining!');
        templates.set('appointment', 'Hi {{name}}, this is a reminder about your appointment on {{date}} at {{time}}.');

        const templateContent = templates.get(template);
        if (!templateContent) {
          res.status(404).json({
            success: false,
            error: `Template '${template}' not found`
          });
          return;
        }

        if (!templateData || typeof templateData !== 'object') {
          res.status(400).json({
            success: false,
            error: 'Template data is required when using templates'
          });
          return;
        }

        finalMessage = processTemplate(templateContent, templateData);
      } else {
        // At this point, message must be defined due to earlier validation
        if (!message) {
          res.status(400).json({
            success: false,
            error: 'Message is required when not using a template'
          });
          return;
        }
        finalMessage = message;
      }

      // Validate message content
      const messageValidation = validateMessage(finalMessage);
      if (!messageValidation.valid) {
        res.status(400).json({
          success: false,
          error: messageValidation.error
        });
        return;
      }

      // Format recipient ID using normalized phone number
      const jid = formatToJID(normalizedPhoneNumber);

      // Human-like typing simulation with presence updates
      console.log(`[${token}] Starting to type message to ${normalizedPhoneNumber} (original: ${to})...`);
      await client.sendPresenceUpdate('composing', jid);
      await humanDelay(); // Random 1-3 second delay
      await client.sendPresenceUpdate('paused', jid);

      // Send the message
      console.log(`[${token}] Sending message to ${normalizedPhoneNumber}: ${finalMessage.substring(0, 50)}...`);
      const sentMsg = await client.sendMessage(jid, { text: finalMessage });

      if (!sentMsg || !sentMsg.key.id) {
        throw new Error('Message sending failed - no message ID returned');
      }

      console.log(`[${token}] Message sent successfully to ${normalizedPhoneNumber}. Message ID: ${sentMsg.key.id}`);

      // Success response with additional metadata
      res.status(200).json({
        success: true,
        messageId: sentMsg.key.id,
        to: normalizedPhoneNumber,
        originalNumber: to,
        normalizedNumber: normalizedPhoneNumber,
        account: {
          token: token,
          user: {
            mobile: user?.mobile,
            name: account.whatsappName
          }
        },
        messageType: template ? 'template' : 'direct',
        rateLimitRemaining: rateLimit.remaining,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Failed to send message:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Provide more specific error messages
      let errorMessage = 'Failed to send message';
      if (error instanceof Error) {
        if (error.message.includes('not on WhatsApp')) {
          errorMessage = 'Recipient is not on WhatsApp';
        } else if (error.message.includes('phone number')) {
          errorMessage = 'Invalid phone number format';
        } else if (error.message.includes('connection')) {
          errorMessage = 'WhatsApp connection lost. Please try again.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Message sending timed out. Please try again.';
        }
      }

      res.status(500).json({
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Send WhatsApp media message
  static async sendMedia(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Debug logging
      console.log('Request body:', req.body);
      console.log('Request file:', req.file);
      console.log('Content-Type:', req.headers['content-type']);

      const to = req.body?.to;
      const caption = req.body?.caption;
      const file = req.file;

      // Get account token from middleware
      const token = req.account?.token;
      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized: Account token not found'
        });
        return;
      }

      // Validate required fields
      if (!to) {
        res.status(400).json({
          success: false,
          error: 'Recipient phone number is required'
        });
        return;
      }

      if (!file) {
        res.status(400).json({
          success: false,
          error: 'Media file is required'
        });
        return;
      }

      // Normalize and validate phone number format
      const phoneValidation = normalizeAndValidatePhoneNumber(to);
      if (!phoneValidation.valid) {
        res.status(400).json({
          success: false,
          error: phoneValidation.error,
          providedNumber: phoneValidation.original
        });
        return;
      }

      // Use normalized phone number
      const normalizedPhoneNumber = phoneValidation.normalized!;

      // Get account and user
      const account = req.account;
      const user = await UserService.getUserById(account.userId);

      // Check rate limiting
      const rateLimit = checkRateLimit(token);
      if (!rateLimit.allowed) {
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          resetTime: rateLimit.resetTime
        });
        return;
      }

      // Get WhatsApp client
      const client = getClient(token);
      if (!client) {
        res.status(503).json({
          success: false,
          error: 'WhatsApp client not available. Please try reconnecting.',
          help: 'Start a new QR session: POST /api/auth/start-qr-with-user'
        });
        return;
      }

      // Format recipient ID using normalized phone number
      const jid = formatToJID(normalizedPhoneNumber);

      // Determine media type
      const mediaType = getMediaType(file.mimetype);

      // Prepare media message
      let messageContent: any;

      if (mediaType === 'image') {
        messageContent = {
          image: file.buffer,
          caption: caption || '',
          mimetype: file.mimetype,
          fileName: file.originalname
        };
      } else if (mediaType === 'video') {
        messageContent = {
          video: file.buffer,
          caption: caption || '',
          mimetype: file.mimetype,
          fileName: file.originalname
        };
      } else if (mediaType === 'audio') {
        messageContent = {
          audio: file.buffer,
          mimetype: file.mimetype,
          ptt: false // Set to true for voice messages
        };
      } else if (mediaType === 'document') {
        messageContent = {
          document: file.buffer,
          mimetype: file.mimetype,
          fileName: file.originalname,
          caption: caption || ''
        };
      }

      // Send presence update
      console.log(`[${token}] Sending ${mediaType} to ${normalizedPhoneNumber} (original: ${to})...`);
      await client.sendPresenceUpdate('composing', jid);
      await humanDelay(); // Random delay
      await client.sendPresenceUpdate('paused', jid);

      // Send the media message
      const sentMsg = await client.sendMessage(jid, messageContent);

      if (!sentMsg || !sentMsg.key.id) {
        throw new Error('Message sending failed - no message ID returned');
      }

      console.log(`[${token}] ${mediaType} sent successfully to ${normalizedPhoneNumber}. Message ID: ${sentMsg.key.id}`);

      // Success response
      res.status(200).json({
        success: true,
        messageId: sentMsg.key.id,
        to: normalizedPhoneNumber,
        originalNumber: to,
        normalizedNumber: normalizedPhoneNumber,
        mediaType: mediaType,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        account: {
          token: token,
          user: {
            mobile: user?.mobile,
            name: account.whatsappName
          }
        },
        rateLimitRemaining: rateLimit.remaining,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Failed to send media:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      let errorMessage = 'Failed to send media';
      if (error instanceof Error) {
        if (error.message.includes('not on WhatsApp')) {
          errorMessage = 'Recipient is not on WhatsApp';
        } else if (error.message.includes('phone number')) {
          errorMessage = 'Invalid phone number format';
        } else if (error.message.includes('connection')) {
          errorMessage = 'WhatsApp connection lost. Please try again.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Media sending timed out. Please try again.';
        } else if (error.message.includes('File type')) {
          errorMessage = error.message;
        }
      }

      res.status(500).json({
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get all message templates
  static async getTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Simple in-memory template storage (in production, use database)
      const templates = new Map<string, string>();
      templates.set('welcome', 'Hello {{name}}! Welcome to our service. Thank you for joining!');
      templates.set('appointment', 'Hi {{name}}, this is a reminder about your appointment on {{date}} at {{time}}.');
      templates.set('greeting', 'Hello {{name}}, how are you today?');
      templates.set('promotion', 'Hi {{name}}, check out our special offer: {{offer}}!');
      templates.set('reminder', 'Hi {{name}}, this is a reminder about {{event}} on {{date}}.');

      const templateList = Array.from(templates.entries()).map(([key, value]) => ({
        name: key,
        template: value,
        placeholders: value.match(/\{\{(\w+)\}\}/g)?.map(p => p.slice(2, -2)) || []
      }));

      res.status(200).json({
        success: true,
        templates: templateList,
        totalTemplates: templateList.length
      });

    } catch (error) {
      console.error('Error getting templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get templates'
      });
    }
  }

  // Create new message template
  static async createTemplate(req: TemplateRequest, res: Response): Promise<void> {
    try {
      const { name, template } = req.body;

      if (!name || !template) {
        res.status(400).json({
          success: false,
          error: 'Template name and content are required'
        });
        return;
      }

      // Validate template name
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        res.status(400).json({
          success: false,
          error: 'Template name can only contain letters, numbers, underscores, and hyphens'
        });
        return;
      }

      // Validate template content length
      if (template.length > 1000) {
        res.status(400).json({
          success: false,
          error: 'Template content must be less than 1000 characters'
        });
        return;
      }

      // Simple in-memory template storage (in production, use database)
      const templates = new Map<string, string>();
      templates.set('welcome', 'Hello {{name}}! Welcome to our service. Thank you for joining!');
      templates.set('appointment', 'Hi {{name}}, this is a reminder about your appointment on {{date}} at {{time}}.');

      if (templates.has(name)) {
        res.status(409).json({
          success: false,
          error: `Template '${name}' already exists`
        });
        return;
      }

      templates.set(name, template);

      const placeholders = template.match(/\{\{(\w+)\}\}/g)?.map(p => p.slice(2, -2)) || [];

      res.status(201).json({
        success: true,
        message: `Template '${name}' created successfully`,
        template: {
          name,
          content: template,
          placeholders
        }
      });

    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create template'
      });
    }
  }

  // Delete message template
  static async deleteTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { name } = req.params;

      if (!name) {
        res.status(400).json({
          success: false,
          error: 'Template name is required'
        });
        return;
      }

      // Simple in-memory template storage (in production, use database)
      const templates = new Map<string, string>();
      templates.set('welcome', 'Hello {{name}}! Welcome to our service. Thank you for joining!');
      templates.set('appointment', 'Hi {{name}}, this is a reminder about your appointment on {{date}} at {{time}}.');

      if (!templates.has(name)) {
        res.status(404).json({
          success: false,
          error: `Template '${name}' not found`
        });
        return;
      }

      templates.delete(name);

      res.status(200).json({
        success: true,
        message: `Template '${name}' deleted successfully`
      });

    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete template'
      });
    }
  }

  // Get account status
  static async getAccountStatus(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      if (!token) {
        res.status(400).json({
          success: false,
          error: 'Account token is required'
        });
        return;
      }

      // Get WhatsApp client status
      const client = getClient(token);
      const isConnected = !!client;

      // Get detailed account information
      const connectionResult = await WhatsAppAccountService.validateWhatsAppConnection(token);

      const status = {
        connected: isConnected,
        token: token,
        timestamp: new Date().toISOString(),
        details: connectionResult.success ? {
          accountToken: connectionResult.account?.accountToken,
          phoneNumber: connectionResult.account?.phoneNumber,
          whatsappName: connectionResult.account?.whatsappName,
          userMobile: connectionResult.user?.mobile,
          createdAt: connectionResult.account?.createdAt
        } : null,
        error: connectionResult.success ? null : connectionResult.error
      };

      res.status(200).json({
        success: true,
        account: status
      });

    } catch (error) {
      console.error('Error getting account status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get account status';

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // Get message history (basic implementation)
  static async getMessageHistory(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      if (!token) {
        res.status(400).json({
          success: false,
          error: 'Account token is required'
        });
        return;
      }

      // Validate connection
      const connectionResult = await WhatsAppAccountService.validateWhatsAppConnection(token);
      if (!connectionResult.success) {
        res.status(401).json({
          success: false,
          error: connectionResult.error || 'WhatsApp connection validation failed'
        });
        return;
      }

      // For now, return empty history as we don't have persistent message storage
      // In production, you would store messages in a database
      res.status(200).json({
        success: true,
        messages: [],
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: 0
        },
        note: 'Message history is not implemented in this version. Consider adding a message logging system.'
      });

    } catch (error) {
      console.error('Error getting message history:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get message history';

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }
}