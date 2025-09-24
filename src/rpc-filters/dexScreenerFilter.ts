import { RPCFilterResult } from '../types/index';

export class DexScreenerFilter {
  private apiUrl = 'https://api.dexscreener.com/latest/dex/tokens';
  private rateLimitDelay = 1000; // 1 second between requests to avoid rate limiting

  async checkToken(mintAddress: string): Promise<RPCFilterResult> {
    const startTime = Date.now();
    
    try {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      
      const response = await fetch(`${this.apiUrl}/${mintAddress}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SolanaSniper/1.0'
        }
      });

      if (!response.ok) {
        return {
          passed: false,
          score: 0,
          reason: `DexScreener API error: ${response.status}`,
          data: {},
          latency: Date.now() - startTime
        };
      }

      const data = await response.json();
      
      if (!data.pairs || data.pairs.length === 0) {
        return {
          passed: false,
          score: 0,
          reason: 'Token not found on DexScreener',
          data: {},
          latency: Date.now() - startTime
        };
      }

      const bestPair = this.findBestPair(data.pairs);
      const score = this.calculateDexScore(bestPair);
      
      if (score < 0.5) {
        return {
          passed: false,
          score,
          reason: 'Low DexScreener quality score',
          data: {
            pairCount: data.pairs.length,
            bestPair: {
              dexId: bestPair.dexId,
              priceUsd: bestPair.priceUsd,
              volume24h: bestPair.volume?.h24,
              liquidity: bestPair.liquidity?.usd
            }
          },
          latency: Date.now() - startTime
        };
      }

      return {
        passed: true,
        score,
        reason: 'Token found on DexScreener with good metrics',
        data: {
          pairCount: data.pairs.length,
          bestPair: {
            dexId: bestPair.dexId,
            priceUsd: bestPair.priceUsd,
            volume24h: bestPair.volume?.h24,
            liquidity: bestPair.liquidity?.usd,
            marketCap: bestPair.marketCap
          }
        },
        latency: Date.now() - startTime
      };

    } catch (error) {
      return {
        passed: false,
        score: 0,
        reason: `DexScreener error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: {},
        latency: Date.now() - startTime
      };
    }
  }

  private findBestPair(pairs: any[]): any {
    return pairs.reduce((best, current) => {
      const bestLiquidity = best.liquidity?.usd || 0;
      const currentLiquidity = current.liquidity?.usd || 0;
      return currentLiquidity > bestLiquidity ? current : best;
    }, pairs[0]);
  }

  private calculateDexScore(pair: any): number {
    let score = 0.3; // Base score

    try {
      const liquidity = pair.liquidity?.usd || 0;
      if (liquidity > 100000) score += 0.3;
      else if (liquidity > 50000) score += 0.2;
      else if (liquidity > 10000) score += 0.1;
      else if (liquidity < 1000) score -= 0.2;

      const volume24h = pair.volume?.h24 || 0;
      if (volume24h > 50000) score += 0.2;
      else if (volume24h > 10000) score += 0.1;
      else if (volume24h < 1000) score -= 0.1;

      const priceUsd = parseFloat(pair.priceUsd || '0');
      if (priceUsd > 0.001) score += 0.1;
      else if (priceUsd < 0.0000001) score -= 0.2;

      if (['raydium', 'orca', 'jupiter'].includes(pair.dexId?.toLowerCase())) {
        score += 0.1;
      }

      return Math.max(0, Math.min(1, score));
      
    } catch (error) {
      console.error('DexScreener score calculation error:', error);
      return 0.2;
    }
  }
}
