import { Request, Response } from 'express';
import { UserService, IRegistrationData, ILoginData } from '../services/UserService.js';
import { WhatsAppAccountService } from '../services/WhatsAppAccountService.js';
import { initializeQRClient, getPendingQRCode } from '../whatsapp/index.js';
import { getPendingSession, storePendingSession } from '../services/legacyAccountManager.js';

export class AuthController {
  // Register new user
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const registrationData: IRegistrationData = req.body;

      // Validate input
      if (!registrationData.name || !registrationData.mobile || !registrationData.password) {
        res.status(400).json({
          success: false,
          error: 'Name, mobile number and password are required'
        });
        return;
      }

      // Register user
      const { user, apiKey } = await UserService.registerUser(registrationData);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: {
          id: user.id,
          name: user.name,
          mobile: user.mobile,
          role: user.role,
          apiKey: apiKey,
          createdAt: user.createdAt
        },
        nextSteps: {
          step1: 'Use your API key to start WhatsApp account creation',
          step2: 'POST /api/auth/start-qr-with-user with your API key',
          step3: 'Scan QR code to connect WhatsApp'
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';

      res.status(400).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // User login
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const loginData: ILoginData = req.body;

      // Validate input
      if (!loginData.mobile || !loginData.password) {
        res.status(400).json({
          success: false,
          error: 'Mobile number and password are required'
        });
        return;
      }

      // Authenticate user
      const { user, apiKey } = await UserService.authenticateUser(loginData);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          name: user.name,
          mobile: user.mobile,
          apiKey: apiKey,
          role: user.role,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        },
        nextSteps: {
          step1: 'Use your API key to start WhatsApp account creation',
          step2: 'POST /api/auth/start-qr-with-user with your API key',
          step3: 'Scan QR code to connect WhatsApp'
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';

      res.status(401).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // Start WhatsApp QR process for registered user
  static async startWhatsAppQR(req: Request, res: Response): Promise<void> {
    try {
      const { apiKey } = req.body;

      // Validate input
      if (!apiKey) {
        res.status(400).json({
          success: false,
          error: 'API key is required'
        });
        return;
      }

      // Validate API key and get user
      const user = await UserService.validateApiKey(apiKey);
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Invalid API key'
        });
        return;
      }

      // Create WhatsApp account for this user
      const { account, accountToken } = await WhatsAppAccountService.createWhatsAppAccount(user.id);

      // Store pending session for QR tracking
      storePendingSession(accountToken, apiKey);

      // Initialize WhatsApp client for this account
      await initializeQRClient(accountToken);

