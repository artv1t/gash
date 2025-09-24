import * as dotenv from 'dotenv';

dotenv.config();

export interface Config {
  rpc: {
    heliusUrl: string;
    backupUrl: string;
    timeout: number;
    maxCallsPerSecond: number;
  };
  wallet: {
    phantomPrivateKey: string;
    backupPrivateKey?: string | undefined;
    maxSolPerTrade: number;
    maxConcurrentPositions: number;
    emergencyStop: boolean;
  };
  trading: {
    stopLossPercent: number;
    takeProfitPercent: number;
    positionTtlMinutes: number;
    minLiquidityUsd: number;
    maxMarketCapUsd: number;
  };
  logging: {
    level: string;
    retentionDays: number;
    sessionLogCleanup: boolean;
  };
}


function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getNumberEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
}

function getBooleanEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

export const config: Config = {
  rpc: {
    heliusUrl: getOptionalEnv('HELIUS_RPC_URL', 'https://api.mainnet-beta.solana.com'),
    backupUrl: getOptionalEnv('BACKUP_RPC_URL', 'https://api.mainnet-beta.solana.com'),
    timeout: getNumberEnv('RPC_TIMEOUT', 5000),
    maxCallsPerSecond: getNumberEnv('MAX_RPC_CALLS_PER_SECOND', 100),
  },
  wallet: {
    phantomPrivateKey: getOptionalEnv('PHANTOM_PRIVATE_KEY', 'test-key'),
    backupPrivateKey: process.env['BACKUP_WALLET_PRIVATE_KEY'],
    maxSolPerTrade: getNumberEnv('MAX_SOL_PER_TRADE', 0.01),
    maxConcurrentPositions: getNumberEnv('MAX_CONCURRENT_POSITIONS', 5),
    emergencyStop: getBooleanEnv('EMERGENCY_STOP', false),
  },
  trading: {
    stopLossPercent: getNumberEnv('STOP_LOSS_PERCENT', 10),
    takeProfitPercent: getNumberEnv('TAKE_PROFIT_PERCENT', 50),
    positionTtlMinutes: getNumberEnv('POSITION_TTL_MINUTES', 30),
    minLiquidityUsd: getNumberEnv('MIN_LIQUIDITY_USD', 500),
    maxMarketCapUsd: getNumberEnv('MAX_MARKET_CAP_USD', 10000000),
  },
  logging: {
    level: getOptionalEnv('LOG_LEVEL', 'info'),
    retentionDays: getNumberEnv('LOG_RETENTION_DAYS', 7),
    sessionLogCleanup: getBooleanEnv('SESSION_LOG_CLEANUP', true),
  },
};

console.log('✅ Configuration loaded successfully');
console.log(`📊 Max positions: ${config.wallet.maxConcurrentPositions}`);
console.log(`💰 Max SOL per trade: ${config.wallet.maxSolPerTrade}`);
console.log(`🛑 Emergency stop: ${config.wallet.emergencyStop ? 'ENABLED' : 'DISABLED'}`);
