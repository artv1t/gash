import * as fs from 'fs';
import * as path from 'path';
import { PreFilterCounters } from '../types/index';
import { SessionManager } from './sessionManager';

export class PreFilterLogger {
  private sessionManager: SessionManager;
  private counters: PreFilterCounters;

  constructor() {
    this.sessionManager = SessionManager.getInstance();
    this.counters = {} as PreFilterCounters; // Initialize before calling initializeCounters
    this.initializeCounters();
  }

  private initializeCounters(): void {
    const sessionId = this.sessionManager.getSessionId();
    this.counters = {
      sessionId,
      timestamp: Date.now(),
      totalInput: 0,
      passed: {
        check1_length: 0,
        check2_base58: 0,
        check3_publickey: 0,
        check4_system: 0,
        check5_scam: 0,
        check6_patterns: 0,
        check7_sequential: 0,
        check8_zero: 0,
        check9_liquidity: 0,
        check10_holder: 0,
        check11_contract: 0,
        check12_social: 0,
        check13_price: 0,
        check14_volume: 0,
        check15_whale: 0,
        check16_time: 0,
      },
      rejected: {
        check1_length: 0,
        check2_base58: 0,
        check3_publickey: 0,
        check4_system: 0,
        check5_scam: 0,
        check6_patterns: 0,
        check7_sequential: 0,
        check8_zero: 0,
        check9_liquidity: 0,
        check10_holder: 0,
        check11_contract: 0,
        check12_social: 0,
        check13_price: 0,
        check14_volume: 0,
        check15_whale: 0,
        check16_time: 0,
      },
      totalOutput: 0,
      filterEfficiency: 0,
    };
  }

  public incrementInput(): void {
    this.counters.totalInput++;
  }

  public incrementPassed(checkName: keyof PreFilterCounters['passed']): void {
    this.counters.passed[checkName]++;
  }

  public incrementRejected(checkName: keyof PreFilterCounters['rejected']): void {
    this.counters.rejected[checkName]++;
  }

  public incrementOutput(): void {
    this.counters.totalOutput++;
  }

  public getCounters(): PreFilterCounters {
    this.updateEfficiency();
    return { ...this.counters };
  }

  private updateEfficiency(): void {
    if (this.counters.totalInput > 0) {
      const rejected = this.counters.totalInput - this.counters.totalOutput;
      this.counters.filterEfficiency = (rejected / this.counters.totalInput) * 100;
    }
  }

  public saveCounters(): void {
    this.updateEfficiency();
    const sessionId = this.sessionManager.getSessionId();
    const logDir = path.join(process.cwd(), 'logs', 'sessions', sessionId);
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, 'prefilter_counters.log');
    const logEntry = {
      logTimestamp: new Date().toISOString(),
      ...this.counters,
    };

    fs.writeFileSync(logFile, JSON.stringify(logEntry, null, 2));

    const currentSessionFile = path.join(process.cwd(), 'logs', 'current_session_prefilter.log');
    if (fs.existsSync(currentSessionFile)) {
      fs.unlinkSync(currentSessionFile);
    }
    fs.symlinkSync(logFile, currentSessionFile);
  }

  public printSummary(): void {
    this.updateEfficiency();
    console.log('\n🔍 PREFILTER SUMMARY:');
    console.log(`Session: ${this.counters.sessionId}`);
    console.log(`Input: ${this.counters.totalInput} tokens`);
    console.log(`Output: ${this.counters.totalOutput} tokens`);
    console.log(`Efficiency: ${this.counters.filterEfficiency.toFixed(2)}% filtered out`);
    console.log('─'.repeat(50));
  }
}
