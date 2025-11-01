import bcrypt from 'bcrypt';
import { UserModel, IUser, ICreateUserData } from '../models/User.js';

export interface IRegistrationData {
  mobile: string;
  password: string;
}

export interface ILoginData {
  mobile: string;
  password: string;
}

export interface IAuthResult {
  user: IUser;
  apiKey: string;
}

export interface IRegistrationResult extends IAuthResult {
  isNewUser: boolean;
}

export class UserService {
  private static readonly SALT_ROUNDS = 10;

  // Generate unique API key
  static generateApiKey(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 18).replace(/-/g, '').substring(0, 16);
    return `api_${timestamp}_${randomPart}`;
  }

  // Validate mobile number format
  static validateMobileNumber(mobile: string): boolean {
    // Accept formats: +1234567890, 1234567890
    const mobileRegex = /^\+?\d{10,15}$/;
    return mobileRegex.test(mobile);
  }

  // Validate password strength
  static validatePassword(password: string): { isValid: boolean; error?: string } {
    if (password.length < 6) {
      return { isValid: false, error: 'Password must be at least 6 characters long' };
    }
    if (password.length > 100) {
      return { isValid: false, error: 'Password must be less than 100 characters' };
    }
    if (!/(?=.*[a-zA-Z])/.test(password)) {
      return { isValid: false, error: 'Password must contain at least one letter' };
    }
    if (!/(?=.*\d)/.test(password)) {
      return { isValid: false, error: 'Password must contain at least one number' };
    }
    return { isValid: true };
  }

  // Hash password
  static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.SALT_ROUNDS);
  }

  // Verify password
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  // Register new user
  static async registerUser(registrationData: IRegistrationData): Promise<IRegistrationResult> {
    const { mobile, password } = registrationData;

    // Validate mobile number
    if (!this.validateMobileNumber(mobile)) {
      throw new Error('Invalid mobile number format. Use: +1234567890');
    }

    // Validate password
    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.error || 'Invalid password');
    }

    // Check if user already exists
    const existingUser = await UserModel.findByMobile(mobile);
    if (existingUser) {
      throw new Error('Mobile number already registered');
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);
    const apiKey = this.generateApiKey();

    // Create user
    const userData: ICreateUserData = {
      mobile,
      passwordHash,
      apiKey
    };

    const user = await UserModel.create(userData);

    return {
      user,
      apiKey,
      isNewUser: true
    };
  }

  // Authenticate user login
  static async authenticateUser(loginData: ILoginData): Promise<IAuthResult> {
    const { mobile, password } = loginData;

    // Validate mobile number
    if (!this.validateMobileNumber(mobile)) {
      throw new Error('Invalid mobile number format');
    }

    // Find user
    const user = await UserModel.findByMobile(mobile);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    // Update last login
    await UserModel.updateLastLogin(user.id);

    // Return updated user object
    const updatedUser = { ...user, lastLogin: new Date() };

    return {
      user: updatedUser,
      apiKey: user.apiKey
    };
  }

  // Validate API key and return user
  static async validateApiKey(apiKey: string): Promise<IUser | null> {
    if (!apiKey || typeof apiKey !== 'string') {
      return null;
    }

    // Basic API key format validation
    if (!apiKey.startsWith('api_') || apiKey.length < 20) {
      return null;
    }

    const user = await UserModel.findByApiKey(apiKey);
    return user && user.isActive ? user : null;
  }

  // Get user by ID
  static async getUserById(userId: number): Promise<IUser | null> {
    if (!userId || typeof userId !== 'number') {
      return null;
    }

    return await UserModel.findById(userId);
  }

  // Get user by mobile
  static async getUserByMobile(mobile: string): Promise<IUser | null> {
    if (!this.validateMobileNumber(mobile)) {
      return null;
    }

    return await UserModel.findByMobile(mobile);
  }

  // Deactivate user
  static async deactivateUser(userId: number): Promise<boolean> {
    if (!userId) {
      return false;
    }

    return await UserModel.deactivate(userId);
  }

  
  // Get user statistics
  static async getUserStats(userId: number): Promise<{
    totalWhatsAppAccounts: number;
    connectedWhatsAppAccounts: number;
    lastLogin?: Date;
  }> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Import here to avoid circular dependency
    const { WhatsAppAccountModel } = await import('../models/WhatsAppAccount.js');
    const user = await UserModel.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const stats = await WhatsAppAccountModel.getAccountStats(userId);

    if(!stats || stats.totalAccounts === undefined || stats.connectedAccounts === undefined || user.lastLogin === undefined) {
      throw new Error('Failed to retrieve WhatsApp account statistics');
    }

    return {
      totalWhatsAppAccounts: stats.totalAccounts,
      connectedWhatsAppAccounts: stats.connectedAccounts,
      lastLogin: user.lastLogin
    };
  }

  // Search users by mobile (for admin purposes)
  static async searchUsers(mobilePattern: string, limit = 20): Promise<IUser[]> {
    if (!mobilePattern || mobilePattern.length < 3) {
      throw new Error('Search pattern must be at least 3 characters');
    }

    // For now, use findAll and filter in the service
    // In a production environment, you'd want to add a proper search method to the User model
    const allUsers = await UserModel.findAll(limit, 0);
    return allUsers.filter(user =>
      user.isActive && user.mobile.includes(mobilePattern)
    );
  }
}