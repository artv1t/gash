import { Connection, PublicKey } from '@solana/web3.js';
import { RPCFilterResult } from '../types/index';

export class RouteGateFilter {
  private connection: Connection;
  private jupiterApiUrl = 'https://quote-api.jup.ag/v6';

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async checkToken(mintAddress: string): Promise<RPCFilterResult> {
    const startTime = Date.now();
    
    try {
      const hasRoutes = await this.checkTradingRoutes(mintAddress);
      
      if (!hasRoutes) {
        return {
          passed: false,
          score: 0,
          reason: 'No trading routes available',
          data: { hasRoutes: false },
          latency: Date.now() - startTime
        };
      }

      const liquidityScore = await this.checkLiquidity(mintAddress);
      
      if (liquidityScore < 0.3) {
        return {
          passed: false,
          score: liquidityScore,
          reason: 'Insufficient liquidity',
          data: { hasRoutes: true, liquidityScore },
          latency: Date.now() - startTime
        };
      }

      return {
        passed: true,
        score: liquidityScore,
        reason: 'Trading routes available with sufficient liquidity',
        data: { hasRoutes: true, liquidityScore },
        latency: Date.now() - startTime
      };

    } catch (error) {
      return {
        passed: false,
        score: 0,
        reason: `RouteGate error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: {},
        latency: Date.now() - startTime
      };
    }
  }

  private async checkTradingRoutes(mintAddress: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.jupiterApiUrl}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${mintAddress}&amount=1000000&slippageBps=1000`,
        { 
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (response.status === 200) {
        const data = await response.json();
        return data && data.outAmount && parseInt(data.outAmount) > 0;
      }

      return false;
    } catch (error) {
      console.error(`Jupiter route check failed for ${mintAddress}:`, error);
      return false;
    }
  }

  private async checkLiquidity(mintAddress: string): Promise<number> {
    try {
      const mintPublicKey = new PublicKey(mintAddress);
      const supply = await this.connection.getTokenSupply(mintPublicKey);
      
      if (!supply.value.uiAmount || supply.value.uiAmount === 0) {
        return 0;
      }

      const supplyAmount = supply.value.uiAmount;
      if (supplyAmount > 1000000) return 0.9;
      if (supplyAmount > 100000) return 0.7;
      if (supplyAmount > 10000) return 0.5;
      if (supplyAmount > 1000) return 0.3;
      
      return 0.1;
    } catch (error) {
      console.error(`Liquidity check failed for ${mintAddress}:`, error);
      return 0;
    }
  }
}
