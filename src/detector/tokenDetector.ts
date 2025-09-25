import { Connection, PublicKey, GetProgramAccountsFilter } from '@solana/web3.js';
import { EventBus } from '../core/eventBus';
import { TokenEvent } from '../types/index';
import { config } from '../config/index';
import * as fs from 'fs';
import * as path from 'path';

interface TokenQueueItem {
  mintAddress: string;
  timestamp: number;
  source: string;
  poolAddress?: string;
}

export class TokenDetector {
  private connection: Connection;
  private eventBus: EventBus;
  private isRunning = false;
  private tokenQueue: TokenQueueItem[] = [];
  private maxQueueSize = 50;
  private logFile!: string;
  private processedTokens = new Set<string>();

  constructor() {
    this.connection = new Connection(config.rpc.heliusUrl, 'confirmed');
    this.eventBus = EventBus.getInstance();
    this.initializeLogging();
  }

  private initializeLogging(): void {
    const logDir = path.join(process.cwd(), 'logs', 'token_detector');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(logDir, `token_detector_${timestamp}.log`);
    
    const header = {
      session: `token_detector_${Date.now()}`,
      startTime: new Date().toISOString(),
      description: 'Real DEX pool token detection - Raydium & Orca pools'
    };
    
    fs.writeFileSync(this.logFile, JSON.stringify(header, null, 2) + '\n');
    console.log(`📁 TokenDetector logs: ${this.logFile}`);
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
    console.log('🔍 TokenDetector: Starting DEX pool monitoring...');
    this.logToFile({ event: 'detector_started', message: 'DEX pool monitoring started' });
    
    this.startPoolMonitoring();
    this.startQueueProcessor();
  }

  public stop(): void {
    this.isRunning = false;
    console.log('🛑 TokenDetector: Stopped');
    this.logToFile({ event: 'detector_stopped', message: 'DEX pool monitoring stopped' });
  }

  private startPoolMonitoring(): void {
    setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.scanRaydiumPools();
        await this.scanOrcaPools();
        await this.scanDexScreenerFeed();
      } catch (error) {
        console.error('Pool monitoring error:', error);
        this.logToFile({ event: 'monitoring_error', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }, 5000);
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
          poolAddress: token.poolAddress,
          queueSize: this.tokenQueue.length
        });
        
        const tokenEvent: TokenEvent = {
          id: `pool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          mintAddress: token.mintAddress,
          timestamp: token.timestamp,
          source: token.source,
        };
        
        this.eventBus.emitTokenEvent(tokenEvent);
      }
    }, 1000);
  }

  private async scanRaydiumPools(): Promise<void> {
    try {
      const RAYDIUM_AMM_PROGRAM = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
      
      const filters: GetProgramAccountsFilter[] = [
        { dataSize: 752 },
        { memcmp: { offset: 400, bytes: '1' } }
      ];
      
      const accounts = await this.connection.getProgramAccounts(
        new PublicKey(RAYDIUM_AMM_PROGRAM),
        { filters, commitment: 'confirmed' }
      );
      
      console.log(`🔍 Found ${accounts.length} Raydium pools`);
      
      for (const account of accounts.slice(0, 10)) {
        try {
          const poolData = account.account.data;
          const baseMint = new PublicKey(poolData.slice(400, 432)).toString();
          const quoteMint = new PublicKey(poolData.slice(432, 464)).toString();
          
          for (const mint of [baseMint, quoteMint]) {
            if (await this.isValidTokenMint(mint)) {
              this.addToQueue({
                mintAddress: mint,
                timestamp: Date.now(),
                source: 'raydium_pool',
                poolAddress: account.pubkey.toString()
              });
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      console.error('Raydium scan error:', error);
      this.logToFile({ event: 'raydium_scan_error', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async scanOrcaPools(): Promise<void> {
    try {
      const ORCA_WHIRLPOOL_PROGRAM = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
      
      const filters: GetProgramAccountsFilter[] = [
        { dataSize: 653 }
      ];
      
      const accounts = await this.connection.getProgramAccounts(
        new PublicKey(ORCA_WHIRLPOOL_PROGRAM),
        { filters, commitment: 'confirmed' }
      );
      
      console.log(`🔍 Found ${accounts.length} Orca pools`);
      
      for (const account of accounts.slice(0, 5)) {
        try {
          const poolData = account.account.data;
          const tokenMintA = new PublicKey(poolData.slice(101, 133)).toString();
          const tokenMintB = new PublicKey(poolData.slice(181, 213)).toString();
          
          for (const mint of [tokenMintA, tokenMintB]) {
            if (await this.isValidTokenMint(mint)) {
              this.addToQueue({
                mintAddress: mint,
                timestamp: Date.now(),
                source: 'orca_pool',
                poolAddress: account.pubkey.toString()
              });
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 150));
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      console.error('Orca scan error:', error);
      this.logToFile({ event: 'orca_scan_error', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async scanDexScreenerFeed(): Promise<void> {
    try {
      const response = await fetch('https://api.dexscreener.com/latest/dex/tokens/solana', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      const pairs = data.pairs?.slice(0, 10) || [];
      
      console.log(`🔍 Found ${pairs.length} DexScreener tokens`);
      
      for (const pair of pairs) {
        if (pair.baseToken?.address) {
          this.addToQueue({
            mintAddress: pair.baseToken.address,
            timestamp: Date.now(),
            source: 'dexscreener_feed'
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error('DexScreener scan error:', error);
      this.logToFile({ event: 'dexscreener_scan_error', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private addToQueue(token: TokenQueueItem): void {
    if (this.processedTokens.has(token.mintAddress)) return;
    
    if (this.tokenQueue.length >= this.maxQueueSize) {
      const removed = this.tokenQueue.shift();
      console.log(`⚠️ Queue full, removed: ${removed?.mintAddress}`);
    }
    
    this.tokenQueue.push(token);
    console.log(`📥 QUEUED: ${token.mintAddress} (${token.source}) - Queue: ${this.tokenQueue.length}/${this.maxQueueSize}`);
    
    this.logToFile({
      event: 'token_queued',
      mintAddress: token.mintAddress,
      source: token.source,
      poolAddress: token.poolAddress,
      queueSize: this.tokenQueue.length
    });
  }

  private async isValidTokenMint(address: string): Promise<boolean> {
    try {
      if (!address || typeof address !== 'string') return false;
      if (address.length < 32 || address.length > 44) return false;
      
      const systemAddresses = new Set([
        'So11111111111111111111111111111111111111112',
        '11111111111111111111111111111111',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
      ]);
      
      if (systemAddresses.has(address)) return false;
      
      const accountInfo = await this.connection.getAccountInfo(new PublicKey(address));
      if (!accountInfo) return false;
      
      const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
      
      return (
        accountInfo.owner.toString() === TOKEN_PROGRAM_ID &&
        accountInfo.data.length === 82 &&
        !accountInfo.executable
      );
    } catch (error) {
      return false;
    }
  }

  public getQueueStatus(): { size: number; maxSize: number; processed: number } {
    return {
      size: this.tokenQueue.length,
      maxSize: this.maxQueueSize,
      processed: this.processedTokens.size
    };
  }
}
