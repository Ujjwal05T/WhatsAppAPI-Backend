import express from 'express';
import { initializeAccounts } from './services/legacyAccountManager.js';
import { PrismaService } from './config/index.js';
import { AuthController } from './controllers/AuthController.js';
import { MessagingController } from './controllers/MessagingController.js';
import { authMiddleware } from './authMiddleware.js';
import { apiKeyMiddleware } from './apiKeyMiddleware.js';
import { userAuthMiddleware } from './middleware/userAuth.js';
import { upload } from './middleware/upload.js';
import cors from 'cors'

const app = express();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

app.use(express.json());

const PORT = process.env.PORT || 5000;

// Initialize database and accounts on startup
PrismaService.initialize().then(() => {
  console.log('✅ Database connected successfully');
  initializeAccounts().catch(console.error);
}).catch(console.error);

// Simple in-memory template storage (in production, use database)
const templates = new Map<string, string>();

// Add some default templates
templates.set('welcome', 'Hello {{name}}! Welcome to our service. Thank you for joining!');
templates.set('appointment', 'Hi {{name}}, this is a reminder about your appointment on {{date}} at {{time}}.');
templates.set('greeting', 'Hello {{name}}, how are you today?');
templates.set('promotion', 'Hi {{name}}, check out our special offer: {{offer}}!');
templates.set('reminder', 'Hi {{name}}, this is a reminder about {{event}} on {{date}}.');

// =================================================================
// USER AUTHENTICATION ENDPOINTS
// =================================================================

/**
 * @route   POST /api/auth/register
 * @desc    Register new user with mobile number and password
 * @access  Public
 * @body    { "mobile": "+1234567890", "password": "password123" }
 */
app.post('/api/auth/register', AuthController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get API key
 * @access  Public
 * @body    { "mobile": "+1234567890", "password": "password123" }
 */
app.post('/api/auth/login', AuthController.login);

/**
 * @route   POST /api/auth/start-qr-with-user
 * @desc    Start QR-based WhatsApp account creation for registered user
 * @access  Public (but requires API key)
 * @body    { "apiKey": "your_api_key" }
 */
app.post('/api/auth/start-qr-with-user', AuthController.startWhatsAppQR);

/**
 * @route   GET /api/auth/qr-user/:accountToken
 * @desc    Display QR code for user WhatsApp account creation
 * @access  Public (accountToken acts as temporary auth)
 */
app.get('/api/auth/qr-user/:accountToken', AuthController.displayQR);

/**
 * @route   GET /api/auth/user-token-status/:accountToken
 * @desc    Check WhatsApp connection status for user account
 * @access  Public (accountToken acts as temporary auth)
 */
app.get('/api/auth/user-token-status/:accountToken', AuthController.checkConnectionStatus);

/**
 * @route   GET /api/auth/user/:userId/profile
 * @desc    Get user profile and statistics
 * @access  Private (Requires API Key)
 */
app.get('/api/auth/user/:userId/profile', userAuthMiddleware, AuthController.getUserProfile);

/**
 * @route   GET /api/auth/profile
 * @desc    Get user profile by API key (for frontend)
 * @access  Private (Requires API Key in header)
 */
app.get('/api/auth/profile', apiKeyMiddleware, AuthController.getProfileByApiKey);

/**
 * @route   GET /api/auth/user/:userId/whatsapp-accounts
 * @desc    Get user's WhatsApp accounts
 * @access  Private (Requires API Key)
 */
app.get('/api/auth/user/:userId/whatsapp-accounts', userAuthMiddleware, AuthController.getUserWhatsAppAccounts);

/**
 * @route   GET /api/whatsapp/accounts/:userId
 * @desc    Get user's WhatsApp accounts (frontend compatible)
 * @access  Private (Requires API Key)
 */
app.get('/api/whatsapp/accounts/:userId', apiKeyMiddleware, AuthController.getUserWhatsAppAccounts);

/**
 * @route   GET /api/whatsapp/connected/:userId
 * @desc    Get user's connected WhatsApp accounts
 * @access  Private (Requires API Key)
 */
app.get('/api/whatsapp/connected/:userId', apiKeyMiddleware, AuthController.getUserConnectedAccounts);

/**
 * @route   POST /api/whatsapp/create-account
 * @desc    Create new WhatsApp account for user
 * @access  Private (Requires API Key)
 */
app.post('/api/whatsapp/create-account', apiKeyMiddleware, AuthController.createWhatsAppAccount);

/**
 * @route   GET /api/whatsapp/qr/:accountToken
 * @desc    Get QR code for WhatsApp account
 * @access  Private (Requires API Key)
 */
app.get('/api/whatsapp/qr/:accountToken', apiKeyMiddleware, AuthController.getQRCode);

/**
 * @route   GET /api/whatsapp/status/:accountToken
 * @desc    Check WhatsApp connection status
 * @access  Private (Requires API Key)
 */
app.get('/api/whatsapp/status/:accountToken', apiKeyMiddleware, AuthController.getWhatsAppStatus);

// =================================================================
// MESSAGING ENDPOINTS
// =================================================================

/**
 * @route   POST /api/send-message
 * @desc    Sends a WhatsApp message using Baileys
 * @access  Private (Requires X-API-Key header and Authorization Bearer token)
 * @headers X-API-Key: your_api_key
 *          Authorization: Bearer account_token
 * @body    {
 *            "to": "+1234567890",
 *            "message": "Hello!" OR
 *            "template": "welcome",
 *            "templateData": {"name": "John"}
 *          }
 */
app.post('/api/send-message', authMiddleware, MessagingController.sendMessage);

/**
 * @route   POST /api/send-media
 * @desc    Sends a WhatsApp media message (image, video, audio, document)
 * @access  Private (Requires X-API-Key header and Authorization Bearer token)
 * @headers X-API-Key: your_api_key
 *          Authorization: Bearer account_token
 * @body    FormData {
 *            "to": "+1234567890",
 *            "file": <media file>,
 *            "caption": "Optional caption for image/video/document"
 *          }
 */
app.post('/api/send-media', upload.single('file'), authMiddleware, MessagingController.sendMedia);

/**
 * @route   GET /api/templates
 * @desc    Get all available message templates
 * @access  Private (Requires API Key)
 */
app.get('/api/templates', authMiddleware, MessagingController.getTemplates);

/**
 * @route   POST /api/templates
 * @desc    Add a new message template
 * @access  Private (Requires API Key)
 * @body    { "name": "greeting", "template": "Hello {{name}}, how are you?" }
 */
app.post('/api/templates', authMiddleware, MessagingController.createTemplate);

/**
 * @route   DELETE /api/templates/:name
 * @desc    Delete a message template
 * @access  Private (Requires API Key)
 */
app.delete('/api/templates/:name', authMiddleware, MessagingController.deleteTemplate);

/**
 * @route   GET /api/account/:token/status
 * @desc    Check WhatsApp connection status for an account
 * @access  Private (Requires API Key)
 */
app.get('/api/account/:token/status', authMiddleware, MessagingController.getAccountStatus);

/**
 * @route   GET /api/account/:token/messages
 * @desc    Get message history for an account
 * @access  Private (Requires API Key)
 */
app.get('/api/account/:token/messages', authMiddleware, MessagingController.getMessageHistory);

// =================================================================
// UTILITY ENDPOINTS
// =================================================================

/**
 * @route   GET /api/health
 * @desc    Health check endpoint
 * @access  Public
 */
app.get('/api/health', (_req, res) => {
  return res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
    features: {
      userRegistration: true,
      whatsappIntegration: true,
      messageTemplates: true,
      mediaMessages: true,
      rateLimiting: true,
      databaseStorage: true
    }
  });
});

