import * as sql from 'mssql';

const config = {
  user: 'sa', // Your SQL Server username
  password: 'your_password', // Your SQL Server password
  server: 'localhost', // Your server name or IP
  database: 'WhatsAppAPI',
  options: {
    encrypt: false, // If you're on Windows Azure, set to true
    trustServerCertificate: true // Change to true for local dev / self-signed certs
  },
  connectionTimeout: 30000,
  requestTimeout: 30000
};

export class DatabaseService {
  private static pool: sql.ConnectionPool | null = null;

  static async connect(): Promise<void> {
    try {
      if (!this.pool) {
        console.log('Connecting to MSSQL...');
        this.pool = await sql.connect(config);
        console.log('✅ Connected to MSSQL successfully');
        await this.createTables();
      }
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  static async createTables(): Promise<void> {
    try {
      // Create Users table
      await this.pool!.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
        CREATE TABLE Users (
          id VARCHAR(50) PRIMARY KEY,
          mobile VARCHAR(20) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          api_key VARCHAR(100) UNIQUE NOT NULL,
          created_at DATETIME DEFAULT GETDATE(),
          last_login DATETIME NULL,
          is_active BIT DEFAULT 1
        )
      `);

      // Create WhatsAppAccounts table
      await this.pool!.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WhatsAppAccounts' AND xtype='U')
        CREATE TABLE WhatsAppAccounts (
          id VARCHAR(50) PRIMARY KEY,
          user_id VARCHAR(50) NOT NULL,
          account_token VARCHAR(100) UNIQUE NOT NULL,
          phone_number VARCHAR(20),
          whatsapp_name VARCHAR(255),
          is_connected BIT DEFAULT 0,
          created_at DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (user_id) REFERENCES Users(id)
        )
      `);

      console.log('✅ Database tables created/verified');
    } catch (error) {
      console.error('❌ Error creating tables:', error);
      throw error;
    }
  }

  static async getPool(): Promise<sql.ConnectionPool> {
    if (!this.pool) {
      await this.connect();
    }
    return this.pool!;
  }

  static async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      console.log('Database connection closed');
    }
  }
}