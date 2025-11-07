import { Request, Response } from 'express';
import { WebhookService } from '../services/WebhookService.js';
import { WhatsAppAccountService } from '../services/WhatsAppAccountService.js';

interface AuthenticatedRequest extends Request {
  account?: any;
}

export class WebhookController {
  /**
   * Register a new webhook
   * POST /api/webhooks/register
   */
  static async registerWebhook(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { accountToken, url, secret, events } = req.body;

      // Validate required fields
      if (!accountToken || !url) {
        res.status(400).json({
          success: false,
          error: 'Account token and webhook URL are required',
        });
        return;
      }

      // Validate that account exists and belongs to the user
      const accountValidation = await WhatsAppAccountService.validateWhatsAppConnection(accountToken);
      if (!accountValidation.success) {
        res.status(404).json({
          success: false,
          error: 'WhatsApp account not found or not connected',
        });
        return;
      }

      // Register webhook
      const webhook = await WebhookService.registerWebhook({
        accountToken,
        url,
        secret,
        events: events || ['message.received'],
      });

      res.status(201).json({
        success: true,
        message: 'Webhook registered successfully',
        webhook: {
          id: webhook.id,
          accountToken: webhook.accountToken,
          url: webhook.url,
          events: webhook.events,
          isActive: webhook.isActive,
          createdAt: webhook.createdAt,
        },
      });
    } catch (error: any) {
      console.error('Error registering webhook:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to register webhook',
      });
    }
  }

  /**
   * Get all webhooks for an account
   * GET /api/webhooks/:accountToken
   */
  static async getWebhooks(req: Request, res: Response): Promise<void> {
    try {
      const { accountToken } = req.params;

      if (!accountToken) {
        res.status(400).json({
          success: false,
          error: 'Account token is required',
        });
        return;
      }

      const webhooks = await WebhookService.getWebhooksByAccount(accountToken);

      res.status(200).json({
        success: true,
        webhooks: webhooks.map((w) => ({
          id: w.id,
          url: w.url,
          events: w.events,
          isActive: w.isActive,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching webhooks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch webhooks',
      });
    }
  }

  /**
   * Update webhook (toggle active status or change URL)
   * PATCH /api/webhooks/:id
   */
  static async updateWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { url, isActive, secret, events } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Webhook ID is required',
        });
        return;
      }

      // Check if webhook exists
      const existing = await WebhookService.getWebhookById(parseInt(id));
      if (!existing) {
        res.status(404).json({
          success: false,
          error: 'Webhook not found',
        });
        return;
      }

      // Update webhook
      const updateData: any = {};
      if (url !== undefined) updateData.url = url;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (secret !== undefined) updateData.secret = secret;
      if (events !== undefined) updateData.events = events;

      const webhook = await WebhookService.updateWebhook(parseInt(id), updateData);

      res.status(200).json({
        success: true,
        message: 'Webhook updated successfully',
        webhook: {
          id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          isActive: webhook.isActive,
          updatedAt: webhook.updatedAt,
        },
      });
    } catch (error: any) {
      console.error('Error updating webhook:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update webhook',
      });
    }
  }

  /**
   * Delete a webhook
   * DELETE /api/webhooks/:id
   */
  static async deleteWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Webhook ID is required',
        });
        return;
      }

      // Check if webhook exists
      const existing = await WebhookService.getWebhookById(parseInt(id));
      if (!existing) {
        res.status(404).json({
          success: false,
          error: 'Webhook not found',
        });
        return;
      }

      await WebhookService.deleteWebhook(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Webhook deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting webhook:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete webhook',
      });
    }
  }

  /**
   * Test webhook (send a test payload)
   * POST /api/webhooks/:id/test
   */
  static async testWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Webhook ID is required',
        });
        return;
      }

      const webhook = await WebhookService.getWebhookById(parseInt(id));
      if (!webhook) {
        res.status(404).json({
          success: false,
          error: 'Webhook not found',
        });
        return;
      }

      // Send test payload
      const testPayload = {
        event: 'webhook.test',
        timestamp: new Date().toISOString(),
        accountToken: webhook.accountToken,
        message: {
          id: 'TEST_MESSAGE_ID',
          from: '1234567890',
          fromName: 'Test User',
          body: 'This is a test message',
          timestamp: new Date().toISOString(),
          type: 'text',
        },
      };

      await WebhookService.triggerWebhooks(webhook.accountToken, testPayload);

      res.status(200).json({
        success: true,
        message: 'Test webhook sent successfully',
        payload: testPayload,
      });
    } catch (error: any) {
      console.error('Error testing webhook:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test webhook',
      });
    }
  }
}
