import sql from 'mssql';
import { DatabaseService } from '../config/database.js';

export interface IWhatsAppAccount {
  id: number;
  userId: number;
  accountToken: string;
  phoneNumber?: string;
  whatsappName?: string;
  isConnected: boolean;
  createdAt: Date;
}

export interface ICreateWhatsAppAccountData {
  userId: number;
  accountToken: string;
}

export interface IUpdateWhatsAppAccountData {
  phoneNumber?: string;
  whatsappName?: string;
  isConnected?: boolean;
}

export class WhatsAppAccountModel {
  private static tableName = 'WhatsAppAccounts';

  // Create a new WhatsApp account
  static async create(accountData: ICreateWhatsAppAccountData): Promise<IWhatsAppAccount> {
    const pool = await DatabaseService.getPool();

    try {
      // First insert the record
      await pool.request()
        .input('userId', sql.Int, accountData.userId)
        .input('accountToken', sql.VarChar, accountData.accountToken)
        .query(`
          INSERT INTO ${this.tableName} (userId, accountToken)
          VALUES (@userId, @accountToken)
        `);

      // Then select the inserted record
      const result = await pool.request()
        .input('accountToken', sql.VarChar, accountData.accountToken)
        .query(`
          SELECT
            id, userId, accountToken, phoneNumber, whatsappName,
            isConnected, createdAt
          FROM ${this.tableName}
          WHERE accountToken = @accountToken
        `);

      if (result.recordset.length === 0) {
        throw new Error('Failed to retrieve created WhatsApp account');
      }

      return result.recordset[0] as IWhatsAppAccount;
    } catch (error) {
      console.error('Error in WhatsAppAccount.create:', error);
      throw error;
    }
  }

  // Find WhatsApp account by token
  static async findByToken(accountToken: string): Promise<IWhatsAppAccount | null> {
    const pool = await DatabaseService.getPool();

    try {
      const result = await pool.request()
        .input('accountToken', sql.VarChar, accountToken)
        .query(`
          SELECT
            id, userId, accountToken, phoneNumber, whatsappName,
            isConnected, createdAt
          FROM ${this.tableName}
          WHERE accountToken = @accountToken
        `);

      return result.recordset.length > 0 ? result.recordset[0] as IWhatsAppAccount : null;
    } catch (error) {
      console.error('Error in WhatsAppAccount.findByToken:', error);
      throw error;
    }
  }

