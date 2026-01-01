import { StorageInterface } from './StorageInterface';
import { JsonFileStorage } from './JsonFileStorage';
import { config } from '../config';
import { createLogger } from '../utils/Logger';

const logger = createLogger('Storage');

let storageInstance: StorageInterface | null = null;

/**
 * Get the storage instance based on configuration
 */
export async function getStorage(): Promise<StorageInterface> {
  if (storageInstance) {
    return storageInstance;
  }

  switch (config.storage.type) {
    case 'json-file':
      logger.info('Using JSON file storage');
      storageInstance = new JsonFileStorage();
      break;
    
    case 'google-sheets':
      // TODO: Implement GoogleSheetsStorage for Phase 2+
      logger.warn('Google Sheets storage not yet implemented, falling back to JSON');
      storageInstance = new JsonFileStorage();
      break;
    
    case 'database':
      // TODO: Implement DatabaseStorage for production
      logger.warn('Database storage not yet implemented, falling back to JSON');
      storageInstance = new JsonFileStorage();
      break;
    
    default:
      logger.warn('Unknown storage type, using JSON file storage');
      storageInstance = new JsonFileStorage();
  }

  await storageInstance.initialize();
  return storageInstance;
}

/**
 * Reset storage instance (for testing)
 */
export function resetStorage(): void {
  storageInstance = null;
}

export { StorageInterface } from './StorageInterface';
export { JsonFileStorage } from './JsonFileStorage';
