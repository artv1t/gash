import { Connection } from '@solana/web3.js';
import { config } from '../config/index';
import { RPCFilterResult } from '../types/index';
import { RouteGateFilter } from './routeGateFilter';
import { OnChainFilter } from './onChainFilter';
import { DexScreenerFilter } from './dexScreenerFilter';

export class RPCFilterPipeline {
  private connection: Connection;
  private routeGateFilter: RouteGateFilter;
  private onChainFilter: OnChainFilter;
  private dexScreenerFilter: DexScreenerFilter;

  constructor() {
    this.connection = new Connection(config.rpc.heliusUrl, 'confirmed');
    this.routeGateFilter = new RouteGateFilter(this.connection);
    this.onChainFilter = new OnChainFilter(this.connection);
    this.dexScreenerFilter = new DexScreenerFilter();
  }

  async processToken(mintAddress: string): Promise<RPCFilterResult> {
    const startTime = Date.now();
    
    try {
      const routeResult = await this.routeGateFilter.checkToken(mintAddress);
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
      
      return {
        passed: true,
        score: combinedScore,
        reason: 'All RPC filters passed',
        data: { ...routeResult.data, ...onChainResult.data, ...dexResult.data },
        latency: Date.now() - startTime
      };

    } catch (error) {
      console.error(`RPC Filter Pipeline error for ${mintAddress}:`, error);
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
