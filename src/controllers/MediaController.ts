import { Request, Response } from 'express';
import { MediaService } from '../services/MediaService.js';

/**
 * MediaController - Handles media download operations
 */
export class MediaController {
  /**
   * Download media file by message ID
   * @route GET /api/media/:messageId
   */
  static async downloadMedia(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;

      if (!messageId) {
        res.status(400).json({
          success: false,
          error: 'Message ID is required',
        });
        return;
      }

      console.log(`[MediaController] Downloading media for message ${messageId}`);

      // Download the media
      const media = await MediaService.downloadMedia(messageId);

      if (!media) {
        res.status(404).json({
          success: false,
          error: 'Media not found or expired. Media is only available for 24 hours.',
        });
        return;
      }

      // Set appropriate headers
      res.setHeader('Content-Type', media.mimetype);
      res.setHeader('Content-Length', media.buffer.length);

      if (media.filename) {
        res.setHeader('Content-Disposition', `attachment; filename="${media.filename}"`);
      }

      // Send the file
      res.send(media.buffer);
    } catch (error: any) {
      console.error('[MediaController] Error downloading media:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download media',
        details: error.message,
      });
    }
  }

  /**
   * Get media service statistics
   * @route GET /api/media/stats
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = MediaService.getStats();
      res.status(200).json({
        success: true,
        stats,
      });
    } catch (error: any) {
      console.error('[MediaController] Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get media statistics',
      });
    }
  }
}
