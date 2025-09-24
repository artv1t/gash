import { Connection, PublicKey } from '@solana/web3.js';
import { RPCFilterResult } from '../types/index';

export class OnChainFilter {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async checkToken(mintAddress: string): Promise<RPCFilterResult> {
    const startTime = Date.now();
    
    try {
      const mintPublicKey = new PublicKey(mintAddress);
      
      const accountInfo = await this.connection.getAccountInfo(mintPublicKey);
      if (!accountInfo) {
        return {
          passed: false,
          score: 0,
          reason: 'Token account not found',
          data: {},
          latency: Date.now() - startTime
        };
      }

      const supply = await this.connection.getTokenSupply(mintPublicKey);
      if (!supply.value.uiAmount) {
        return {
          passed: false,
          score: 0,
          reason: 'No token supply',
          data: {},
          latency: Date.now() - startTime
        };
      }

      const score = await this.calculateTokenScore(mintAddress, supply.value.uiAmount);
      
      if (score < 0.4) {
        return {
          passed: false,
          score,
          reason: 'Low token quality score',
          data: { 
            supply: supply.value.uiAmount,
            decimals: supply.value.decimals
          },
          latency: Date.now() - startTime
        };
      }

      return {
        passed: true,
        score,
        reason: 'Token passed on-chain validation',
        data: {
          supply: supply.value.uiAmount,
          decimals: supply.value.decimals,
          owner: accountInfo.owner.toString()
        },
        latency: Date.now() - startTime
      };

    } catch (error) {
      return {
        passed: false,
        score: 0,
        reason: `OnChain error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: {},
        latency: Date.now() - startTime
      };
    }
  }

  private async calculateTokenScore(mintAddress: string, supply: number): Promise<number> {
    let score = 0.5; // Base score

    try {
      if (supply > 1000000000) score += 0.2; // Large supply
      else if (supply > 1000000) score += 0.1; // Medium supply
      else if (supply < 1000) score -= 0.2; // Very small supply (suspicious)

      const mintPublicKey = new PublicKey(mintAddress);
      const supply_info = await this.connection.getTokenSupply(mintPublicKey);
      const decimals = supply_info.value.decimals;
      
      if (decimals >= 6 && decimals <= 9) {
        score += 0.1;
      } else if (decimals < 6 || decimals > 18) {
        score -= 0.1;
      }

      return Math.max(0, Math.min(1, score));
      
    } catch (error) {
      console.error(`Token score calculation failed for ${mintAddress}:`, error);
      return 0.3; // Default low score on error
    }
  }
}
