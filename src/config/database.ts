import sql from 'mssql';

const config = {
      server: process.env.DB_SERVER || 'localhost',
      port: parseInt(process.env.DB_PORT || '1433'),
      database: process.env.DB_NAME || 'WhatsAppAPI',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
      }
};

export class DatabaseService {
  private static pool: sql.ConnectionPool | null = null;
  private static connectionPromise: Promise<void> | null = null;

  static async connect(): Promise<void> {
    // If connection is already in progress, wait for it
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // If we already have a pool, verify it's connected
    if (this.pool) {
      try {
        // Test the connection with a simple query
        await this.pool.request().query('SELECT 1');
        return; // Connection is good
      } catch (error) {
        console.log('🔄 Connection test failed, reconnecting...', (error as Error).message);
        this.pool = null; // Reset the pool
      }
    }

    // Start new connection process
    this.connectionPromise = this.establishConnection();
    return this.connectionPromise;
  }

  private static async establishConnection(): Promise<void> {
    try {
      console.log('🔍 Database connection config:', {
        server: config.server,
        port: config.port,
        database: config.database,
        user: config.user ? '***' : 'undefined'
      });
      console.log('Connecting to MSSQL...');

      // Create new connection pool with retry configuration
      const poolConfig = {
        ...config,
        pool: {
          max: 10,
          min: 2,
          idleTimeoutMillis: 30000,
          acquireTimeoutMillis: 60000,
          createTimeoutMillis: 30000,
          destroyTimeoutMillis: 5000,
          reapIntervalMillis: 1000,
          createRetryIntervalMillis: 200
        },
        options: {
          ...config.options,
          connectionTimeout: 60000,
          requestTimeout: 60000
        }
      };

      this.pool = await sql.connect(poolConfig);
      console.log('✅ Connected to MSSQL successfully');

      // Verify database and tables
      await this.verifyDatabase();
      await this.createTables();

      this.connectionPromise = null; // Clear the promise on success
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      this.connectionPromise = null; // Clear the promise on failure
      throw error;
    }
  }

  static async verifyDatabase(): Promise<void> {
    try {
      // Check current database
      const dbResult = await this.pool!.request().query('SELECT DB_NAME() as CurrentDatabase');
      console.log('📍 Connected to database:', dbResult.recordset[0].CurrentDatabase);

      // Check if Users table exists and show its structure
      const tableCheck = await this.pool!.request().query(`
        SELECT
          TABLE_NAME,
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Users'
        ORDER BY ORDINAL_POSITION
      `);

      if (tableCheck.recordset.length > 0) {
        console.log('📋 Users table structure:');
        tableCheck.recordset.forEach(col => {
          console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''} (${col.IS_NULLABLE})`);
        });
      } else {
        console.log('❌ Users table not found');
      }

      // Show sample data if table exists and test column access
      if (tableCheck.recordset.length > 0) {
        try {
          const sampleData = await this.pool!.request().query('SELECT TOP 1 * FROM Users');
          if (sampleData.recordset.length > 0) {
            console.log('📄 Sample data:', sampleData.recordset[0]);
          } else {
            console.log('📄 Users table is empty');
          }

          // Test accessing the columns we expect
          const testQuery = await this.pool!.request().query(`
            SELECT TOP 1
              id, mobile, password_hash, api_key, created_at, last_login, is_active
            FROM Users
          `);
          console.log('🔍 Column test successful:', testQuery.recordset.length, 'rows');
        } catch (testError) {
          console.error('❌ Column access test failed:', (testError as Error).message);

          // Let's try to get the actual table structure
          const actualColumns = await this.pool!.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Users' ORDER BY ORDINAL_POSITION
          `);
          console.log('🔍 Actual column names:', actualColumns.recordset.map(r => r.COLUMN_NAME));
        }
      }
    } catch (error) {
      console.error('❌ Database verification failed:', error);
    }
  }

  static async createTables(): Promise<void> {
    try {
      // Create Users table
      await this.pool!.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
        CREATE TABLE Users (
          id INT IDENTITY(1,1) PRIMARY KEY,
          mobile VARCHAR(20) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          api_key VARCHAR(100) UNIQUE NOT NULL,
          created_at DATETIME DEFAULT GETDATE(),
          last_login DATETIME NULL,
          is_active BIT DEFAULT 1
        )
      `);

      // Drop WhatsAppAccounts table if it exists with wrong schema
      try {
        await this.pool!.request().query(`
          IF EXISTS (SELECT * FROM sysobjects WHERE name='WhatsAppAccounts' AND xtype='U')
          BEGIN
            -- Check if the table has snake_case columns (old schema)
            IF EXISTS (
              SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_NAME = 'WhatsAppAccounts'
              AND COLUMN_NAME = 'user_id'
            )
            BEGIN
              PRINT 'Dropping WhatsAppAccounts table with old schema...'
              DROP TABLE WhatsAppAccounts
            END
          END
        `);
      } catch (dropError) {
        console.log('Note: Could not drop old WhatsAppAccounts table (might not exist):', (dropError as Error).message);
      }

      // Create WhatsAppAccounts table with correct camelCase schema
      await this.pool!.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WhatsAppAccounts' AND xtype='U')
        CREATE TABLE WhatsAppAccounts (
          id INT IDENTITY(1,1) PRIMARY KEY,
          userId INT NOT NULL,
          accountToken VARCHAR(100) UNIQUE NOT NULL,
          phoneNumber VARCHAR(20),
          whatsappName VARCHAR(255),
          isConnected BIT DEFAULT 0,
          createdAt DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (userId) REFERENCES Users(id)
        )
      `);

      console.log('✅ Database tables created/verified');
    } catch (error) {
      console.error('❌ Error creating tables:', error);
      throw error;
    }
  }

  static async getPool(): Promise<sql.ConnectionPool> {
    try {
      await this.connect();

      if (!this.pool) {
        throw new Error('Failed to establish database connection');
      }

      // Test the connection before returning
      await this.pool.request().query('SELECT 1');
      return this.pool;
    } catch (error) {
      console.error('❌ Failed to get database pool:', error);
      // Reset pool and try once more
      this.pool = null;
      await this.connect();

      if (!this.pool) {
        throw new Error('Database connection unavailable');
      }

      return this.pool;
    }
  }

  static async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      console.log('Database connection closed');
    }
  }
}