export interface TokenEvent {
  id: string;
  mintAddress: string;
  timestamp: number;
  source: string;
}

export interface SessionInfo {
  sessionId: string;
  timestamp: number;
  startTime: number;
  endTime?: number;
}

export interface TokenDetectorCounters {
  sessionId: string;
  timestamp: number;
  totalDetected: number;
  raydiumTokens: number;
  orcaTokens: number;
  dexScreenerTokens: number;
  queuedTokens: number;
  processedTokens: number;
  validTokens: number;
}

export interface RPCLogEntry {
  sessionId: string;
  timestamp: number;
  mintAddress: string;
  filterName: string;
  passed: boolean;
  reason?: string;
  data: {
    marketCap?: number;
    liquidity?: number;
    holderCount?: number;
    volume24h?: number;
    priceStability?: number;
    ownerRenounced?: boolean;
    tradingEnabled?: boolean;
    contractSecurity?: number;
  };
  latency: number;
}

export interface SessionMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  trading: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    averageReturn: number;
    totalPnL: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
  filtering: {
    tokensDetected: number;
    queueProcessed: number;
    rpcFilterPassed: number;
    tradingExecuted: number;
    filterEfficiency: number;
  };
  performance: {
    avgLatency: number;
    rpcCalls: number;
    errors: number;
    uptime: number;
  };
}

export interface TokenDetectorResult {
  detected: boolean;
  source: string;
  poolAddress?: string;
  timestamp: number;
  reason?: string;
}

export interface RPCFilterResult {
  passed: boolean;
  score: number;
  reason?: string;
  data: Record<string, unknown>;
  latency: number;
}
