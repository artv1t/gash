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

export interface PreFilterCounters {
  sessionId: string;
  timestamp: number;
  totalInput: number;
  passed: {
    check1_length: number;
    check2_base58: number;
    check3_publickey: number;
    check4_system: number;
    check5_scam: number;
    check6_patterns: number;
    check7_sequential: number;
    check8_zero: number;
  };
  rejected: {
    check1_length: number;
    check2_base58: number;
    check3_publickey: number;
    check4_system: number;
    check5_scam: number;
    check6_patterns: number;
    check7_sequential: number;
    check8_zero: number;
  };
  totalOutput: number;
  filterEfficiency: number;
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
    prefilterPassed: number;
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

export interface PreFilterResult {
  passed: boolean;
  checksPassed: number;
  checksTotal: number;
  failedAt?: string;
  reason?: string;
}

export interface RPCFilterResult {
  passed: boolean;
  score: number;
  reason?: string;
  data: Record<string, unknown>;
  latency: number;
}
