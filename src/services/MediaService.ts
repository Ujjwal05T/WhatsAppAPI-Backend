import { downloadMediaMessage, WAMessage, WASocket } from '@whiskeysockets/baileys';
import { getClient } from '../whatsapp/manager.js';

/**
 * In-memory storage for media messages
 * In production, consider using Redis or a database
 */
class MediaMessageStore {
  private messages = new Map<string, { message: WAMessage; accountToken: string; timestamp: number }>();
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  /**
   * Store a message for later media download
   */
  store(messageId: string, message: WAMessage, accountToken: string): void {
    this.messages.set(messageId, {
      message,
      accountToken,
      timestamp: Date.now()
    });

    // Clean up old messages periodically
    this.cleanup();
  }

  /**
   * Retrieve a stored message
   */
  get(messageId: string): { message: WAMessage; accountToken: string } | undefined {
    const data = this.messages.get(messageId);
    if (!data) return undefined;

    // Check if expired
    if (Date.now() - data.timestamp > this.TTL) {
      this.messages.delete(messageId);
      return undefined;
    }

    return { message: data.message, accountToken: data.accountToken };
  }

  /**
   * Clean up expired messages
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [messageId, data] of this.messages.entries()) {
      if (now - data.timestamp > this.TTL) {
        this.messages.delete(messageId);
      }
    }
  }

  /**
   * Get store size for monitoring
   */
  getSize(): number {
    return this.messages.size;
  }
}

export const mediaStore = new MediaMessageStore();

/**
 * MediaService - Handles media message operations
 */
export class MediaService {
  /**
   * Extract media metadata from a Baileys message
   */
  static extractMediaMetadata(message: WAMessage): {
    hasMedia: boolean;
    mediaType?: 'image' | 'video' | 'audio' | 'document';
    caption?: string;
    filename?: string;
    mimetype?: string;
    fileSize?: number;
    mediaUrl?: string;
  } {
    const msg = message.message;
    if (!msg) return { hasMedia: false };

    // Image message
    if (msg.imageMessage) {
      const result: any = {
        hasMedia: true,
        mediaType: 'image',
        mimetype: msg.imageMessage.mimetype || 'image/jpeg',
        mediaUrl: `/api/media/${message.key.id}`,
      };
      if (msg.imageMessage.caption) result.caption = msg.imageMessage.caption;
      if (msg.imageMessage.fileLength) result.fileSize = Number(msg.imageMessage.fileLength);
      return result;
    }

    // Video message
    if (msg.videoMessage) {
      const result: any = {
        hasMedia: true,
        mediaType: 'video',
        mimetype: msg.videoMessage.mimetype || 'video/mp4',
        mediaUrl: `/api/media/${message.key.id}`,
      };
      if (msg.videoMessage.caption) result.caption = msg.videoMessage.caption;
      if ((msg.videoMessage as any).fileName) result.filename = (msg.videoMessage as any).fileName;
      if (msg.videoMessage.fileLength) result.fileSize = Number(msg.videoMessage.fileLength);
      return result;
    }

    // Audio message
    if (msg.audioMessage) {
      const result: any = {
        hasMedia: true,
        mediaType: 'audio',
        mimetype: msg.audioMessage.mimetype || 'audio/ogg; codecs=opus',
        mediaUrl: `/api/media/${message.key.id}`,
      };
      if (msg.audioMessage.fileLength) result.fileSize = Number(msg.audioMessage.fileLength);
      return result;
    }

    // Document message
    if (msg.documentMessage) {
      const result: any = {
        hasMedia: true,
        mediaType: 'document',
        mimetype: msg.documentMessage.mimetype || 'application/octet-stream',
        mediaUrl: `/api/media/${message.key.id}`,
      };
      if (msg.documentMessage.caption) result.caption = msg.documentMessage.caption;
      if (msg.documentMessage.fileName) result.filename = msg.documentMessage.fileName;
      if (msg.documentMessage.fileLength) result.fileSize = Number(msg.documentMessage.fileLength);
      return result;
    }

    return { hasMedia: false };
  }

  /**
   * Download media from a message
   */
  static async downloadMedia(messageId: string): Promise<{
    buffer: Buffer;
    mimetype: string;
    filename?: string;
  } | null> {
    try {
      const stored = mediaStore.get(messageId);
      if (!stored) {
        console.error(`[MediaService] Message ${messageId} not found in store`);
        return null;
      }

      const { message, accountToken } = stored;
      const client = getClient(accountToken);

      if (!client) {
        console.error(`[MediaService] WhatsApp client not found for token ${accountToken}`);
        return null;
      }

      // Download the media
      const buffer = await downloadMediaMessage(
        message,
        'buffer',
        {},
        {
          logger: console as any,
          reuploadRequest: client.updateMediaMessage,
        }
      ) as Buffer;

      // Extract metadata
      const msg = message.message;
      let mimetype = 'application/octet-stream';
      let filename: string | undefined;

      if (msg?.imageMessage) {
        mimetype = msg.imageMessage.mimetype || 'image/jpeg';
        filename = `image_${messageId}.${mimetype.split('/')[1]}`;
      } else if (msg?.videoMessage) {
        mimetype = msg.videoMessage.mimetype || 'video/mp4';
        filename = (msg.videoMessage as any).fileName || `video_${messageId}.${mimetype.split('/')[1]}`;
      } else if (msg?.audioMessage) {
        mimetype = msg.audioMessage.mimetype || 'audio/ogg';
        const extension = mimetype.split('/')[1]?.split(';')[0] || 'ogg';
        filename = `audio_${messageId}.${extension}`;
      } else if (msg?.documentMessage) {
        mimetype = msg.documentMessage.mimetype || 'application/octet-stream';
        filename = msg.documentMessage.fileName || `document_${messageId}`;
      }

      const result: any = {
        buffer,
        mimetype,
      };
      if (filename) result.filename = filename;
      return result;
    } catch (error) {
      console.error(`[MediaService] Failed to download media for message ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Get media store statistics
   */
  static getStats() {
    return {
      storedMessages: mediaStore.getSize(),
      ttl: '24 hours',
    };
  }
}
