import { Connection, PublicKey } from '@solana/web3.js';
import { EventBus } from '../core/eventBus';
import { TokenEvent } from '../types/index';
import { config } from '../config/index';

export class TokenDetector {
  private connection: Connection;
  private eventBus: EventBus;
  private isRunning = false;
  private lastProcessedSlot = 0;

  constructor() {
    this.connection = new Connection(config.rpc.heliusUrl, 'confirmed');
    this.eventBus = EventBus.getInstance();
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🔍 TokenDetector: Starting real token detection...');
    this.startTokenPolling();
  }

  public stop(): void {
    this.isRunning = false;
    console.log('🛑 TokenDetector: Stopped');
  }

  private startTokenPolling(): void {
    setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.scanRecentBlocksForTokens();
      } catch (error) {
        console.error('Token polling error:', error);
      }
    }, 1000);
  }

  private async scanRecentBlocksForTokens(): Promise<void> {
    try {
      const newTokens = await this.getRecentTokenMints();
      
      if (newTokens.length > 0) {
        console.log(`🎯 Found ${newTokens.length} real tokens from blockchain!`);
        
        newTokens.forEach((token, index) => {
          const tokenEvent: TokenEvent = {
            id: `real_${Date.now()}_${index}`,
            mintAddress: token,
            timestamp: Date.now(),
            source: 'blockchain',
          };
          
          this.eventBus.emitTokenEvent(tokenEvent);
        });
      }
    } catch (error) {
      console.error('Error scanning blocks for tokens:', error);
    }
  }

  private async getRecentTokenMints(): Promise<string[]> {
    try {
      const slot = await this.connection.getSlot();
      if (slot <= this.lastProcessedSlot) return [];
      
      const block = await this.connection.getBlock(slot, {
        maxSupportedTransactionVersion: 0,
        transactionDetails: 'full',
        rewards: false,
      });
      
      if (!block) return [];
      
      const potentialTokens: string[] = [];
      
      for (const transaction of block.transactions) {
        if (transaction.meta?.err) continue;
        
        try {
          const accountKeys = transaction.transaction.message.getAccountKeys();
          for (let i = 0; i < accountKeys.length; i++) {
            const key = accountKeys.get(i);
            if (key) {
              const address = key.toString();
              if (this.isValidMintAddress(address) && this.isPotentialMintPattern(address)) {
                potentialTokens.push(address);
              }
            }
          }
        } catch (keyError) {
          continue;
        }
      }
      
      const uniqueAddresses = [...new Set(potentialTokens)].slice(0, 5);
      const verifiedTokens: string[] = [];
      
      for (const address of uniqueAddresses) {
        try {
          if (await this.isTokenMint(address)) {
            verifiedTokens.push(address);
          }
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          continue;
        }
      }
      
      this.lastProcessedSlot = slot;
      return verifiedTokens;
    } catch (error) {
      console.error('Error getting recent token mints:', error);
      return [];
    }
  }

  private isValidMintAddress(address: string): boolean {
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
      
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  private isPotentialMintPattern(address: string): boolean {
    
    const skipPatterns = [
      /^11111111111111111111111111111111/, // System program
      /^TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA/, // Token program
      /^ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL/, // Associated token program
      /^SysvarRent111111111111111111111111111111111/, // Sysvar rent
      /^SysvarC1ock11111111111111111111111111111111/, // Sysvar clock
    ];
    
    for (const pattern of skipPatterns) {
      if (pattern.test(address)) return false;
    }
    
    return address.length >= 32 && address.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
  }

  private async isTokenMint(address: string): Promise<boolean> {
    try {
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
}
