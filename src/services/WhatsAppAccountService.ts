import { WhatsAppAccountModel, IWhatsAppAccount, ICreateWhatsAppAccountData } from '../models/WhatsAppAccount.js';
import { UserService } from './UserService.js';
import { EmailService } from './EmailService.js';

export interface ICreateWhatsAppAccountResult {
  account: IWhatsAppAccount;
  accountToken: string;
}

export interface IWhatsAppConnectionResult {
  success: boolean;
  account?: IWhatsAppAccount;
  user?: any;
  error?: string;
}

export class WhatsAppAccountService {
  // Generate unique account token
  static generateAccountToken(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 18).replace(/-/g, '').substring(0, 16);
    return `acc_${timestamp}_${randomPart}`;
  }

  // Create WhatsApp account for user
  static async createWhatsAppAccount(userId: number): Promise<ICreateWhatsAppAccountResult> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Verify user exists and is active
    const user = await UserService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('User account is deactivated');
    }

    const accountToken = this.generateAccountToken();

    // Check if account token already exists (extremely unlikely but possible)
    const tokenExists = await WhatsAppAccountModel.tokenExists(accountToken);
    if (tokenExists) {
      // Regenerate token if collision occurs
      return this.createWhatsAppAccount(userId);
    }

    const accountData: ICreateWhatsAppAccountData = {
      userId,
      accountToken
    };

    const account = await WhatsAppAccountModel.create(accountData);

    return {
      account,
      accountToken
    };
  }

  // Get WhatsApp account by token
  static async getWhatsAppAccount(accountToken: string): Promise<IWhatsAppAccount | null> {
    if (!accountToken || typeof accountToken !== 'string') {
      return null;
    }

    // Basic account token format validation
    if (!accountToken.startsWith('acc_') || accountToken.length < 20) {
      return null;
    }

    return await WhatsAppAccountModel.findByToken(accountToken);
  }

  // Get WhatsApp account with user details
  static async getWhatsAppAccountWithUser(accountToken: string): Promise<{
    account: IWhatsAppAccount | null;
    user: any;
  }> {
    const account = await this.getWhatsAppAccount(accountToken);
    let user = null;

    if (account) {
      user = await UserService.getUserById(account.userId);
    }

    return { account, user };
  }

  // Get all WhatsApp accounts for a user
  static async getUserWhatsAppAccounts(userId: number): Promise<IWhatsAppAccount[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Verify user exists
    const user = await UserService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return await WhatsAppAccountModel.findByUserId(userId);
  }

  // Get connected WhatsApp accounts for a user
  static async getConnectedWhatsAppAccounts(userId: number): Promise<IWhatsAppAccount[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Verify user exists
    const user = await UserService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return await WhatsAppAccountModel.findConnectedByUserId(userId);
  }

  // Update WhatsApp connection details after QR scan
  static async updateWhatsAppConnectionDetails(
    accountToken: string,
    phoneNumber: string,
    whatsappName: string
  ): Promise<boolean> {
    if (!accountToken || !phoneNumber || !whatsappName) {
      throw new Error('Account token, phone number, and WhatsApp name are required');
    }

    // Validate phone number format
    if (!/^\+?\d{10,15}$/.test(phoneNumber)) {
      throw new Error('Invalid phone number format');
    }

    // Verify account exists
    const account = await this.getWhatsAppAccount(accountToken);
    if (!account) {
      throw new Error('WhatsApp account not found');
    }

    return await WhatsAppAccountModel.updateConnectionDetails(
      accountToken,
      phoneNumber,
      whatsappName
    );
  }

  // Mark WhatsApp account as connected
  static async markAsConnected(accountToken: string): Promise<boolean> {
    if (!accountToken) {
      throw new Error('Account token is required');
    }

    // Verify account exists
    const account = await this.getWhatsAppAccount(accountToken);
    if (!account) {
      throw new Error('WhatsApp account not found');
    }

    return await WhatsAppAccountModel.markAsConnected(accountToken);
  }

  // Mark WhatsApp account as disconnected
  static async markAsDisconnected(accountToken: string, sendEmail: boolean = false): Promise<boolean> {
    if (!accountToken) {
      throw new Error('Account token is required');
    }

    // Get account and user information for email notification
    const { account, user } = await this.getWhatsAppAccountWithUser(accountToken);

    if (!account) {
      throw new Error('WhatsApp account not found');
    }

    // Check if account was already disconnected (to avoid duplicate emails on reconnection attempts)
    const wasAlreadyDisconnected = !account.isConnected;

    // Mark as disconnected in database
    const result = await WhatsAppAccountModel.markAsDisconnected(accountToken);

    // Send email notification ONLY if:
    // 1. sendEmail flag is true (permanent disconnection)
    // 2. Account was previously connected (status changed from connected to disconnected)
    // 3. User has an email address
    if (sendEmail && !wasAlreadyDisconnected && result && user && user.email) {
      // Send email asynchronously without waiting for it
      EmailService.sendDisconnectionNotification(
        user.email,
        user.name,
        account.phoneNumber,
        account.whatsappName,
        accountToken
      ).catch(error => {
        console.error(`[${accountToken}] ⚠️  Failed to send disconnection email to ${user.email}:`, error);
      });

      console.log(`[${accountToken}] 📧 Sending disconnection notification email to ${user.email}`);
    } else if (sendEmail && wasAlreadyDisconnected) {
      console.log(`[${accountToken}] ℹ️  Account was already disconnected. Skipping duplicate email.`);
    } else if (!sendEmail) {
      console.log(`[${accountToken}] ℹ️  Temporary disconnection (will auto-reconnect). Skipping email.`);
    }

    return result;
  }

  // Check if WhatsApp account is connected
  static async isWhatsAppConnected(accountToken: string): Promise<boolean> {
    if (!accountToken) {
      return false;
    }

    const account = await this.getWhatsAppAccount(accountToken);
    return account ? account.isConnected : false;
  }

  // Validate WhatsApp account connection for messaging
  static async validateWhatsAppConnection(accountToken: string): Promise<IWhatsAppConnectionResult> {
    try {
      // Get account and user details
      const { account, user } = await this.getWhatsAppAccountWithUser(accountToken);

      if (!account) {
        return {
          success: false,
          error: 'WhatsApp account not found'
        };
      }

      if (!user) {
        return {
          success: false,
          error: 'Associated user not found'
        };
      }

      if (!user.isActive) {
        return {
          success: false,
          error: 'User account is deactivated'
        };
      }

      if (!account.isConnected) {
        return {
          success: false,
          error: 'WhatsApp account not connected. Please scan QR code first.'
        };
      }

      return {
        success: true,
        account,
        user
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Delete WhatsApp account
  static async deleteWhatsAppAccount(accountToken: string): Promise<boolean> {
    if (!accountToken) {
      throw new Error('Account token is required');
    }

    // Get account first
    const account = await this.getWhatsAppAccount(accountToken);
    if (!account) {
      throw new Error('WhatsApp account not found');
    }

    return await WhatsAppAccountModel.delete(account.id);
  }

  // Get WhatsApp account statistics
  static async getAccountStatistics(accountToken: string): Promise<{
    isConnected: boolean;
    phoneNumber?: string;
    whatsappName?: string;
    createdAt: Date;
    userMobile: string;
    userCreatedAt: Date;
  }> {
    const { account, user } = await this.getWhatsAppAccountWithUser(accountToken);

    if (!account || !user) {
      throw new Error('WhatsApp account or user not found');
    }

    if (!account.isConnected || !account.phoneNumber || !account.whatsappName) {
      throw new Error('WhatsApp account is not connected');
    }

    return {
      isConnected: account.isConnected,
      phoneNumber: account.phoneNumber,
      whatsappName: account.whatsappName,
      createdAt: account.createdAt,
      userMobile: user.mobile,
      userCreatedAt: user.createdAt
    };
  }

  // Get all WhatsApp accounts (for admin purposes)
  static async getAllWhatsAppAccounts(limit = 50, offset = 0): Promise<IWhatsAppAccount[]> {
    return await WhatsAppAccountModel.findAll(limit, offset);
  }

  // Search WhatsApp accounts by phone number (for admin purposes)
  static async searchWhatsAppAccounts(phonePattern: string, limit = 20): Promise<IWhatsAppAccount[]> {
    if (!phonePattern || phonePattern.length < 3) {
      throw new Error('Search pattern must be at least 3 characters');
    }

    // For now, use findAll and filter in the service
    // In a production environment, you'd want to add a proper search method to the WhatsAppAccount model
    const allAccounts = await WhatsAppAccountModel.findAll(limit, 0);
    return allAccounts.filter(account =>
      account.phoneNumber && account.phoneNumber.includes(phonePattern)
    );
  }

  // Get user's WhatsApp account statistics
  static async getUserWhatsAppStatistics(userId: number): Promise<{
    totalAccounts: number;
    connectedAccounts: number;
    disconnectedAccounts: number;
    recentlyConnected?: IWhatsAppAccount;
  }> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const stats = await WhatsAppAccountModel.getAccountStats(userId);
    const connectedAccounts = await WhatsAppAccountModel.findConnectedByUserId(userId);

    const recentlyConnected = connectedAccounts.length > 0 ? connectedAccounts[0] : undefined;

    return {
      ...stats,
      ...(recentlyConnected && { recentlyConnected })
    };
  }

  // Delete WhatsApp account
  static async deleteWhatsAppAccount(accountToken: string): Promise<void> {
    if (!accountToken) {
      throw new Error('Account token is required');
    }

    // Delete the account from database
    await WhatsAppAccountModel.deleteAccount(accountToken);

    // TODO: Also delete session data from database
    // TODO: Disconnect WhatsApp client if connected
  }
}