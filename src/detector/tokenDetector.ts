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

interface JupiterTokenData {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  liquidity?: number;
  mcap?: number;
  organicScore: number;
  organicScoreLabel: string;
  isVerified?: boolean;
  updatedAt: string;
}

export class TokenDetector {
  private eventBus: EventBus;
  private isRunning = false;
  private tokenQueue: TokenQueueItem[] = [];
  private maxQueueSize = 100;
  private logFile!: string;
  private processedTokens = new Set<string>();
  private jupiterApiUrl = 'https://lite-api.jup.ag/tokens/v2/recent';

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
    this.logFile = path.join(logDir, `jupiter_token_detector_${timestamp}.log`);
    
    const header = {
      session: `jupiter_token_detector_${Date.now()}`,
      startTime: new Date().toISOString(),
      description: 'Jupiter API token detection - Recent tokens with liquidity',
      apiEndpoint: this.jupiterApiUrl,
      queueSize: this.maxQueueSize
    };
    
    fs.writeFileSync(this.logFile, JSON.stringify(header, null, 2) + '\n');
    console.log(`📁 Jupiter TokenDetector logs: ${this.logFile}`);
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
    console.log('🔍 TokenDetector: Starting Jupiter API token monitoring...');
    this.logToFile({ event: 'detector_started', message: 'Jupiter API token monitoring started' });
    
    this.startJupiterMonitoring();
    this.startQueueProcessor();
  }

  public stop(): void {
    this.isRunning = false;
    console.log('🛑 TokenDetector: Stopped');
    this.logToFile({ event: 'detector_stopped', message: 'Jupiter API token monitoring stopped' });
  }

  private startJupiterMonitoring(): void {
    setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.fetchJupiterRecentTokens();
      } catch (error) {
        console.error('Jupiter API monitoring error:', error);
        this.logToFile({ event: 'monitoring_error', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }, 10000);
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
          id: `jupiter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          mintAddress: token.mintAddress,
          timestamp: token.timestamp,
          source: token.source,
        };
        
        this.eventBus.emitTokenEvent(tokenEvent);
      }
    }, 2000);
  }

  private async fetchJupiterRecentTokens(): Promise<void> {
    try {
      console.log('🔍 Fetching recent tokens from Jupiter API...');
      
      const response = await fetch(this.jupiterApiUrl, {
        method: 'GET',
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Solana-Sniper-Bot/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status} ${response.statusText}`);
      }
      
      const tokens: JupiterTokenData[] = await response.json();
      
      console.log(`🎯 Jupiter API returned ${tokens.length} recent tokens`);
      this.logToFile({
        event: 'jupiter_api_response',
        tokensCount: tokens.length,
        timestamp: Date.now()
      });
      
      for (const token of tokens) {
        this.logToFile({
          event: 'jupiter_token_received',
          tokenId: token.id,
          symbol: token.symbol,
          name: token.name,
          liquidity: token.liquidity,
          mcap: token.mcap,
          organicScore: token.organicScore,
          organicScoreLabel: token.organicScoreLabel,
          isVerified: token.isVerified
        });
        
        if (this.isValidJupiterToken(token)) {
          this.addToQueue({
            mintAddress: token.id,
            timestamp: Date.now(),
            source: 'jupiter_recent_api',
            tokenData: {
              name: token.name,
              symbol: token.symbol,
              decimals: token.decimals,
              liquidity: token.liquidity,
              mcap: token.mcap,
              organicScore: token.organicScore,
              organicScoreLabel: token.organicScoreLabel,
              isVerified: token.isVerified,
              updatedAt: token.updatedAt
            }
          });
        } else {
          this.logToFile({
            event: 'jupiter_token_rejected',
            tokenId: token.id,
            symbol: token.symbol,
            reason: 'Failed validation checks'
          });
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('Jupiter API fetch error:', error);
      this.logToFile({ 
        event: 'jupiter_api_error', 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  }

  private isValidJupiterToken(token: JupiterTokenData): boolean {
    try {
      if (!token.id || typeof token.id !== 'string') {
        return false;
      }
      
      if (token.id.length < 32 || token.id.length > 44) {
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
      
      if (systemAddresses.has(token.id)) {
        return false;
      }
      
      if (token.liquidity !== undefined && token.liquidity < 50) {
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
    apiEndpoint: string;
  } {
    return {
      queueSize: this.tokenQueue.length,
      maxQueueSize: this.maxQueueSize,
      processedTokens: this.processedTokens.size,
      isRunning: this.isRunning,
      apiEndpoint: this.jupiterApiUrl
    };
  }
}
