import * as sql from 'mssql';

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
    const pool = await sql.connect({
      server: 'localhost\\SQLEXPRESS',
      database: 'WhatsAppAPI',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
      }
    });

    try {
      const result = await pool.request()
        .input('userId', sql.Int, accountData.userId)
        .input('accountToken', sql.VarChar, accountData.accountToken)
        .query(`
          INSERT INTO ${this.tableName} (user_id, account_token)
          OUTPUT
            id, user_id as userId, account_token as accountToken,
            phone_number as phoneNumber, whatsapp_name as whatsappName,
            is_connected as isConnected, created_at as createdAt
          VALUES (@userId, @accountToken)
        `);

      return result.recordset[0] as IWhatsAppAccount;
    } catch (error) {
      console.error('Error in WhatsAppAccount.create:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Find WhatsApp account by token
  static async findByToken(accountToken: string): Promise<IWhatsAppAccount | null> {
    const pool = await sql.connect({
      server: 'localhost\\SQLEXPRESS',
      database: 'WhatsAppAPI',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
      }
    });

    try {
      const result = await pool.request()
        .input('accountToken', sql.VarChar, accountToken)
        .query(`
          SELECT
            id, user_id as userId, account_token as accountToken,
            phone_number as phoneNumber, whatsapp_name as whatsappName,
            is_connected as isConnected, created_at as createdAt
          FROM ${this.tableName}
          WHERE account_token = @accountToken
        `);

      return result.recordset.length > 0 ? result.recordset[0] as IWhatsAppAccount : null;
    } catch (error) {
      console.error('Error in WhatsAppAccount.findByToken:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Find WhatsApp accounts by user ID
  static async findByUserId(userId: number): Promise<IWhatsAppAccount[]> {
    const pool = await sql.connect({
      server: 'localhost\\SQLEXPRESS',
      database: 'WhatsAppAPI',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
      }
    });

    try {
      const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          SELECT
            id, user_id as userId, account_token as accountToken,
            phone_number as phoneNumber, whatsapp_name as whatsappName,
            is_connected as isConnected, created_at as createdAt
          FROM ${this.tableName}
          WHERE user_id = @userId
          ORDER BY created_at DESC
        `);

      return result.recordset as IWhatsAppAccount[];
    } catch (error) {
      console.error('Error in WhatsAppAccount.findByUserId:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Find WhatsApp account by ID
  static async findById(id: number): Promise<IWhatsAppAccount | null> {
    const pool = await sql.connect({
      server: 'localhost\\SQLEXPRESS',
      database: 'WhatsAppAPI',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
      }
    });

    try {
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query(`
          SELECT
            id, user_id as userId, account_token as accountToken,
            phone_number as phoneNumber, whatsapp_name as whatsappName,
            is_connected as isConnected, created_at as createdAt
          FROM ${this.tableName}
          WHERE id = @id
        `);

      return result.recordset.length > 0 ? result.recordset[0] as IWhatsAppAccount : null;
    } catch (error) {
      console.error('Error in WhatsAppAccount.findById:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Update WhatsApp account
  static async update(id: number, updateData: IUpdateWhatsAppAccountData): Promise<boolean> {
    const pool = await sql.connect({
      server: 'localhost\\SQLEXPRESS',
      database: 'WhatsAppAPI',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
      }
    });

    try {
      let query = `UPDATE ${this.tableName} SET `;
      const updates: string[] = [];
      const request = pool.request().input('id', sql.Int, id);

      if (updateData.phoneNumber !== undefined) {
        updates.push('phone_number = @phoneNumber');
        request.input('phoneNumber', sql.VarChar, updateData.phoneNumber);
      }

      if (updateData.whatsappName !== undefined) {
        updates.push('whatsapp_name = @whatsappName');
        request.input('whatsappName', sql.VarChar, updateData.whatsappName);
      }

      if (updateData.isConnected !== undefined) {
        updates.push('is_connected = @isConnected');
        request.input('isConnected', sql.Bit, updateData.isConnected);
      }

      if (updates.length === 0) return false;

      query += updates.join(', ') + ' WHERE id = @id';

      const result = await request.query(query);
      return (result.rowsAffected[0] || 0) > 0;
    } catch (error) {
      console.error('Error in WhatsAppAccount.update:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Update WhatsApp connection details after QR scan
  static async updateConnectionDetails(
    accountToken: string,
    phoneNumber: string,
    whatsappName: string
  ): Promise<boolean> {
    const pool = await sql.connect({
      server: 'localhost\\SQLEXPRESS',
      database: 'WhatsAppAPI',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
      }
    });

    try {
      const result = await pool.request()
        .input('accountToken', sql.VarChar, accountToken)
        .input('phoneNumber', sql.VarChar, phoneNumber)
        .input('whatsappName', sql.VarChar, whatsappName)
        .query(`
          UPDATE ${this.tableName}
          SET phone_number = @phoneNumber,
              whatsapp_name = @whatsappName,
              is_connected = 1
          WHERE account_token = @accountToken
        `);
          if (!result.rowsAffected[0]) return false;
      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('Error in WhatsAppAccount.updateConnectionDetails:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Mark account as connected
  static async markAsConnected(accountToken: string): Promise<boolean> {
    const pool = await sql.connect({
      server: 'localhost\\SQLEXPRESS',
      database: 'WhatsAppAPI',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
      }
    });

    try {
      const result = await pool.request()
        .input('accountToken', sql.VarChar, accountToken)
        .query(`
          UPDATE ${this.tableName}
          SET is_connected = 1
          WHERE account_token = @accountToken
        `);
      if (!result.rowsAffected[0]) return false;
      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('Error in WhatsAppAccount.markAsConnected:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Mark account as disconnected
  static async markAsDisconnected(accountToken: string): Promise<boolean> {
    const pool = await sql.connect({
      server: 'localhost\\SQLEXPRESS',
      database: 'WhatsAppAPI',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
      }
    });

    try {
      const result = await pool.request()
        .input('accountToken', sql.VarChar, accountToken)
        .query(`
          UPDATE ${this.tableName}
          SET is_connected = 0
          WHERE account_token = @accountToken
        `);
      if (!result.rowsAffected[0]) return false;
      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('Error in WhatsAppAccount.markAsDisconnected:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Get connected accounts for a user
  static async findConnectedByUserId(userId: number): Promise<IWhatsAppAccount[]> {
    const pool = await sql.connect({
      server: 'localhost\\SQLEXPRESS',
      database: 'WhatsAppAPI',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
      }
    });

    try {
      const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          SELECT
            id, user_id as userId, account_token as accountToken,
            phone_number as phoneNumber, whatsapp_name as whatsappName,
            is_connected as isConnected, created_at as createdAt
          FROM ${this.tableName}
          WHERE user_id = @userId AND is_connected = 1
          ORDER BY created_at DESC
        `);

      return result.recordset as IWhatsAppAccount[];
    } catch (error) {
      console.error('Error in WhatsAppAccount.findConnectedByUserId:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Check if account token exists
  static async tokenExists(accountToken: string): Promise<boolean> {
    const pool = await sql.connect({
      server: 'localhost\\SQLEXPRESS',
      database: 'WhatsAppAPI',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
      }
    });

    try {
      const result = await pool.request()
        .input('accountToken', sql.VarChar, accountToken)
        .query(`SELECT 1 FROM ${this.tableName} WHERE account_token = @accountToken`);

      return result.recordset.length > 0;
    } catch (error) {
      console.error('Error in WhatsAppAccount.tokenExists:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Delete WhatsApp account
  static async delete(id: number): Promise<boolean> {
    const pool = await sql.connect({
      server: 'localhost\\SQLEXPRESS',
      database: 'WhatsAppAPI',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
      }
    });

    try {
      const result = await pool.request()
        .input('id', sql.Int, id)
        .query(`DELETE FROM ${this.tableName} WHERE id = @id`);

      if (!result.rowsAffected[0]) return false;
      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('Error in WhatsAppAccount.delete:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Get all WhatsApp accounts (for admin purposes)
  static async findAll(limit = 50, offset = 0): Promise<IWhatsAppAccount[]> {
    const pool = await sql.connect({
      server: 'localhost\\SQLEXPRESS',
      database: 'WhatsAppAPI',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
      }
    });

    try {
      const result = await pool.request()
        .input('limit', sql.Int, limit)
        .input('offset', sql.Int, offset)
        .query(`
          SELECT
            id, user_id as userId, account_token as accountToken,
            phone_number as phoneNumber, whatsapp_name as whatsappName,
            is_connected as isConnected, created_at as createdAt
          FROM ${this.tableName}
          ORDER BY created_at DESC
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);

      return result.recordset as IWhatsAppAccount[];
    } catch (error) {
      console.error('Error in WhatsAppAccount.findAll:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Get account statistics for a user
  static async getAccountStats(userId: number): Promise<{
    totalAccounts: number;
    connectedAccounts: number;
    disconnectedAccounts: number;
  }> {
    const pool = await sql.connect({
      server: 'localhost\\SQLEXPRESS',
      database: 'WhatsAppAPI',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        trustedConnection: true,
        enableArithAbort: true,
        instanceName: 'SQLEXPRESS'
      }
    });

    try {
      const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          SELECT
            COUNT(*) as totalAccounts,
            SUM(CASE WHEN is_connected = 1 THEN 1 ELSE 0 END) as connectedAccounts,
            SUM(CASE WHEN is_connected = 0 THEN 1 ELSE 0 END) as disconnectedAccounts
          FROM ${this.tableName}
          WHERE user_id = @userId
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
    } finally {
      await pool.close();
    }
  }
}