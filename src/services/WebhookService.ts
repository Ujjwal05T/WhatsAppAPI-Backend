import { prisma } from '../config/index.js';
import axios from 'axios';
import crypto from 'crypto';

export interface IWebhook {
  id: number;
  accountToken: string;
  url: string;
  isActive: boolean;
  secret: string | null;
  events: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateWebhookData {
  accountToken: string;
  url: string;
  secret?: string;
  events?: string[];
}

export interface IWebhookPayload {
  event: string;
  timestamp: string;
  accountToken: string;
  message: {
    id: string;
    from: string;
    fromName?: string;
    body: string;
    timestamp: string;
    type: string;
  };
}

export class WebhookService {
  /**
   * Register a new webhook
   */
  static async registerWebhook(data: ICreateWebhookData): Promise<IWebhook> {
    // Validate URL format
    try {
      new URL(data.url);
    } catch (error) {
      throw new Error('Invalid webhook URL format');
    }

    // Check if webhook already exists for this account
    const existing = await prisma.webhook.findFirst({
      where: {
        accountToken: data.accountToken,
        url: data.url,
      },
    });

    if (existing) {
      throw new Error('Webhook URL already registered for this account');
    }

    // Create webhook
    const webhook = await prisma.webhook.create({
      data: {
        accountToken: data.accountToken,
        url: data.url,
        secret: data.secret || null,
        events: data.events || ['message.received'],
        isActive: true,
      },
    });

    return webhook as IWebhook;
  }

  /**
   * Get all webhooks for an account
   */
  static async getWebhooksByAccount(accountToken: string): Promise<IWebhook[]> {
    const webhooks = await prisma.webhook.findMany({
      where: { accountToken },
      orderBy: { createdAt: 'desc' },
    });

    return webhooks as IWebhook[];
  }

  /**
   * Get a specific webhook by ID
   */
  static async getWebhookById(id: number): Promise<IWebhook | null> {
    const webhook = await prisma.webhook.findUnique({
      where: { id },
    });

    return webhook as IWebhook | null;
  }

  /**
   * Update webhook (toggle active status or change URL)
   */
  static async updateWebhook(
    id: number,
    data: { url?: string; isActive?: boolean; secret?: string; events?: string[] }
  ): Promise<IWebhook> {
    const webhook = await prisma.webhook.update({
      where: { id },
      data,
    });

    return webhook as IWebhook;
  }

  /**
   * Delete a webhook
   */
  static async deleteWebhook(id: number): Promise<void> {
    await prisma.webhook.delete({
      where: { id },
    });
  }

  /**
   * Trigger webhooks for a specific account and event
   */
  static async triggerWebhooks(accountToken: string, payload: IWebhookPayload): Promise<void> {
    // Get all active webhooks for this account that listen to this event
    const webhooks = await prisma.webhook.findMany({
      where: {
        accountToken,
        isActive: true,
        events: {
          has: payload.event,
        },
      },
    });

    if (webhooks.length === 0) {
      console.log(`[${accountToken}] No active webhooks found`);
      return;
    }

    console.log(`[${accountToken}] Triggering ${webhooks.length} webhook(s) for event: ${payload.event}`);

    // Trigger all webhooks in parallel
    const promises = webhooks.map((webhook) =>
      this.sendWebhookRequest(webhook, payload)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Send HTTP request to webhook URL
   */
  private static async sendWebhookRequest(
    webhook: IWebhook,
    payload: IWebhookPayload
  ): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'WhatsApp-API-Webhook/1.0',
      };

      // Add signature if secret is configured
      if (webhook.secret) {
        const signature = this.generateSignature(payload, webhook.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      console.log(`[Webhook ${webhook.id}] Sending to ${webhook.url}`);

      const response = await axios.post(webhook.url, payload, {
        headers,
        timeout: 10000, // 10 second timeout
        validateStatus: (status) => status >= 200 && status < 300,
      });

      console.log(`[Webhook ${webhook.id}] Success: ${response.status}`);
    } catch (error: any) {
      console.error(`[Webhook ${webhook.id}] Failed:`, error.message);

      // Optionally: Disable webhook after multiple failures
      // You could implement retry logic or failure counting here
    }
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private static generateSignature(payload: any, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Verify webhook signature (for users to use)
   */
  static verifySignature(payload: any, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}
