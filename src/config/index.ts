import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export interface AppConfig {
  nodeEnv: string;
  port: number;
  appSecret: string;
  phase: number;
  enableQbWrite: boolean;
  enableReconciliation: boolean;
}

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'sandbox' | 'production';
  realmId: string;
  accessToken: string;
  refreshToken: string;
}

export interface SmartsheetConfig {
  accessToken: string;
  placementsSheetId: string;
  onboardSheetId: string;
}

export interface StorageConfig {
  type: 'json-file' | 'google-sheets' | 'database';
  dataDir: string;
  googleServiceAccountEmail?: string;
  googlePrivateKey?: string;
  googleLedgerSheetId?: string;
}

export interface LogConfig {
  level: string;
  dir: string;
}

export interface Config {
  app: AppConfig;
  quickbooks: QuickBooksConfig;
  smartsheet: SmartsheetConfig;
  storage: StorageConfig;
  log: LogConfig;
}

function requireEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

export function loadConfig(): Config {
  return {
    app: {
      nodeEnv: optionalEnv('NODE_ENV', 'development'),
      port: parseInt(optionalEnv('PORT', '3000'), 10),
      appSecret: requireEnv('APP_SECRET', 'dev-secret-change-in-production'),
      phase: parseInt(optionalEnv('PHASE', '1'), 10),
      enableQbWrite: optionalEnv('ENABLE_QB_WRITE', 'false') === 'true',
      enableReconciliation: optionalEnv('ENABLE_RECONCILIATION', 'false') === 'true',
    },
    quickbooks: {
      clientId: optionalEnv('QB_CLIENT_ID'),
      clientSecret: optionalEnv('QB_CLIENT_SECRET'),
      redirectUri: optionalEnv('QB_REDIRECT_URI', 'http://localhost:3000/api/auth/quickbooks/callback'),
      environment: optionalEnv('QB_ENVIRONMENT', 'sandbox') as 'sandbox' | 'production',
      realmId: optionalEnv('QB_REALM_ID'),
      accessToken: optionalEnv('QB_ACCESS_TOKEN'),
      refreshToken: optionalEnv('QB_REFRESH_TOKEN'),
    },
    smartsheet: {
      accessToken: optionalEnv('SMARTSHEET_ACCESS_TOKEN'),
      placementsSheetId: optionalEnv('SMARTSHEET_PLACEMENTS_SHEET_ID'),
      onboardSheetId: optionalEnv('SMARTSHEET_ONBOARD_SHEET_ID'),
    },
    storage: {
      type: optionalEnv('STORAGE_TYPE', 'json-file') as 'json-file' | 'google-sheets' | 'database',
      dataDir: path.resolve(optionalEnv('DATA_DIR', './data')),
      googleServiceAccountEmail: optionalEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
      googlePrivateKey: optionalEnv('GOOGLE_PRIVATE_KEY'),
      googleLedgerSheetId: optionalEnv('GOOGLE_LEDGER_SHEET_ID'),
    },
    log: {
      level: optionalEnv('LOG_LEVEL', 'info'),
      dir: path.resolve(optionalEnv('LOG_DIR', './logs')),
    },
  };
}

export const config = loadConfig();