/**
 * @route   GET /api/docs
 * @desc    API documentation
 * @access  Public
 */
app.get('/api/docs', (_req, res) => {
  res.json({
    title: 'WhatsApp API Documentation',
    version: '2.0.0',
    description: 'WhatsApp Business API with user registration and multi-account support',
    endpoints: {
      authentication: {
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/login': 'User login',
        'POST /api/auth/start-qr-with-user': 'Start WhatsApp connection',
        'GET /api/auth/qr-user/:accountToken': 'Display QR code',
        'GET /api/auth/user-token-status/:accountToken': 'Check connection status',
        'GET /api/auth/user/:userId/profile': 'Get user profile',
        'GET /api/auth/profile': 'Get user profile by API key (frontend)',
        'GET /api/auth/user/:userId/whatsapp-accounts': 'Get user WhatsApp accounts'
      },
      messaging: {
        'POST /api/send-message': 'Send WhatsApp text message',
        'POST /api/send-media': 'Send WhatsApp media message (image, video, audio, document)',
        'GET /api/templates': 'List message templates',
        'POST /api/templates': 'Create message template',
        'DELETE /api/templates/:name': 'Delete message template',
        'GET /api/account/:token/status': 'Check account status',
        'GET /api/account/:token/messages': 'Get message history'
      },
      utilities: {
        'GET /api/health': 'Health check',
        'GET /api/docs': 'API documentation'
      }
    }
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

app.listen(PORT, () => {
  console.log(`🚀 WhatsApp API Server is running on http://localhost:${PORT}`);
  console.log(`📋 Endpoints:`);
  console.log(`\n🔐 USER AUTHENTICATION:`);
  console.log(`   POST /api/auth/register - Register new user`);
  console.log(`   POST /api/auth/login - User login`);
  console.log(`\n📱 WHATSAPP CONNECTION:`);
  console.log(`   POST /api/auth/start-qr-with-user - Start QR for registered user`);
  console.log(`   GET  /api/auth/qr-user/:accountToken - Display QR for user`);
  console.log(`   GET  /api/auth/user-token-status/:accountToken - Check connection status`);
  console.log(`\n💬 MESSAGING:`);
  console.log(`   POST /api/send-message - Send WhatsApp text messages`);
  console.log(`   POST /api/send-media - Send WhatsApp media (image/video/audio/document)`);
  console.log(`   GET  /api/templates - List message templates`);
  console.log(`   POST /api/templates - Create message templates`);
  console.log(`   GET  /api/account/:token/status - Check account status`);
  console.log(`   GET  /api/account/:token/messages - Get message history`);
  console.log(`\n📱 UTILITIES:`);
  console.log(`   GET  /api/health - Health check`);
  console.log(`   GET  /api/docs - API documentation`);
  console.log(`\n🚀 QUICK START:`);
  console.log(`   1. Register: POST /api/auth/register`);
  console.log(`   2. Start QR: POST /api/auth/start-qr-with-user`);
  console.log(`   3. Scan QR: Open /api/auth/qr-user/{accountToken}`);
  console.log(`   4. Send messages: POST /api/send-message`);
});