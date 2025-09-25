import * as fs from 'fs';
import * as path from 'path';
import { SessionManager } from './sessionManager';

export interface TokenJourneyEntry {
  tokenAddress: string;
  timestamp: number;
  stage: 'prefilter_exit' | 'rpc_filter_entry' | 'route_gate' | 'onchain' | 'dex_screener' | 'final_result';
  status: 'PASSED' | 'REJECTED';
  reason?: string | undefined;
  score?: number | undefined;
  latency?: number | undefined;
  data?: any;
}

export class TokenJourneyLogger {
  private sessionManager: SessionManager;
  private logFile!: string;
  private currentSessionFile!: string;

  constructor() {
    this.sessionManager = SessionManager.getInstance();
    this.initializeLogFiles();
  }

  private initializeLogFiles(): void {
    const sessionId = this.sessionManager.getSessionId();
    const logDir = path.join(process.cwd(), 'logs', 'sessions', sessionId);
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.logFile = path.join(logDir, 'token_journey.log');
    this.currentSessionFile = path.join(process.cwd(), 'logs', 'current_session_token_journey.log');

    const header = {
      sessionId,
      startTime: new Date().toISOString(),
      description: 'Token journey tracking - full addresses and filter paths'
    };
    
    fs.writeFileSync(this.logFile, JSON.stringify(header, null, 2) + '\n');
    
    if (fs.existsSync(this.currentSessionFile)) {
      fs.unlinkSync(this.currentSessionFile);
    }
    fs.symlinkSync(this.logFile, this.currentSessionFile);
  }

  public logTokenJourney(entry: TokenJourneyEntry): void {
    const logEntry = {
      ...entry,
      logTimestamp: new Date().toISOString(),
      sessionId: this.sessionManager.getSessionId()
    };

    fs.appendFileSync(this.logFile, JSON.stringify(logEntry, null, 2) + '\n');

    const statusIcon = entry.status === 'PASSED' ? '✅' : '❌';
    const stageLabel = this.getStageLabel(entry.stage);
    
    console.log(`${statusIcon} ${stageLabel}: ${entry.status} ${entry.tokenAddress}`);
    
    if (entry.reason) {
      console.log(`  └─ ${entry.reason}`);
    }
    
    if (entry.score !== undefined) {
      console.log(`  └─ Score: ${entry.score.toFixed(2)}`);
    }
    
    if (entry.latency !== undefined) {
      console.log(`  └─ Latency: ${entry.latency}ms`);
    }
  }

  private getStageLabel(stage: string): string {
    const labels: Record<string, string> = {
      'prefilter_exit': '📊 PRE-FILTER EXIT',
      'rpc_filter_entry': '🔄 RPC-FILTER ENTRY',
      'route_gate': '🚪 ROUTE-GATE FILTER',
      'onchain': '⛓️ ONCHAIN FILTER',
      'dex_screener': '📈 DEX-SCREENER FILTER',
      'final_result': '🎯 FINAL RESULT'
    };
    return labels[stage] || stage.toUpperCase();
  }

  public getTokensExitingPreFilter(): string[] {
    try {
      const logContent = fs.readFileSync(this.logFile, 'utf8');
      const lines = logContent.split('\n').filter(line => line.trim());
      const tokens: string[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.stage === 'prefilter_exit' && entry.status === 'PASSED') {
            tokens.push(entry.tokenAddress);
          }
        } catch (e) {
          continue;
        }
      }

      return [...new Set(tokens)]; // Remove duplicates
    } catch (error) {
      console.error('Error reading token journey log:', error);
      return [];
    }
  }

  public printJourneySummary(): void {
    const tokens = this.getTokensExitingPreFilter();
    console.log('\n🎯 TOKEN JOURNEY SUMMARY:');
    console.log(`Session: ${this.sessionManager.getSessionId()}`);
    console.log(`Tokens exiting pre-filter: ${tokens.length}`);
    console.log(`Log file: ${this.logFile}`);
    
    if (tokens.length > 0) {
      console.log('\n📋 TOKENS THAT PASSED PRE-FILTER:');
      tokens.slice(-10).forEach((token, index) => {
        console.log(`${index + 1}. ${token}`);
      });
      
      if (tokens.length > 10) {
        console.log(`... and ${tokens.length - 10} more tokens`);
      }
    }
    
    console.log('─'.repeat(50));
  }
}
