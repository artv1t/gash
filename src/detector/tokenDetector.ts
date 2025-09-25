import { EventBus } from '../core/eventBus';
import { TokenEvent } from '../types/index';
import * as fs from 'fs';
import * as path from 'path';

interface TokenQueueItem {
  mintAddress: string;
  timestamp: number;
  source: string;
  tokenData?: any;
}

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity?: {
    usd: number;
    base: number;
    quote: number;
  };
  pairCreatedAt: number;
}

interface RaydiumPair {
  name: string;
  ammId: string;
  lpMint: string;
  baseMint: string;
  quoteMint: string;
  market: string;
  liquidity: number;
  price: number;
  volume24h: number;
  fee24h: number;
  apr24h: number;
}

export class TokenDetector {
  private eventBus: EventBus;
  private isRunning = false;
  private tokenQueue: TokenQueueItem[] = [];
  private maxQueueSize = 50;
  private logFile!: string;
  private processedTokens = new Set<string>();
  private dexScreenerApiUrl = 'https://api.dexscreener.com/latest/dex/search/?q=solana&sort=volume&order=desc';
  private raydiumApiUrl = 'https://api.raydium.io/v2/main/pairs';

  constructor() {
    this.eventBus = EventBus.getInstance();
    this.initializeLogging();
  }

  private initializeLogging(): void {
    const logDir = path.join(process.cwd(), 'logs', 'token_detector');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(logDir, `dex_pool_detector_${timestamp}.log`);
    
    const header = {
      session: `dex_pool_detector_${Date.now()}`,
      startTime: new Date().toISOString(),
      description: 'DEX Pool Token Detection - DexScreener + Raydium APIs with quality filters',
      dexScreenerEndpoint: this.dexScreenerApiUrl,
      raydiumEndpoint: this.raydiumApiUrl,
      queueSize: this.maxQueueSize,
      qualityFilters: {
        minVolume24h: 1000,
        minLiquidity: 10000,
        minAge: 1800000
      }
    };
    
    fs.writeFileSync(this.logFile, JSON.stringify(header, null, 2) + '\n');
    console.log(`📁 DEX Pool TokenDetector logs: ${this.logFile}`);
  }

  private logToFile(data: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...data
    };
    fs.appendFileSync(this.logFile, JSON.stringify(logEntry, null, 2) + '\n');
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🔍 TokenDetector: Starting DEX Pool monitoring (DexScreener + Raydium)...');
    this.logToFile({ event: 'detector_started', message: 'DEX Pool token monitoring started with quality filters' });
    
