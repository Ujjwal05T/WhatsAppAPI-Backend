import { Request, Response } from 'express';
import { UserService, IRegistrationData, ILoginData } from '../services/UserService.js';
import { WhatsAppAccountService } from '../services/WhatsAppAccountService.js';
import { initializeQRClient } from '../whatsapp/index.js';
import { getPendingSession, storePendingSession } from '../services/legacyAccountManager.js';

export class AuthController {
  // Register new user
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const registrationData: IRegistrationData = req.body;

      // Validate input
      if (!registrationData.mobile || !registrationData.password) {
        res.status(400).json({
          success: false,
          error: 'Mobile number and password are required'
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
          mobile: user.mobile,
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
          mobile: user.mobile,
          apiKey: apiKey,
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
          accountToken: accountToken,
          userId: user.id,
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
            step2: 'Include account token in request body',
            step3: 'Send WhatsApp messages'
          },
          exampleMessage: {
            url: 'POST /api/send-message',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': user.apiKey
            },
            body: {
              to: '+1234567890',
              message: 'Hello from my WhatsApp API!',
              token: accountToken
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
          mobile: user.mobile,
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

      const accounts = await WhatsAppAccountService.getUserWhatsAppAccounts(parseInt(userId));

      res.status(200).json({
        success: true,
        accounts: accounts.map(account => ({
          accountToken: account.accountToken,
          phoneNumber: account.phoneNumber,
          whatsappName: account.whatsappName,
          isConnected: account.isConnected,
          createdAt: account.createdAt
        })),
        totalAccounts: accounts.length,
        connectedAccounts: accounts.filter(acc => acc.isConnected).length
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
}