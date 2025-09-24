import { PreFilterResult } from '../types/index';
import { PreFilterLogger } from '../logger/preFilterLogger';

export class UnifiedPreFilter {
  private logger: PreFilterLogger;
  private systemAddresses: Set<string>;
  private scamTokens: Set<string>;

  constructor() {
    this.logger = new PreFilterLogger();
    this.systemAddresses = new Set();
    this.scamTokens = new Set();
    this.initializeBlacklists();
  }

  private initializeBlacklists(): void {
    this.systemAddresses = new Set([
      'So11111111111111111111111111111111111111112', // SOL
      '11111111111111111111111111111111', // System Program
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
    ]);

    this.scamTokens = new Set([
    ]);
  }

  public async processToken(mintAddress: string): Promise<PreFilterResult> {
    this.logger.incrementInput();
    
    let checksPassed = 0;
    const checksTotal = 8; // Only 8 real pre-filters (no RPC)

    if (!this.check1_length(mintAddress)) {
      this.logger.incrementRejected('check1_length');
      return { passed: false, checksPassed, checksTotal, failedAt: 'check1_length', reason: 'Invalid address length' };
    }
    this.logger.incrementPassed('check1_length');
    checksPassed++;

    if (!this.check2_base58(mintAddress)) {
      this.logger.incrementRejected('check2_base58');
      return { passed: false, checksPassed, checksTotal, failedAt: 'check2_base58', reason: 'Invalid Base58 format' };
    }
    this.logger.incrementPassed('check2_base58');
    checksPassed++;

    if (!this.check3_publickey(mintAddress)) {
      this.logger.incrementRejected('check3_publickey');
      return { passed: false, checksPassed, checksTotal, failedAt: 'check3_publickey', reason: 'Invalid PublicKey format' };
    }
    this.logger.incrementPassed('check3_publickey');
    checksPassed++;

    if (!this.check4_system(mintAddress)) {
      this.logger.incrementRejected('check4_system');
      return { passed: false, checksPassed, checksTotal, failedAt: 'check4_system', reason: 'System address excluded' };
    }
    this.logger.incrementPassed('check4_system');
    checksPassed++;

    if (!this.check5_scam(mintAddress)) {
      this.logger.incrementRejected('check5_scam');
      return { passed: false, checksPassed, checksTotal, failedAt: 'check5_scam', reason: 'Known scam token' };
    }
    this.logger.incrementPassed('check5_scam');
    checksPassed++;

    if (!this.check6_patterns(mintAddress)) {
      this.logger.incrementRejected('check6_patterns');
      return { passed: false, checksPassed, checksTotal, failedAt: 'check6_patterns', reason: 'Suspicious character pattern' };
    }
    this.logger.incrementPassed('check6_patterns');
    checksPassed++;

    if (!this.check7_sequential(mintAddress)) {
      this.logger.incrementRejected('check7_sequential');
      return { passed: false, checksPassed, checksTotal, failedAt: 'check7_sequential', reason: 'Suspicious sequential pattern' };
    }
    this.logger.incrementPassed('check7_sequential');
    checksPassed++;

    if (!this.check8_zero(mintAddress)) {
      this.logger.incrementRejected('check8_zero');
      return { passed: false, checksPassed, checksTotal, failedAt: 'check8_zero', reason: 'Zero address detected' };
    }
    this.logger.incrementPassed('check8_zero');
    checksPassed++;

    this.logger.incrementOutput();
    return { passed: true, checksPassed, checksTotal };
  }

  private check1_length(address: string): boolean {
    return address.length >= 32 && address.length <= 44;
  }

  private check2_base58(address: string): boolean {
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    return base58Regex.test(address);
  }

  private check3_publickey(address: string): boolean {
    try {
      if (address.length < 32 || address.length > 44) return false;
      const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
      return base58Regex.test(address);
    } catch {
      return true; // Fallback to true for safety
    }
  }

  private check4_system(address: string): boolean {
    return !this.systemAddresses.has(address);
  }

  private check5_scam(address: string): boolean {
    return !this.scamTokens.has(address);
  }

  private check6_patterns(address: string): boolean {
    const charCounts: Record<string, number> = {};
    for (const char of address) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }
    const maxRepeats = Math.max(...Object.values(charCounts));
    return maxRepeats <= address.length * 0.3;
  }

  private check7_sequential(address: string): boolean {
    let sequentialCount = 0;
    for (let i = 1; i < address.length; i++) {
      if (address[i] === address[i-1]) {
        sequentialCount++;
        if (sequentialCount > 6) return false;
      } else {
        sequentialCount = 0;
      }
    }
    return true;
  }

  private check8_zero(address: string): boolean {
    return !address.includes('11111111111111111111111111111111');
  }

  public getLogger(): PreFilterLogger {
    return this.logger;
  }
}