      res.status(200).json({
        success: true,
        message: 'WhatsApp account creation started',
        account: {
          id: account.id,
          accountToken: accountToken,
          userId: user.id,
          isConnected: account.isConnected,
          createdAt: account.createdAt,
          apiKey: apiKey
        },
        instructions: {
          step1: 'Scan QR code to connect your WhatsApp',
          step2: 'After successful scan, your WhatsApp account will be ready',
          step3: 'Use the account token + API key to send messages'
        },
        qrCodeUrl: `/api/auth/qr-user/${accountToken}`,
        tokenCheckUrl: `/api/auth/user-token-status/${accountToken}`
      });

    } catch (error) {
      console.error('Failed to start user QR account creation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start WhatsApp account creation';

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // Display QR code for user WhatsApp account creation
  static async displayQR(req: Request, res: Response): Promise<void> {
    try {
      const { accountToken } = req.params;

      if (!accountToken) {
        res.status(400).send('Account token is required');
        return;
      }

      // Get pending QR code
      const { getPendingQRCode } = await import('../whatsapp/index.js');
      const qrCode = getPendingQRCode(accountToken);

      if (!qrCode) {
        res.status(404).send(`
          <html>
            <head><title>QR Code Not Found</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>❌ QR Code Not Found</h1>
              <p>No QR code available for account token: <strong>${accountToken}</strong></p>
              <p>The session may have expired or been completed.</p>
              <p><a href="/api/auth/start-qr-with-user">Start New Session</a></p>
            </body>
          </html>
        `);
        return;
      }

      // Send HTML page with QR code
      res.send(`
        <html>
          <head>
            <title>Connect WhatsApp - ${accountToken}</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                font-family: Arial, sans-serif;
                text-align: center;
                padding: 20px;
                background-color: #f5f5f5;
              }
              .container {
                max-width: 500px;
                margin: 0 auto;
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .qr-code {
                margin: 20px 0;
                border: 3px solid #25D366;
                padding: 10px;
                border-radius: 10px;
                background: white;
              }
              .qr-code img {
                max-width: 100%;
                height: auto;
              }
              .instructions {
                background: #e8f5e8;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
                text-align: left;
              }
              .status {
                font-weight: bold;
                color: #25D366;
              }
              .refresh {
                margin-top: 20px;
              }
              .refresh button {
                background: #25D366;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
              }
              .refresh button:hover {
                background: #128C7E;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>📱 Connect Your WhatsApp</h1>
              <div class="status">Account Token: <strong>${accountToken}</strong></div>

              <div class="instructions">
                <h3>📋 How to connect:</h3>
                <ol>
                  <li>Open WhatsApp on your phone</li>
                  <li>Go to <strong>Settings → Linked Devices</strong></li>
                  <li>Tap <strong>"Link a device"</strong></li>
                  <li>Scan the QR code below</li>
                  <li>Wait for connection to complete</li>
                </ol>
              </div>

              <div class="qr-code">
                <img src="${qrCode}" alt="WhatsApp QR Code" />
              </div>

              <div class="refresh">
                <button onclick="location.reload()">🔄 Refresh QR Code</button>
              </div>

              <p><small>QR code expires in 60 seconds. This page will refresh automatically.</small></p>

              <script>
                // Auto-refresh every 20 seconds
                setTimeout(() => {
                  location.reload();
                }, 20000);
              </script>
            </div>
          </body>
        </html>
      `);

    } catch (error) {
      console.error('Error displaying QR:', error);
      res.status(500).send('Internal server error');
    }
  }

  // Check WhatsApp connection status for user account
  static async checkConnectionStatus(req: Request, res: Response): Promise<void> {
    try {
      const { accountToken } = req.params;

      if (!accountToken) {
        res.status(400).json({
          success: false,
          error: 'Account token is required'
        });
        return;
      }

      // Check if QR session is still pending
      const pendingSession = getPendingSession(accountToken);
      if (pendingSession) {
        res.status(200).json({
          success: false,
          message: 'WhatsApp connection in progress',
          status: 'pending',
          instructions: 'Please complete QR code scanning first'
        });
        return;
      }

      // Check if WhatsApp account has been created and connected
      const whatsappAccount = await WhatsAppAccountService.getWhatsAppAccount(accountToken);
      if (whatsappAccount && whatsappAccount.isConnected) {
        // Get the user details
        const user = await UserService.getUserById(whatsappAccount.userId);
        if (!user) {
          res.status(404).json({
            success: false,
            message: 'User not found for this account',
            status: 'error'
          });
          return;
        }

        res.status(200).json({
          success: true,
          message: 'WhatsApp account connected successfully!',
          status: 'ready',
          account: {
            accountToken: accountToken,
            phoneNumber: whatsappAccount.phoneNumber,
            whatsappName: whatsappAccount.whatsappName,
            isConnected: whatsappAccount.isConnected,
            createdAt: whatsappAccount.createdAt
          },
          user: {
            mobile: user.mobile,
            apiKey: user.apiKey
          },
          usage: {
            sendMessages: 'POST /api/send-message',
            templates: 'GET /api/templates',
            checkStatus: 'GET /api/account/' + accountToken + '/status'
          },
          instructions: {
            step1: 'Use your API key in X-API-Key header',
            step2: 'Include account token in Authorization Bearer header',
            step3: 'Send WhatsApp messages'
          },
          exampleMessage: {
            url: 'POST /api/send-message',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': user.apiKey,
              'Authorization': `Bearer ${accountToken}`
            },
            body: {
              to: '+1234567890',
              message: 'Hello from my WhatsApp API!'
            }
          }
        });
        return;
      }

      // Account not found or not connected
      res.status(404).json({
        success: false,
        message: 'WhatsApp account not found or not connected',
        status: 'not_found',
        instructions: 'Please start a new QR session with your API key: POST /api/auth/start-qr-with-user'
      });

    } catch (error) {
      console.error('Error checking user token status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to check account status';

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // Get user profile and statistics
  static async getUserProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      // Get authenticated user from middleware
      const authenticatedUser = (req as any).user;
      if (!authenticatedUser) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Authorization check: Users can only view their own profile
      if (authenticatedUser.id !== parseInt(userId)) {
        res.status(403).json({
          success: false,
          error: 'Access denied: You can only view your own profile'
        });
        return;
      }

      const user = await UserService.getUserById(parseInt(userId));
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      const stats = await WhatsAppAccountService.getUserWhatsAppStatistics(parseInt(userId));

      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          mobile: user.mobile,
          apiKey: user.apiKey,
          role: user.role,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
          isActive: user.isActive
        },
        statistics: stats
      });

    } catch (error) {
      console.error('Error getting user profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get user profile';

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // Get user profile by API key (for frontend use)
  static async getProfileByApiKey(req: Request, res: Response): Promise<void> {
    try {
      const apiKey = req.headers['x-api-key'] as string;

      if (!apiKey) {
        res.status(401).json({
          success: false,
          error: 'API key is required'
        });
        return;
      }

      const user = await UserService.validateApiKey(apiKey);
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Invalid API key'
        });
        return;
      }

      const stats = await WhatsAppAccountService.getUserWhatsAppStatistics(user.id);

      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          mobile: user.mobile,
          apiKey: user.apiKey,
          role: user.role,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
          isActive: user.isActive
        },
        statistics: stats
      });

    } catch (error) {
      console.error('Error getting user profile by API key:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get user profile';

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // Get user's WhatsApp accounts
  static async getUserWhatsAppAccounts(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      // Get authenticated user from middleware
      const authenticatedUser = (req as any).user;
      if (!authenticatedUser) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Authorization check: Users can only view their own WhatsApp accounts
      if (authenticatedUser.id !== parseInt(userId)) {
        res.status(403).json({
          success: false,
          error: 'Access denied: You can only view your own WhatsApp accounts'
        });
        return;
      }

      const accounts = await WhatsAppAccountService.getUserWhatsAppAccounts(parseInt(userId));

      res.status(200).json({
        success: true,
        accounts: accounts.map(account => ({
          id: account.id,
          userId: account.userId,
          accountToken: account.accountToken,
          phoneNumber: account.phoneNumber,
          whatsappName: account.whatsappName,
          isConnected: account.isConnected,
          createdAt: account.createdAt
        }))
      });

    } catch (error) {
      console.error('Error getting user WhatsApp accounts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get WhatsApp accounts';

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // Get user's connected WhatsApp accounts
  static async getUserConnectedAccounts(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      // Get authenticated user from middleware
      const authenticatedUser = (req as any).user;
      if (!authenticatedUser) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Authorization check: Users can only view their own connected WhatsApp accounts
      if (authenticatedUser.id !== parseInt(userId)) {
        res.status(403).json({
          success: false,
          error: 'Access denied: You can only view your own connected WhatsApp accounts'
        });
        return;
      }

      const accounts = await WhatsAppAccountService.getUserWhatsAppAccounts(parseInt(userId));
      const connectedAccounts = accounts.filter(account => account.isConnected);

      res.status(200).json({
        success: true,
        accounts: connectedAccounts.map(account => ({
          id: account.id,
          userId: account.userId,
          accountToken: account.accountToken,
          phoneNumber: account.phoneNumber,
          whatsappName: account.whatsappName,
          isConnected: account.isConnected,
          createdAt: account.createdAt
        }))
      });

    } catch (error) {
      console.error('Error getting user connected WhatsApp accounts:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get connected WhatsApp accounts';

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // Create new WhatsApp account for user
  static async createWhatsAppAccount(req: Request, res: Response): Promise<void> {
    try {
      console.log('📝 [CREATE ACCOUNT] Request received');
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
        return;
      }

      // Get user from request (added by apiKeyMiddleware)
      const user = (req as any).user;
      if (!user || user.id !== parseInt(userId)) {
        res.status(403).json({
          success: false,
          error: 'Access denied: You can only create accounts for yourself'
        });
        return;
      }

      // Create WhatsApp account for this user
      console.log('✨ Creating WhatsApp account for user:', userId);
      const result = await WhatsAppAccountService.createWhatsAppAccount(parseInt(userId));
      console.log('✅ Service returned:', JSON.stringify(result));

      const { account, accountToken } = result;
      console.log('📦 Account Token:', accountToken);

      // Initialize WhatsApp client for this account
      await initializeQRClient(accountToken);

      const responsePayload = {
        success: true,
        message: 'WhatsApp account created successfully',
        account: {
          id: account.id,
          userId: account.userId,
          accountToken: accountToken,
          phoneNumber: account.phoneNumber || null,
          whatsappName: account.whatsappName || null,
          isConnected: account.isConnected,
          createdAt: account.createdAt
        }
      };

      console.log('📤 Sending response:', JSON.stringify(responsePayload));
      res.status(201).json(responsePayload);

    } catch (error) {
      console.error('❌ Error creating WhatsApp account:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create WhatsApp account';

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // Get QR code for WhatsApp account
  static async getQRCode(req: Request, res: Response): Promise<void> {
    try {
      const { accountToken } = req.params;

      if (!accountToken) {
        res.status(400).json({
          success: false,
          error: 'Account token is required'
        });
        return;
      }

      // Check if WhatsApp account exists
      const whatsappAccount = await WhatsAppAccountService.getWhatsAppAccount(accountToken);
      if (!whatsappAccount) {
        res.status(404).json({
          success: false,
          error: 'WhatsApp account not found'
        });
        return;
      }

      // Check if already connected
      if (whatsappAccount.isConnected) {
        res.status(200).json({
          success: true,
          qrCode: null,
          accountToken: accountToken,
          isConnected: true,
          message: 'Account is already connected'
        });
        return;
      }

      // Get API key from request (added by middleware)
      const apiKey = req.headers['x-api-key'] as string;
      if (!apiKey) {
        res.status(401).json({
          success: false,
          error: 'API key is required'
        });
        return;
      }

      // Try to get existing QR code from pending sessions
      let qrCode = getPendingQRCode(accountToken);

      // If no QR code exists, initialize WhatsApp client to generate one
      if (!qrCode) {
        console.log(`[${accountToken}] No QR code found, initializing WhatsApp client...`);

        // IMPORTANT: Store pending session BEFORE initializing QR client
        // This is needed so that when the QR is scanned, we can update the database
        storePendingSession(accountToken, apiKey);
        console.log(`[${accountToken}] ✅ Pending session stored with API key`);

        // Initialize the client (this will generate QR code asynchronously)
        await initializeQRClient(accountToken);

        // Wait a bit for QR code to be generated (Baileys generates it asynchronously)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Try to get QR code again
        qrCode = getPendingQRCode(accountToken);
      }

      res.status(200).json({
        success: true,
        qrCode: qrCode || null,
        accountToken: accountToken,
        isConnected: false,
        message: qrCode ? 'QR code ready' : 'QR code is being generated, please retry in a moment'
      });

    } catch (error) {
      console.error('Error getting QR code:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get QR code';

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // Get WhatsApp connection status
  static async getWhatsAppStatus(req: Request, res: Response): Promise<void> {
    try {
      const { accountToken } = req.params;

      if (!accountToken) {
        res.status(400).json({
          success: false,
          error: 'Account token is required'
        });
        return;
      }

      // Check if WhatsApp account exists and is connected
      const whatsappAccount = await WhatsAppAccountService.getWhatsAppAccount(accountToken);

      if (!whatsappAccount) {
        res.status(404).json({
          success: false,
          error: 'WhatsApp account not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        isConnected: whatsappAccount.isConnected,
        phoneNumber: whatsappAccount.phoneNumber,
        whatsappName: whatsappAccount.whatsappName,
        accountToken: accountToken
      });

    } catch (error) {
      console.error('Error checking WhatsApp status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to check WhatsApp status';

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // Delete WhatsApp account
  static async deleteWhatsAppAccount(req: Request, res: Response): Promise<void> {
    try {
      const { accountToken } = req.params;

      if (!accountToken) {
        res.status(400).json({
          success: false,
          error: 'Account token is required'
        });
        return;
      }

      // Get authenticated user from middleware
      const authenticatedUser = (req as any).user;
      if (!authenticatedUser) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Get the account to verify ownership
      const account = await WhatsAppAccountService.getWhatsAppAccount(accountToken);
      if (!account) {
        res.status(404).json({
          success: false,
          error: 'WhatsApp account not found'
        });
        return;
      }

      // Authorization check: Users can only delete their own accounts
      if (account.userId !== authenticatedUser.id) {
        res.status(403).json({
          success: false,
          error: 'Access denied: You can only delete your own accounts'
        });
        return;
      }

      // Delete the account
      await WhatsAppAccountService.deleteWhatsAppAccount(accountToken);

      res.status(200).json({
        success: true,
        message: 'WhatsApp account deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting WhatsApp account:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete WhatsApp account';

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }

  // Relink WhatsApp account (when disconnected)
  static async relinkWhatsAppAccount(req: Request, res: Response): Promise<void> {
    try {
      const { accountToken } = req.params;

      if (!accountToken) {
        res.status(400).json({
          success: false,
          error: 'Account token is required'
        });
        return;
      }

      // Get authenticated user from middleware
      const authenticatedUser = (req as any).user;
      if (!authenticatedUser) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // Get the account to verify ownership
      const account = await WhatsAppAccountService.getWhatsAppAccount(accountToken);
      if (!account) {
        res.status(404).json({
          success: false,
          error: 'WhatsApp account not found'
        });
        return;
      }

      // Authorization check: Users can only relink their own accounts
      if (account.userId !== authenticatedUser.id) {
        res.status(403).json({
          success: false,
          error: 'Access denied: You can only relink your own accounts'
        });
        return;
      }

      // Check if account is already connected
      if (account.isConnected) {
        res.status(400).json({
          success: false,
          error: 'Account is already connected. No need to relink.',
          isConnected: true
        });
        return;
      }

      // Store pending session for QR tracking (reuse existing pending session mechanism)
      const user = await UserService.getUserById(account.userId);
      if (!user || !user.apiKey) {
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve user API key'
        });
        return;
      }

      storePendingSession(accountToken, user.apiKey);

      // Initialize WhatsApp QR client for relinking
      await initializeQRClient(accountToken);

      res.status(200).json({
        success: true,
        message: 'WhatsApp account relinking started',
        account: {
          id: account.id,
          accountToken: accountToken,
          phoneNumber: account.phoneNumber,
          whatsappName: account.whatsappName,
          isConnected: false
        },
        instructions: {
          step1: 'Scan QR code to reconnect your WhatsApp',
          step2: 'After successful scan, your WhatsApp account will be reconnected',
          step3: 'You can then resume sending messages'
        },
        qrCodeUrl: `/api/auth/qr-user/${accountToken}`,
        statusCheckUrl: `/api/auth/user-token-status/${accountToken}`
      });

    } catch (error) {
      console.error('Error relinking WhatsApp account:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to relink WhatsApp account';

      res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  }
}