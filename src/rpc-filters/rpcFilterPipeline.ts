import { Connection } from '@solana/web3.js';
import { config } from '../config/index';
import { RPCFilterResult } from '../types/index';
import { RouteGateFilter } from './routeGateFilter';
import { OnChainFilter } from './onChainFilter';
import { DexScreenerFilter } from './dexScreenerFilter';
import { TokenJourneyLogger } from '../logger/tokenJourneyLogger';

export class RPCFilterPipeline {
  private connection: Connection;
  private routeGateFilter: RouteGateFilter;
  private onChainFilter: OnChainFilter;
  private dexScreenerFilter: DexScreenerFilter;
  private journeyLogger: TokenJourneyLogger;

  constructor() {
    this.connection = new Connection(config.rpc.heliusUrl, 'confirmed');
    this.routeGateFilter = new RouteGateFilter(this.connection);
    this.onChainFilter = new OnChainFilter(this.connection);
    this.dexScreenerFilter = new DexScreenerFilter();
    this.journeyLogger = new TokenJourneyLogger();
  }

  async processToken(mintAddress: string): Promise<RPCFilterResult> {
    const startTime = Date.now();
    
    this.journeyLogger.logTokenJourney({
      tokenAddress: mintAddress,
      timestamp: Date.now(),
      stage: 'rpc_filter_entry',
      status: 'PASSED',
      reason: 'Entering RPC filter pipeline'
    });
    
    try {
      const routeResult = await this.routeGateFilter.checkToken(mintAddress);
      this.journeyLogger.logTokenJourney({
        tokenAddress: mintAddress,
        timestamp: Date.now(),
        stage: 'route_gate',
        status: routeResult.passed ? 'PASSED' : 'REJECTED',
        reason: routeResult.reason,
        score: routeResult.score,
        latency: routeResult.latency,
        data: routeResult.data
      });
      
      if (!routeResult.passed) {
        return {
          passed: false,
          score: routeResult.score,
          reason: `RouteGate: ${routeResult.reason}`,
          data: routeResult.data,
          latency: Date.now() - startTime
        };
      }

      const onChainResult = await this.onChainFilter.checkToken(mintAddress);
      this.journeyLogger.logTokenJourney({
        tokenAddress: mintAddress,
        timestamp: Date.now(),
        stage: 'onchain',
        status: onChainResult.passed ? 'PASSED' : 'REJECTED',
        reason: onChainResult.reason,
        score: onChainResult.score,
        latency: onChainResult.latency,
        data: onChainResult.data
      });
      
      if (!onChainResult.passed) {
        return {
          passed: false,
          score: onChainResult.score,
          reason: `OnChain: ${onChainResult.reason}`,
          data: { ...routeResult.data, ...onChainResult.data },
          latency: Date.now() - startTime
        };
      }

      const dexResult = await this.dexScreenerFilter.checkToken(mintAddress);
      this.journeyLogger.logTokenJourney({
        tokenAddress: mintAddress,
        timestamp: Date.now(),
        stage: 'dex_screener',
        status: dexResult.passed ? 'PASSED' : 'REJECTED',
        reason: dexResult.reason,
        score: dexResult.score,
        latency: dexResult.latency,
        data: dexResult.data
      });
      
      if (!dexResult.passed) {
        return {
          passed: false,
          score: dexResult.score,
          reason: `DexScreener: ${dexResult.reason}`,
          data: { ...routeResult.data, ...onChainResult.data, ...dexResult.data },
          latency: Date.now() - startTime
        };
      }

      const combinedScore = (routeResult.score + onChainResult.score + dexResult.score) / 3;
      
      this.journeyLogger.logTokenJourney({
        tokenAddress: mintAddress,
        timestamp: Date.now(),
        stage: 'final_result',
        status: 'PASSED',
        reason: 'All RPC filters passed',
        score: combinedScore,
        latency: Date.now() - startTime
      });
      
      return {
        passed: true,
        score: combinedScore,
        reason: 'All RPC filters passed',
        data: { ...routeResult.data, ...onChainResult.data, ...dexResult.data },
        latency: Date.now() - startTime
      };

    } catch (error) {
      console.error(`RPC Filter Pipeline error for ${mintAddress}:`, error);
      
      this.journeyLogger.logTokenJourney({
        tokenAddress: mintAddress,
        timestamp: Date.now(),
        stage: 'final_result',
        status: 'REJECTED',
        reason: `Pipeline error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        latency: Date.now() - startTime
      });
      
      return {
        passed: false,
        score: 0,
        reason: `Pipeline error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: {},
        latency: Date.now() - startTime
      };
    }
  }
}
