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
 * Validates phone number for WhatsApp
 * Format: Country code + number without spaces or special chars
 */
export function validatePhoneNumber(phone: string): boolean {
  // Remove any non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');

  // Check if it's between 10-15 digits (typical international format)
  return cleanPhone.length >= 10 && cleanPhone.length <= 15;
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