import { prisma } from '../config/index.js';

export interface IWhatsAppAccount {
  id: number;
  userId: number;
  accountToken: string;
  phoneNumber?: string;
  whatsappName?: string;
  isConnected: boolean;
  createdAt: Date;
}

export interface ICreateWhatsAppAccountData {
  userId: number;
  accountToken: string;
}

export interface IUpdateWhatsAppAccountData {
  phoneNumber?: string;
  whatsappName?: string;
  isConnected?: boolean;
}

export class WhatsAppAccountModel {
  // Create a new WhatsApp account
  static async create(accountData: ICreateWhatsAppAccountData): Promise<IWhatsAppAccount> {
    try {
      const account = await prisma.whatsAppAccount.create({
        data: {
          userId: accountData.userId,
          accountToken: accountData.accountToken,
        },
      });

      return account as IWhatsAppAccount;
    } catch (error) {
      console.error('Error in WhatsAppAccount.create:', error);
      throw error;
    }
  }

  // Find WhatsApp account by token
  static async findByToken(accountToken: string): Promise<IWhatsAppAccount | null> {
    try {
      const account = await prisma.whatsAppAccount.findUnique({
        where: { accountToken },
      });

      return account as IWhatsAppAccount | null;
    } catch (error) {
      console.error('Error in WhatsAppAccount.findByToken:', error);
      throw error;
    }
  }

  // Find WhatsApp accounts by user ID
  static async findByUserId(userId: number): Promise<IWhatsAppAccount[]> {
    try {
      const accounts = await prisma.whatsAppAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      return accounts as IWhatsAppAccount[];
    } catch (error) {
      console.error('Error in WhatsAppAccount.findByUserId:', error);
      throw error;
    }
  }

  // Find WhatsApp account by ID
  static async findById(id: number): Promise<IWhatsAppAccount | null> {
    try {
      const account = await prisma.whatsAppAccount.findUnique({
        where: { id },
      });

      return account as IWhatsAppAccount | null;
    } catch (error) {
      console.error('Error in WhatsAppAccount.findById:', error);
      throw error;
    }
  }

  // Update WhatsApp account
  static async update(id: number, updateData: IUpdateWhatsAppAccountData): Promise<boolean> {
    try {
      if (Object.keys(updateData).length === 0) return false;

      const result = await prisma.whatsAppAccount.update({
        where: { id },
        data: updateData,
      });

      return !!result;
    } catch (error) {
      console.error('Error in WhatsAppAccount.update:', error);
      throw error;
    }
  }

  // Update WhatsApp connection details after QR scan
  static async updateConnectionDetails(
    accountToken: string,
    phoneNumber: string,
    whatsappName: string
  ): Promise<boolean> {
    try {
      const result = await prisma.whatsAppAccount.update({
        where: { accountToken },
        data: {
          phoneNumber,
          whatsappName,
          isConnected: true,
        },
      });

      return !!result;
    } catch (error) {
      console.error('Error in WhatsAppAccount.updateConnectionDetails:', error);
      throw error;
    }
  }

  // Mark account as connected
  static async markAsConnected(accountToken: string): Promise<boolean> {
    try {
      const result = await prisma.whatsAppAccount.update({
        where: { accountToken },
        data: { isConnected: true },
      });

      return !!result;
    } catch (error) {
      console.error('Error in WhatsAppAccount.markAsConnected:', error);
      throw error;
    }
  }

  // Mark account as disconnected
  static async markAsDisconnected(accountToken: string): Promise<boolean> {
    try {
      const result = await prisma.whatsAppAccount.update({
        where: { accountToken },
        data: { isConnected: false },
      });

      return !!result;
    } catch (error) {
      console.error('Error in WhatsAppAccount.markAsDisconnected:', error);
      throw error;
    }
  }

  // Get connected accounts for a user
  static async findConnectedByUserId(userId: number): Promise<IWhatsAppAccount[]> {
    try {
      const accounts = await prisma.whatsAppAccount.findMany({
        where: {
          userId,
          isConnected: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return accounts as IWhatsAppAccount[];
    } catch (error) {
      console.error('Error in WhatsAppAccount.findConnectedByUserId:', error);
      throw error;
    }
  }

  // Get all connected accounts (for session restoration on startup)
  static async findAllConnected(): Promise<IWhatsAppAccount[]> {
    try {
      const accounts = await prisma.whatsAppAccount.findMany({
        where: { isConnected: true },
        orderBy: { createdAt: 'desc' },
      });

      return accounts as IWhatsAppAccount[];
    } catch (error) {
      console.error('Error in WhatsAppAccount.findAllConnected:', error);
      throw error;
    }
  }

  // Check if account token exists
  static async tokenExists(accountToken: string): Promise<boolean> {
    try {
      const count = await prisma.whatsAppAccount.count({
        where: { accountToken },
      });

      return count > 0;
    } catch (error) {
      console.error('Error in WhatsAppAccount.tokenExists:', error);
      throw error;
    }
  }

  // Delete WhatsApp account
  static async delete(id: number): Promise<boolean> {
    try {
      await prisma.whatsAppAccount.delete({
        where: { id },
      });

      return true;
    } catch (error) {
      console.error('Error in WhatsAppAccount.delete:', error);
      return false;
    }
  }

  // Delete WhatsApp account by account token
  static async deleteAccount(accountToken: string): Promise<void> {
    try {
      await prisma.whatsAppAccount.delete({
        where: { accountToken },
      });
    } catch (error) {
      console.error('Error in WhatsAppAccount.deleteAccount:', error);
      throw error;
    }
  }

  // Get all WhatsApp accounts (for admin purposes)
  static async findAll(limit = 50, offset = 0): Promise<IWhatsAppAccount[]> {
    try {
      const accounts = await prisma.whatsAppAccount.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return accounts as IWhatsAppAccount[];
    } catch (error) {
      console.error('Error in WhatsAppAccount.findAll:', error);
      throw error;
    }
  }

  // Get account statistics for a user
  static async getAccountStats(userId: number): Promise<{
    totalAccounts: number;
    connectedAccounts: number;
    disconnectedAccounts: number;
  }> {
    try {
      const totalAccounts = await prisma.whatsAppAccount.count({
        where: { userId },
      });

      const connectedAccounts = await prisma.whatsAppAccount.count({
        where: {
          userId,
          isConnected: true,
        },
      });

      const disconnectedAccounts = totalAccounts - connectedAccounts;

      return {
        totalAccounts,
        connectedAccounts,
        disconnectedAccounts,
      };
    } catch (error) {
      console.error('Error in WhatsAppAccount.getAccountStats:', error);
      throw error;
    }
  }
}