    this.startDexPoolMonitoring();
    this.startQueueProcessor();
  }

  public stop(): void {
    this.isRunning = false;
    console.log('🛑 TokenDetector: Stopped');
    this.logToFile({ event: 'detector_stopped', message: 'DEX Pool token monitoring stopped' });
  }

  private startDexPoolMonitoring(): void {
    setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.fetchDexScreenerTokens();
        await new Promise(resolve => setTimeout(resolve, 5000));
        await this.fetchRaydiumPairs();
      } catch (error) {
        console.error('DEX Pool monitoring error:', error);
        this.logToFile({ event: 'monitoring_error', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }, 15000);
  }

  private startQueueProcessor(): void {
    setInterval(async () => {
      if (!this.isRunning || this.tokenQueue.length === 0) return;
      
      const token = this.tokenQueue.shift();
      if (token && !this.processedTokens.has(token.mintAddress)) {
        this.processedTokens.add(token.mintAddress);
        
        console.log(`🎯 PROCESSING TOKEN: ${token.mintAddress} (from ${token.source})`);
        this.logToFile({
          event: 'token_processing',
          mintAddress: token.mintAddress,
          source: token.source,
          tokenData: token.tokenData,
          queueSize: this.tokenQueue.length
        });
        
        const tokenEvent: TokenEvent = {
          id: `dex_pool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          mintAddress: token.mintAddress,
          timestamp: token.timestamp,
          source: token.source,
        };
        
        this.eventBus.emitTokenEvent(tokenEvent);
      }
    }, 2000);
  }

  private async fetchDexScreenerTokens(): Promise<void> {
    try {
      console.log('🔍 Fetching quality tokens from DexScreener API...');
      
      const response = await fetch(this.dexScreenerApiUrl, {
        method: 'GET',
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Solana-Sniper-Bot/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const pairs: DexScreenerPair[] = data.pairs || [];
      
      console.log(`🎯 DexScreener API returned ${pairs.length} trading pairs`);
      this.logToFile({
        event: 'dexscreener_api_response',
        pairsCount: pairs.length,
        timestamp: Date.now()
      });
      
      for (const pair of pairs) {
        if (pair.chainId === 'solana' && this.isQualityDexScreenerPair(pair)) {
          const tokenAddress = pair.baseToken.address;
          
          this.logToFile({
            event: 'dexscreener_quality_token',
            tokenAddress,
            symbol: pair.baseToken.symbol,
            name: pair.baseToken.name,
            volume24h: pair.volume.h24,
            liquidity: pair.liquidity?.usd,
            priceUsd: pair.priceUsd,
            pairCreatedAt: pair.pairCreatedAt,
            age: Date.now() - pair.pairCreatedAt
          });
          
          this.addToQueue({
            mintAddress: tokenAddress,
            timestamp: Date.now(),
            source: 'dexscreener_quality',
            tokenData: {
              name: pair.baseToken.name,
              symbol: pair.baseToken.symbol,
              volume24h: pair.volume.h24,
              liquidity: pair.liquidity?.usd,
              priceUsd: parseFloat(pair.priceUsd),
              pairAddress: pair.pairAddress,
              dexId: pair.dexId,
              age: Date.now() - pair.pairCreatedAt,
              transactions24h: pair.txns.h24.buys + pair.txns.h24.sells
            }
          });
        } else {
          this.logToFile({
            event: 'dexscreener_token_rejected',
            tokenAddress: pair.baseToken.address,
            symbol: pair.baseToken.symbol,
            reason: 'Failed quality filters',
            volume24h: pair.volume.h24,
            liquidity: pair.liquidity?.usd,
            age: Date.now() - pair.pairCreatedAt
          });
        }
      }
      
    } catch (error) {
      console.error('DexScreener API fetch error:', error);
      this.logToFile({ 
        event: 'dexscreener_api_error', 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  }

  private async fetchRaydiumPairs(): Promise<void> {
    try {
      console.log('🔍 Fetching established pairs from Raydium API...');
      
      const response = await fetch(this.raydiumApiUrl, {
        method: 'GET',
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Solana-Sniper-Bot/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Raydium API error: ${response.status} ${response.statusText}`);
      }
      
      const pairs: RaydiumPair[] = await response.json();
      
      console.log(`🎯 Raydium API returned ${pairs.length} trading pairs`);
      this.logToFile({
        event: 'raydium_api_response',
        pairsCount: pairs.length,
        timestamp: Date.now()
      });
      
      let qualityCount = 0;
      for (const pair of pairs.slice(0, 100)) {
        if (this.isQualityRaydiumPair(pair)) {
          qualityCount++;
          const tokenAddress = pair.baseMint;
          
          this.logToFile({
            event: 'raydium_quality_token',
            tokenAddress,
            pairName: pair.name,
            volume24h: pair.volume24h,
            liquidity: pair.liquidity,
            price: pair.price,
            apr24h: pair.apr24h
          });
          
          this.addToQueue({
            mintAddress: tokenAddress,
            timestamp: Date.now(),
            source: 'raydium_established',
            tokenData: {
              pairName: pair.name,
              volume24h: pair.volume24h,
              liquidity: pair.liquidity,
              price: pair.price,
              apr24h: pair.apr24h,
              ammId: pair.ammId,
              market: pair.market
            }
          });
        }
      }
      
      console.log(`✅ Found ${qualityCount} quality Raydium pairs`);
      
    } catch (error) {
      console.error('Raydium API fetch error:', error);
      this.logToFile({ 
        event: 'raydium_api_error', 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  }

  private isQualityDexScreenerPair(pair: DexScreenerPair): boolean {
    try {
      if (!pair.baseToken.address || typeof pair.baseToken.address !== 'string') {
        return false;
      }
      
      if (pair.baseToken.address.length < 32 || pair.baseToken.address.length > 44) {
        return false;
      }
      
      const systemAddresses = new Set([
        'So11111111111111111111111111111111111111112',
        '11111111111111111111111111111111',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
      ]);
      
      if (systemAddresses.has(pair.baseToken.address)) {
        return false;
      }
      
      if (pair.volume.h24 < 1000) {
        return false;
      }
      
      if (!pair.liquidity || pair.liquidity.usd < 10000) {
        return false;
      }
      
      const ageMs = Date.now() - pair.pairCreatedAt;
      if (ageMs < 1800000) {
        return false;
      }
      
      const totalTxns = pair.txns.h24.buys + pair.txns.h24.sells;
      if (totalTxns < 20) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private isQualityRaydiumPair(pair: RaydiumPair): boolean {
    try {
      if (!pair.baseMint || typeof pair.baseMint !== 'string') {
        return false;
      }
      
      if (pair.baseMint.length < 32 || pair.baseMint.length > 44) {
        return false;
      }
      
      const systemAddresses = new Set([
        'So11111111111111111111111111111111111111112',
        '11111111111111111111111111111111',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
      ]);
      
      if (systemAddresses.has(pair.baseMint)) {
        return false;
      }
      
      if (pair.volume24h < 1000) {
        return false;
      }
      
      if (pair.liquidity < 10000) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  private addToQueue(token: TokenQueueItem): void {
    if (this.processedTokens.has(token.mintAddress)) return;
    
    if (this.tokenQueue.length >= this.maxQueueSize) {
      const removed = this.tokenQueue.shift();
      console.log(`⚠️ Queue full, removed: ${removed?.mintAddress}`);
      this.logToFile({
        event: 'token_queue_overflow',
        removedToken: removed?.mintAddress,
        queueSize: this.tokenQueue.length
      });
    }
    
    this.tokenQueue.push(token);
    console.log(`📥 QUEUED: ${token.mintAddress} (${token.source}) - Queue: ${this.tokenQueue.length}/${this.maxQueueSize}`);
    
    this.logToFile({
      event: 'token_queued',
      mintAddress: token.mintAddress,
      source: token.source,
      tokenData: token.tokenData,
      queueSize: this.tokenQueue.length,
      timestamp: Date.now()
    });
  }

  public getQueueStatus(): { size: number; maxSize: number; processed: number } {
    return {
      size: this.tokenQueue.length,
      maxSize: this.maxQueueSize,
      processed: this.processedTokens.size
    };
  }

  public getStats(): { 
    queueSize: number; 
    maxQueueSize: number; 
    processedTokens: number;
    isRunning: boolean;
    dexScreenerEndpoint: string;
    raydiumEndpoint: string;
  } {
    return {
      queueSize: this.tokenQueue.length,
      maxQueueSize: this.maxQueueSize,
      processedTokens: this.processedTokens.size,
      isRunning: this.isRunning,
      dexScreenerEndpoint: this.dexScreenerApiUrl,
      raydiumEndpoint: this.raydiumApiUrl
    };
  }
}
