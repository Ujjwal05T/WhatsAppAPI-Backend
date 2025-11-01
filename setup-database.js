const sql = require('mssql');

// Database configuration
const config = {
  server: 'localhost\\SQLEXPRESS',  // Your SQL Server Express instance
  database: 'WhatsAppAPI',               // Connect to master first to create the database
  options: {
    encrypt: false,
    trustServerCertificate: true,
    trustedConnection: true,         // Enable Windows Authentication
    enableArithAbort: true,
    instanceName: 'SQLEXPRESS'
  }
};

async function setupDatabase() {
  try {
    console.log('🔄 Connecting to SQL Server...');

    // Connect to master database to create the WhatsAppAPI database
    const pool = await sql.connect(config);
    console.log('✅ Connected to SQL Server');

    // Create the database if it doesn't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'WhatsAppAPI')
      BEGIN
        CREATE DATABASE WhatsAppAPI;
        PRINT 'Database WhatsAppAPI created successfully';
      END
      ELSE
      BEGIN
        PRINT 'Database WhatsAppAPI already exists';
      END
    `);

    console.log('✅ Database "WhatsAppAPI" is ready');

    // Close the master connection
    await pool.close();

    // Connect to the WhatsAppAPI database
    const appConfig = {
      ...config,
      database: 'WhatsAppAPI'
    };

    const appPool = await sql.connect(appConfig);
    console.log('✅ Connected to WhatsAppAPI database');

    // Create Users table with auto-increment integer ID
    await appPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
      BEGIN
        CREATE TABLE Users (
          id INT IDENTITY(1,1) PRIMARY KEY,
          mobile VARCHAR(20) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          api_key VARCHAR(100) UNIQUE NOT NULL,
          created_at DATETIME DEFAULT GETDATE(),
          last_login DATETIME NULL,
          is_active BIT DEFAULT 1
        );
        PRINT 'Table Users created successfully with auto-increment ID';
      END
      ELSE
      BEGIN
        PRINT 'Table Users already exists';
      END
    `);

    // Create WhatsAppAccounts table with auto-increment integer ID
    await appPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WhatsAppAccounts' AND xtype='U')
      BEGIN
        CREATE TABLE WhatsAppAccounts (
          id INT IDENTITY(1,1) PRIMARY KEY,
          user_id INT NOT NULL,
          account_token VARCHAR(100) UNIQUE NOT NULL,
          phone_number VARCHAR(20) NULL,
          whatsapp_name VARCHAR(255) NULL,
          is_connected BIT DEFAULT 0,
          created_at DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
        );
        PRINT 'Table WhatsAppAccounts created successfully with auto-increment ID';
      END
      ELSE
      BEGIN
        PRINT 'Table WhatsAppAccounts already exists';
      END
    `);

    // Create indexes for better performance
    await appPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_Mobile')
      CREATE INDEX IX_Users_Mobile ON Users(mobile);

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_ApiKey')
      CREATE INDEX IX_Users_ApiKey ON Users(api_key);

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WhatsAppAccounts_UserID')
      CREATE INDEX IX_WhatsAppAccounts_UserID ON WhatsAppAccounts(user_id);

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WhatsAppAccounts_Token')
      CREATE INDEX IX_WhatsAppAccounts_Token ON WhatsAppAccounts(account_token);

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WhatsAppAccounts_UserID_Connected')
      CREATE INDEX IX_WhatsAppAccounts_UserID_Connected ON WhatsAppAccounts(user_id, is_connected);
    `);

    console.log('✅ Database tables and indexes created successfully');

    // Create sample data (optional)
    await appPool.request().query(`
      -- Check if we have any users, if not create a sample
      IF NOT EXISTS (SELECT 1 FROM Users)
      BEGIN
        PRINT 'No users found - you can register users via the API';
        PRINT 'Use POST /api/auth/register to create your first user';
      END
      ELSE
      BEGIN
        DECLARE @UserCount INT;
        SELECT @UserCount = COUNT(*) FROM Users;
        PRINT 'Found ' + CAST(@UserCount AS VARCHAR) + ' existing users';
      END
    `);

    // Close the application connection
    await appPool.close();

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📋 Database Configuration:');
    console.log('   Server: localhost');
    console.log('   Database: WhatsAppAPI');
    console.log('   Tables: Users, WhatsAppAccounts');
    console.log('   Primary Keys: Auto-increment INT IDs');
    console.log('\n📝 Schema Summary:');
    console.log('   Users Table:');
    console.log('     - id: INT IDENTITY(1,1) PRIMARY KEY');
    console.log('     - mobile: VARCHAR(20) UNIQUE');
    console.log('     - password_hash: VARCHAR(255)');
    console.log('     - api_key: VARCHAR(100) UNIQUE');
    console.log('     - created_at: DATETIME DEFAULT GETDATE()');
    console.log('     - last_login: DATETIME NULL');
    console.log('     - is_active: BIT DEFAULT 1');
    console.log('');
    console.log('   WhatsAppAccounts Table:');
    console.log('     - id: INT IDENTITY(1,1) PRIMARY KEY');
    console.log('     - user_id: INT FOREIGN KEY REFERENCES Users(id)');
    console.log('     - account_token: VARCHAR(100) UNIQUE');
    console.log('     - phone_number: VARCHAR(20) NULL');
    console.log('     - whatsapp_name: VARCHAR(255) NULL');
    console.log('     - is_connected: BIT DEFAULT 0');
    console.log('     - created_at: DATETIME DEFAULT GETDATE()');
    console.log('\n📝 Update your database.ts config with your actual SQL Server credentials:');
    console.log('   - user: Your SQL Server username');
    console.log('   - password: Your SQL Server password');
    console.log('   - server: Your SQL Server instance name');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
setupDatabase().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});