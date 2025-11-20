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
      return {
        hasMedia: true,
        mediaType: 'image',
        caption: msg.imageMessage.caption,
        mimetype: msg.imageMessage.mimetype || 'image/jpeg',
        fileSize: msg.imageMessage.fileLength ? Number(msg.imageMessage.fileLength) : undefined,
        mediaUrl: `/api/media/${message.key.id}`,
      };
    }

    // Video message
    if (msg.videoMessage) {
      return {
        hasMedia: true,
        mediaType: 'video',
        caption: msg.videoMessage.caption,
        filename: msg.videoMessage.fileName,
        mimetype: msg.videoMessage.mimetype || 'video/mp4',
        fileSize: msg.videoMessage.fileLength ? Number(msg.videoMessage.fileLength) : undefined,
        mediaUrl: `/api/media/${message.key.id}`,
      };
    }

    // Audio message
    if (msg.audioMessage) {
      return {
        hasMedia: true,
        mediaType: 'audio',
        mimetype: msg.audioMessage.mimetype || 'audio/ogg; codecs=opus',
        fileSize: msg.audioMessage.fileLength ? Number(msg.audioMessage.fileLength) : undefined,
        mediaUrl: `/api/media/${message.key.id}`,
      };
    }

    // Document message
    if (msg.documentMessage) {
      return {
        hasMedia: true,
        mediaType: 'document',
        caption: msg.documentMessage.caption,
        filename: msg.documentMessage.fileName,
        mimetype: msg.documentMessage.mimetype || 'application/octet-stream',
        fileSize: msg.documentMessage.fileLength ? Number(msg.documentMessage.fileLength) : undefined,
        mediaUrl: `/api/media/${message.key.id}`,
      };
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
        filename = msg.videoMessage.fileName || `video_${messageId}.${mimetype.split('/')[1]}`;
      } else if (msg?.audioMessage) {
        mimetype = msg.audioMessage.mimetype || 'audio/ogg';
        filename = `audio_${messageId}.${mimetype.split('/')[1].split(';')[0]}`;
      } else if (msg?.documentMessage) {
        mimetype = msg.documentMessage.mimetype || 'application/octet-stream';
        filename = msg.documentMessage.fileName || `document_${messageId}`;
      }

      return {
        buffer,
        mimetype,
        filename,
      };
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
