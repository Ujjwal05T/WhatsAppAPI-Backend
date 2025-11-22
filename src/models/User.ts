import { prisma } from '../config/index.js';

export type UserRole = 'USER' | 'ADMIN';

export interface IUser {
  id: number;
  name: string;
  email: string | null;
  mobile: string;
  passwordHash: string;
  apiKey: string;
  role: UserRole;
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

export interface ICreateUserData {
  name: string;
  email: string;
  mobile: string;
  passwordHash: string;
  apiKey: string;
  role?: UserRole;
}

export interface IUpdateUserData {
  name?: string;
  lastLogin?: Date;
  isActive?: boolean;
  role?: UserRole;
}

export class UserModel {
  // Create a new user
  static async create(userData: ICreateUserData): Promise<IUser> {
    try {
      console.log('🔍 Creating user with data:', { name: userData.name, email: userData.email, mobile: userData.mobile });

      const user = await prisma.user.create({
        data: {
          name: userData.name,
          email: userData.email,
          mobile: userData.mobile,
          passwordHash: userData.passwordHash,
          apiKey: userData.apiKey,
          role: userData.role || 'USER',
        },
      });

      console.log('🔍 User created successfully:', user);
      return user as IUser;
    } catch (error) {
      console.error('Error in User.create:', error);
      throw error;
    }
  }

  // Find user by mobile number
  static async findByMobile(mobile: string): Promise<IUser | null> {
    const maxRetries = 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 Searching for mobile: ${mobile} (attempt ${attempt})`);

        const user = await prisma.user.findUnique({
          where: { mobile },
        });

        console.log('🔍 Query result:', user ? 'User found' : 'No user found');
        return user as IUser | null;
      } catch (error) {
        lastError = error as Error;
        console.error(`Error in User.findByMobile (attempt ${attempt}/${maxRetries}):`, error);

        // If this is not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          console.log(`⏳ Retrying in ${attempt * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    // All retries failed
    console.error('❌ All retry attempts failed in User.findByMobile');
    throw lastError!;
  }

  // Find user by API key
  static async findByApiKey(apiKey: string): Promise<IUser | null> {
    const maxRetries = 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const user = await prisma.user.findUnique({
          where: {
            apiKey,
            isActive: true,
          },
        });

        return user as IUser | null;
      } catch (error) {
        lastError = error as Error;
        console.error(`Error in User.findByApiKey (attempt ${attempt}/${maxRetries}):`, error);

        // If this is not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          console.log(`⏳ Retrying in ${attempt * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    // All retries failed
    console.error('❌ All retry attempts failed in User.findByApiKey');
    throw lastError!;
  }

  // Find user by ID
  static async findById(id: number): Promise<IUser | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });

      return user as IUser | null;
    } catch (error) {
      console.error('Error in User.findById:', error);
      throw error;
    }
  }

  // Update user
  static async update(id: number, updateData: IUpdateUserData): Promise<boolean> {
    try {
      if (Object.keys(updateData).length === 0) return false;

      const result = await prisma.user.update({
        where: { id },
        data: updateData,
      });

      return !!result;
    } catch (error) {
      console.error('Error in User.update:', error);
      throw error;
    }
  }

  // Update last login
  static async updateLastLogin(id: number): Promise<boolean> {
    return this.update(id, { lastLogin: new Date() });
  }

  // Check if mobile number exists
  static async mobileExists(mobile: string): Promise<boolean> {
    try {
      const count = await prisma.user.count({
        where: { mobile },
      });

      return count > 0;
    } catch (error) {
      console.error('Error in User.mobileExists:', error);
      throw error;
    }
  }

  // Check if API key exists
  static async apiKeyExists(apiKey: string): Promise<boolean> {
    try {
      const count = await prisma.user.count({
        where: { apiKey },
      });

      return count > 0;
    } catch (error) {
      console.error('Error in User.apiKeyExists:', error);
      throw error;
    }
  }

  // Deactivate user
  static async deactivate(id: number): Promise<boolean> {
    return this.update(id, { isActive: false });
  }

  // Get all users (for admin purposes)
  static async findAll(limit = 50, offset = 0): Promise<IUser[]> {
    try {
      const users = await prisma.user.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      });

      return users as IUser[];
    } catch (error) {
      console.error('Error in User.findAll:', error);
      throw error;
    }
  }
}
