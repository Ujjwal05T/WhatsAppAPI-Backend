import { AuthenticationCreds, AuthenticationState, SignalDataTypeMap, initAuthCreds, proto } from '@whiskeysockets/baileys';
import { prisma } from '../config/index.js';

/**
 * Database-based auth state for Baileys WhatsApp
 * Replaces file-based useMultiFileAuthState with database storage
 */

type AuthStateKey = keyof SignalDataTypeMap;

/**
 * Helper function to recursively convert Buffers to base64 strings for JSON storage
 */
function bufferToJSON(obj: any): any {
  if (Buffer.isBuffer(obj)) {
    return {
      type: 'Buffer',
      data: obj.toString('base64'),
    };
  } else if (Array.isArray(obj)) {
    return obj.map(bufferToJSON);
  } else if (obj && typeof obj === 'object') {
    // Handle Uint8Array (convert to Buffer first)
    if (obj instanceof Uint8Array) {
      return {
        type: 'Buffer',
        data: Buffer.from(obj).toString('base64'),
      };
    }

    // Handle protobuf objects - convert to plain object first
    if (obj.constructor && obj.constructor.name && obj.constructor.name.includes('Message')) {
      // Convert protobuf message to plain object
      const plainObj: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && !key.startsWith('$')) {
          plainObj[key] = bufferToJSON(obj[key]);
        }
      }
      return plainObj;
    }

    const result: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        result[key] = bufferToJSON(obj[key]);
      }
    }
    return result;
  }
  return obj;
}

/**
 * Helper function to recursively convert base64 strings back to Buffers
 */
function jsonToBuffer(obj: any): any {
  if (obj && typeof obj === 'object') {
    if (obj.type === 'Buffer' && typeof obj.data === 'string') {
      return Buffer.from(obj.data, 'base64');
    } else if (Array.isArray(obj)) {
      return obj.map(jsonToBuffer);
    } else {
      const result: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          result[key] = jsonToBuffer(obj[key]);
        }
      }
      return result;
    }
  }
  return obj;
}

export async function useAuthStateFromDB(accountToken: string): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  // Load existing session from database or create new
  let session = await prisma.session.findUnique({
    where: { accountToken },
  });

  let creds: AuthenticationCreds;
  let keys: any = {};

  if (session && session.authState) {
    // Load existing auth state from database and convert JSON back to Buffers
    const authState = jsonToBuffer(session.authState) as any;
    creds = authState.creds || initAuthCreds();
    keys = authState.keys || {};
  } else {
    // Initialize new auth state
    creds = initAuthCreds();
    keys = {};
  }

  /**
   * Save credentials to database
   */
  const saveCreds = async () => {
    try {
      // Convert Buffers to JSON-safe format before saving
      const authState = bufferToJSON({
        creds,
        keys,
      });

      // Deep clone to ensure all objects are plain JSON
      const jsonSafeState = JSON.parse(JSON.stringify(authState));

      await prisma.session.upsert({
        where: { accountToken },
        create: {
          accountToken,
          authState: jsonSafeState,
        },
        update: {
          authState: jsonSafeState,
        },
      });
    } catch (error) {
      console.error('Error saving credentials to database:', error);
      throw error;
    }
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type: AuthStateKey, ids: string[]) => {
          const data: { [key: string]: any } = {};

          for (const id of ids) {
            let value = keys[`${type}-${id}`];
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          }

          return data;
        },
        set: async (data: any) => {
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;

              if (value) {
                keys[key] = value;
              } else {
                delete keys[key];
              }
            }
          }

          // Save after setting keys
          await saveCreds();
        },
      },
    },
    saveCreds,
  };
}

/**
 * Delete session from database
 */
export async function deleteAuthStateFromDB(accountToken: string): Promise<void> {
  await prisma.session.delete({
    where: { accountToken },
  }).catch(() => {
    // Ignore if session doesn't exist
  });
}

/**
 * Check if session exists in database
 */
export async function authStateExists(accountToken: string): Promise<boolean> {
  const count = await prisma.session.count({
    where: { accountToken },
  });
  return count > 0;
}