  // Find WhatsApp accounts by user ID
  static async findByUserId(userId: number): Promise<IWhatsAppAccount[]> {
    const pool = await DatabaseService.getPool();

    try {
      const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          SELECT
            id, userId, accountToken, phoneNumber, whatsappName,
            isConnected, createdAt
          FROM ${this.tableName}
          WHERE userId = @userId
          ORDER BY createdAt DESC
        `);

      return result.recordset as IWhatsAppAccount[];
    } catch (error) {
      console.error('Error in WhatsAppAccount.findByUserId:', error);
      throw error;
    }
  }

  // Find WhatsApp account by ID
  static async findById(id: number): Promise<IWhatsAppAccount | null> {
    const pool = await DatabaseService.getPool();

    try {
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query(`
          SELECT
            id, userId, accountToken, phoneNumber, whatsappName,
            isConnected, createdAt
          FROM ${this.tableName}
          WHERE id = @id
        `);

      return result.recordset.length > 0 ? result.recordset[0] as IWhatsAppAccount : null;
    } catch (error) {
      console.error('Error in WhatsAppAccount.findById:', error);
      throw error;
    }
  }

  // Update WhatsApp account
  static async update(id: number, updateData: IUpdateWhatsAppAccountData): Promise<boolean> {
    const pool = await DatabaseService.getPool();

    try {
      let query = `UPDATE ${this.tableName} SET `;
      const updates: string[] = [];
      const request = pool.request().input('id', sql.Int, id);

      if (updateData.phoneNumber !== undefined) {
        updates.push('phoneNumber = @phoneNumber');
        request.input('phoneNumber', sql.VarChar, updateData.phoneNumber);
      }

      if (updateData.whatsappName !== undefined) {
        updates.push('whatsappName = @whatsappName');
        request.input('whatsappName', sql.VarChar, updateData.whatsappName);
      }

      if (updateData.isConnected !== undefined) {
        updates.push('isConnected = @isConnected');
        request.input('isConnected', sql.Bit, updateData.isConnected);
      }

      if (updates.length === 0) return false;

      query += updates.join(', ') + ' WHERE id = @id';

      const result = await request.query(query);
      return (result.rowsAffected[0] || 0) > 0;
    } catch (error) {
      console.error('Error in WhatsAppAccount.update:', error);
      throw error;
    }
  }

  // Update WhatsApp connection details after QR scan
  static async updateConnectionDetails(
    accountToken: string,
    phoneNumber: string,
    whatsappName: string
  ): Promise<boolean> {
    const pool = await DatabaseService.getPool();

    try {
      const result = await pool.request()
        .input('accountToken', sql.VarChar, accountToken)
        .input('phoneNumber', sql.VarChar, phoneNumber)
        .input('whatsappName', sql.VarChar, whatsappName)
        .query(`
          UPDATE ${this.tableName}
          SET phoneNumber = @phoneNumber,
              whatsappName = @whatsappName,
              isConnected = 1
          WHERE accountToken = @accountToken
        `);
          if (!result.rowsAffected[0]) return false;
      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('Error in WhatsAppAccount.updateConnectionDetails:', error);
      throw error;
    }
  }

  // Mark account as connected
  static async markAsConnected(accountToken: string): Promise<boolean> {
    const pool = await DatabaseService.getPool();

    try {
      const result = await pool.request()
        .input('accountToken', sql.VarChar, accountToken)
        .query(`
          UPDATE ${this.tableName}
          SET isConnected = 1
          WHERE accountToken = @accountToken
        `);
      if (!result.rowsAffected[0]) return false;
      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('Error in WhatsAppAccount.markAsConnected:', error);
      throw error;
    }
  }

  // Mark account as disconnected
  static async markAsDisconnected(accountToken: string): Promise<boolean> {
    const pool = await DatabaseService.getPool();

    try {
      const result = await pool.request()
        .input('accountToken', sql.VarChar, accountToken)
        .query(`
          UPDATE ${this.tableName}
          SET isConnected = 0
          WHERE accountToken = @accountToken
        `);
      if (!result.rowsAffected[0]) return false;
      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('Error in WhatsAppAccount.markAsDisconnected:', error);
      throw error;
    }
  }

  // Get connected accounts for a user
  static async findConnectedByUserId(userId: number): Promise<IWhatsAppAccount[]> {
    const pool = await DatabaseService.getPool();

    try {
      const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          SELECT
            id, userId, accountToken, phoneNumber, whatsappName,
            isConnected, createdAt
          FROM ${this.tableName}
          WHERE userId = @userId AND isConnected = 1
          ORDER BY createdAt DESC
        `);

      return result.recordset as IWhatsAppAccount[];
    } catch (error) {
      console.error('Error in WhatsAppAccount.findConnectedByUserId:', error);
      throw error;
    }
  }

  // Get all connected accounts (for session restoration on startup)
  static async findAllConnected(): Promise<IWhatsAppAccount[]> {
    const pool = await DatabaseService.getPool();

    try {
      const result = await pool.request()
        .query(`
          SELECT
            id, userId, accountToken, phoneNumber, whatsappName,
            isConnected, createdAt
          FROM ${this.tableName}
          WHERE isConnected = 1
          ORDER BY createdAt DESC
        `);

      return result.recordset as IWhatsAppAccount[];
    } catch (error) {
      console.error('Error in WhatsAppAccount.findAllConnected:', error);
      throw error;
    }
  }

  // Check if account token exists
  static async tokenExists(accountToken: string): Promise<boolean> {
    const pool = await DatabaseService.getPool();

    try {
      const result = await pool.request()
        .input('accountToken', sql.VarChar, accountToken)
        .query(`SELECT 1 FROM ${this.tableName} WHERE accountToken = @accountToken`);

      return result.recordset.length > 0;
    } catch (error) {
      console.error('Error in WhatsAppAccount.tokenExists:', error);
      throw error;
    }
  }

  // Delete WhatsApp account
  static async delete(id: number): Promise<boolean> {
    const pool = await DatabaseService.getPool();

    try {
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query(`DELETE FROM ${this.tableName} WHERE id = @id`);

      if (!result.rowsAffected[0]) return false;
      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('Error in WhatsAppAccount.delete:', error);
      throw error;
    }
  }

  // Get all WhatsApp accounts (for admin purposes)
  static async findAll(limit = 50, offset = 0): Promise<IWhatsAppAccount[]> {
    const pool = await DatabaseService.getPool();

    try {
      const result = await pool.request()
        .input('limit', sql.Int, limit)
        .input('offset', sql.Int, offset)
        .query(`
          SELECT
            id, userId, accountToken, phoneNumber, whatsappName,
            isConnected, createdAt
          FROM ${this.tableName}
          ORDER BY createdAt DESC
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);

      return result.recordset as IWhatsAppAccount[];
    } catch (error) {
      console.error('Error in WhatsAppAccount.findAll:', error);
      throw error;
    }
  }

  // Get account statistics for a user
  static async getAccountStats(userId: number): Promise<{
    totalAccounts: number;
    connectedAccounts: number;
    disconnectedAccounts: number;
  }> {
    const pool = await DatabaseService.getPool();

    try {
      const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          SELECT
            COUNT(*) as totalAccounts,
            SUM(CASE WHEN isConnected = 1 THEN 1 ELSE 0 END) as connectedAccounts,
            SUM(CASE WHEN isConnected = 0 THEN 1 ELSE 0 END) as disconnectedAccounts
          FROM ${this.tableName}
          WHERE userId = @userId
        `);

      const stats = result.recordset[0];
      return {
        totalAccounts: stats.totalAccounts,
        connectedAccounts: stats.connectedAccounts,
        disconnectedAccounts: stats.disconnectedAccounts
      };
    } catch (error) {
      console.error('Error in WhatsAppAccount.getAccountStats:', error);
      throw error;
    }
  }
}