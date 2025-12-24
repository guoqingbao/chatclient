
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ChatDB extends DBSchema {
  attachments: {
    key: string;
    value: string; // Base64 content
  };
}

const DB_NAME = 'ChatClientDB';
const STORE_NAME = 'attachments';

let dbPromise: Promise<IDBPDatabase<ChatDB>> | null = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<ChatDB>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
};

export const saveAttachmentToDB = async (id: string, content: string): Promise<void> => {
  try {
    const db = await getDB();
    await db.put(STORE_NAME, content, id);
  } catch (error) {
    console.error("Failed to save attachment to DB:", error);
  }
};

export const getAttachmentFromDB = async (id: string): Promise<string | undefined> => {
  try {
    const db = await getDB();
    return await db.get(STORE_NAME, id);
  } catch (error) {
    console.error("Failed to get attachment from DB:", error);
    return undefined;
  }
};

export const deleteAttachmentFromDB = async (id: string): Promise<void> => {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
  } catch (error) {
    console.error("Failed to delete attachment from DB:", error);
  }
};

// Clear attachments that are no longer referenced in valid sessions
// This is a cleanup utility
export const pruneOrphanedAttachments = async (validIds: string[]) => {
    try {
        const db = await getDB();
        const allKeys = await db.getAllKeys(STORE_NAME);
        const validSet = new Set(validIds);
        
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        for (const key of allKeys) {
            if (!validSet.has(key)) {
                store.delete(key);
            }
        }
        await tx.done;
    } catch (e) {
        console.warn("Failed to prune DB", e);
    }
}
