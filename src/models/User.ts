import * as sql from 'mssql';

export interface IUser {
  id: number;
  mobile: string;
  passwordHash: string;
  apiKey: string;
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

export interface ICreateUserData {
  mobile: string;
  passwordHash: string;
  apiKey: string;
}

export interface IUpdateUserData {
  lastLogin?: Date;
  isActive?: boolean;
}

export class UserModel {
  private static tableName = 'Users';

  // Create a new user
  static async create(userData: ICreateUserData): Promise<IUser> {
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
        .input('mobile', sql.VarChar, userData.mobile)
        .input('passwordHash', sql.VarChar, userData.passwordHash)
        .input('apiKey', sql.VarChar, userData.apiKey)
        .query(`
          INSERT INTO ${this.tableName} (mobile, password_hash, api_key)
          OUTPUT
            id, mobile, password_hash as passwordHash, api_key as apiKey,
            created_at as createdAt, last_login as lastLogin, is_active as isActive
          VALUES (@mobile, @passwordHash, @apiKey)
        `);

      return result.recordset[0] as IUser;
    } catch (error) {
      console.error('Error in User.create:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Find user by mobile number
  static async findByMobile(mobile: string): Promise<IUser | null> {
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
        .input('mobile', sql.VarChar, mobile)
        .query(`
          SELECT
            id, mobile, password_hash as passwordHash, api_key as apiKey,
            created_at as createdAt, last_login as lastLogin, is_active as isActive
          FROM ${this.tableName}
          WHERE mobile = @mobile
        `);

      return result.recordset.length > 0 ? result.recordset[0] as IUser : null;
    } catch (error) {
      console.error('Error in User.findByMobile:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Find user by API key
  static async findByApiKey(apiKey: string): Promise<IUser | null> {
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
        .input('apiKey', sql.VarChar, apiKey)
        .query(`
          SELECT
            id, mobile, password_hash as passwordHash, api_key as apiKey,
            created_at as createdAt, last_login as lastLogin, is_active as isActive
          FROM ${this.tableName}
          WHERE api_key = @apiKey AND is_active = 1
        `);

      return result.recordset.length > 0 ? result.recordset[0] as IUser : null;
    } catch (error) {
      console.error('Error in User.findByApiKey:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Find user by ID
  static async findById(id: number): Promise<IUser | null> {
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
            id, mobile, password_hash as passwordHash, api_key as apiKey,
            created_at as createdAt, last_login as lastLogin, is_active as isActive
          FROM ${this.tableName}
          WHERE id = @id
        `);

      return result.recordset.length > 0 ? result.recordset[0] as IUser : null;
    } catch (error) {
      console.error('Error in User.findById:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Update user
  static async update(id: number, updateData: IUpdateUserData): Promise<boolean> {
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

      if (updateData.lastLogin !== undefined) {
        updates.push('last_login = @lastLogin');
        request.input('lastLogin', sql.DateTime, updateData.lastLogin);
      }

      if (updateData.isActive !== undefined) {
        updates.push('is_active = @isActive');
        request.input('isActive', sql.Bit, updateData.isActive);
      }

      if (updates.length === 0) return false;

      query += updates.join(', ') + ' WHERE id = @id';

      const result = await request.query(query);
      if (!result.rowsAffected[0]) return false;
      return result.rowsAffected[0] > 0;
    } catch (error) {
      console.error('Error in User.update:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Update last login
  static async updateLastLogin(id: number): Promise<boolean> {
    return this.update(id, { lastLogin: new Date() });
  }

  // Check if mobile number exists
  static async mobileExists(mobile: string): Promise<boolean> {
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
        .input('mobile', sql.VarChar, mobile)
        .query(`SELECT 1 FROM ${this.tableName} WHERE mobile = @mobile`);

      return result.recordset.length > 0;
    } catch (error) {
      console.error('Error in User.mobileExists:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Check if API key exists
  static async apiKeyExists(apiKey: string): Promise<boolean> {
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
        .input('apiKey', sql.VarChar, apiKey)
        .query(`SELECT 1 FROM ${this.tableName} WHERE api_key = @apiKey`);

      return result.recordset.length > 0;
    } catch (error) {
      console.error('Error in User.apiKeyExists:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }

  // Deactivate user
  static async deactivate(id: number): Promise<boolean> {
    return this.update(id, { isActive: false });
  }

  // Get all users (for admin purposes)
  static async findAll(limit = 50, offset = 0): Promise<IUser[]> {
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
            id, mobile, password_hash as passwordHash, api_key as apiKey,
            created_at as createdAt, last_login as lastLogin, is_active as isActive
          FROM ${this.tableName}
          ORDER BY created_at DESC
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);

      return result.recordset as IUser[];
    } catch (error) {
      console.error('Error in User.findAll:', error);
      throw error;
    } finally {
      await pool.close();
    }
  }
}