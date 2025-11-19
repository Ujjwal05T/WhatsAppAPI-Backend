/**
 * Utility functions for WhatsApp API
 */

// Message validation constraints
export const MESSAGE_LIMITS = {
  MAX_TEXT_LENGTH: 4096, // WhatsApp text message limit
  MAX_RECIPIENTS_PER_REQUEST: 10,
  RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
  MAX_MESSAGES_PER_WINDOW: 30, // WhatsApp-like rate limiting
};

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Normalizes and validates phone number for WhatsApp
 * Handles various formats and automatically adds country code if missing
 *
 * @param phone - Phone number in any format
 * @returns Object with normalized number and validation result
 *
 * Supported formats:
 * - "9876543210" → "919876543210" (auto-adds 91 for 10-digit numbers)
 * - "+919876543210" → "919876543210" (removes +)
 * - "91 9876543210" → "919876543210" (removes spaces)
 * - "+91-9876-543210" → "919876543210" (removes + and -)
 * - "(91) 9876543210" → "919876543210" (removes parentheses)
 *
 * Features:
 * - Removes +, spaces, dashes, parentheses, dots
 * - If exactly 10 digits, adds 91 prefix (Indian numbers)
 * - Validates final number is 10-15 digits
 * - Provides helpful error messages with examples
 */
export function normalizeAndValidatePhoneNumber(phone: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
  original: string;
} {
  const original = phone;

  // Check if phone number is provided
  if (!phone || typeof phone !== 'string') {
    return {
      valid: false,
      error: 'Phone number is required. Example: 9876543210 or +919876543210',
      original
    };
  }

  // Remove all non-digit characters (spaces, +, -, (, ), .)
  let cleaned = phone.trim().replace(/[\s\-\(\)\+\.]/g, '');

  // If still contains non-digit characters, it's invalid
  if (!/^\d+$/.test(cleaned)) {
    return {
      valid: false,
      error: 'Phone number contains invalid characters. Use formats like: 9876543210, +919876543210, or 91-9876543210',
      original
    };
  }

  // Handle exactly 10 digits - add Indian country code (91)
  if (cleaned.length === 10) {
    console.log(`📞 Auto-adding country code 91 to 10-digit number: ${cleaned} → 91${cleaned}`);
    cleaned = '91' + cleaned;
  }

  // Validate length after normalization
  if (cleaned.length < 10) {
    return {
      valid: false,
      error: `Phone number too short (${cleaned.length} digits). Must be at least 10 digits. Example: 9876543210`,
      original
    };
  }

  if (cleaned.length > 15) {
    return {
      valid: false,
      error: `Phone number too long (${cleaned.length} digits). Maximum 15 digits allowed`,
      original
    };
  }

  // Additional validation: Check if it starts with a valid country code
  // For Indian numbers, ensure it starts with 91 and has correct length
  if (cleaned.startsWith('91') && cleaned.length !== 12) {
    return {
      valid: false,
      error: `Invalid Indian phone number (${cleaned.length} digits). Must be 12 digits total: 91 + 10 digit number. Example: 919876543210`,
      original
    };
  }

  return {
    valid: true,
    normalized: cleaned,
    original
  };
}

/**
 * Validates phone number for WhatsApp (legacy function - kept for backward compatibility)
 * Format: Country code + number without spaces or special chars
 * @deprecated Use normalizeAndValidatePhoneNumber instead
 */
export function validatePhoneNumber(phone: string): boolean {
  const result = normalizeAndValidatePhoneNumber(phone);
  return result.valid;
}

/**
 * Validates message content
 */
export function validateMessage(message: string): { valid: boolean; error?: string } {
  if (!message || message.trim().length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (message.length > MESSAGE_LIMITS.MAX_TEXT_LENGTH) {
    return {
      valid: false,
      error: `Message too long. Maximum ${MESSAGE_LIMITS.MAX_TEXT_LENGTH} characters allowed`
    };
  }

  return { valid: true };
}

/**
 * Simple rate limiting for message sending
 */
export function checkRateLimit(token: string): { allowed: boolean; remaining?: number; resetTime?: number } {
  const now = Date.now();
  const key = token;

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // Create new entry
    entry = {
      count: 1,
      resetTime: now + MESSAGE_LIMITS.RATE_LIMIT_WINDOW_MS
    };
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      remaining: MESSAGE_LIMITS.MAX_MESSAGES_PER_WINDOW - 1,
      resetTime: entry.resetTime
    };
  }

  // Check if limit exceeded
  if (entry.count >= MESSAGE_LIMITS.MAX_MESSAGES_PER_WINDOW) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime
    };
  }

  // Increment counter
  entry.count++;
  return {
    allowed: true,
    remaining: MESSAGE_LIMITS.MAX_MESSAGES_PER_WINDOW - entry.count,
    resetTime: entry.resetTime
  };
}

/**
 * Format phone number to WhatsApp JID format
 */
export function formatToJID(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  return `${cleanPhone}@s.whatsapp.net`;
}

/**
 * Generate random delay for human-like behavior (1-3 seconds)
 */
export function humanDelay(): Promise<void> {
  const delay = Math.random() * 2000 + 1000; // 1-3 seconds
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Simple template replacement
 * Replaces {{placeholder}} with values from data object
 */
export function processTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] || match;
  });
}