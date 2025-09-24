import { SessionManager } from './logger/index';
import { UnifiedPreFilter } from './prefilter/unifiedPreFilter';

async function main(): Promise<void> {
  console.log('🚀 Starting Solana Sniper Bot v2...');
  console.log('─'.repeat(50));

  const sessionManager = SessionManager.getInstance();
  const session = sessionManager.startNewSession();
  
  console.log(`📋 Session started: ${session.sessionId}`);
  console.log(`⏰ Start time: ${new Date(session.startTime).toLocaleString()}`);

  const preFilter = new UnifiedPreFilter();
  const logger = preFilter.getLogger();

  console.log('✅ Logging system initialized');
  console.log('✅ Session isolation active');
  console.log('✅ Unified pre-filter ready');

  console.log('\n🧪 Testing unified pre-filter...');
  
  const testTokens = [
    'So11111111111111111111111111111111111111112', // SOL (should be rejected)
    '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', // Valid token
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC (should be rejected)
    'invalid-address', // Invalid format
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', // Suspicious pattern
  ];

  for (const token of testTokens) {
    const result = await preFilter.processToken(token);
    const status = result.passed ? '✅ PASSED' : '❌ REJECTED';
    console.log(`${status} ${token.slice(0, 20)}... (${result.checksPassed}/${result.checksTotal} checks)`);
    if (!result.passed) {
      console.log(`  └─ Failed at: ${result.failedAt} - ${result.reason}`);
    }
  }

  logger.saveCounters();
  logger.printSummary();

  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    logger.saveCounters();
    
    const endedSession = sessionManager.endCurrentSession();
    if (endedSession) {
      console.log(`📋 Session ended: ${endedSession.sessionId}`);
      console.log(`⏰ Duration: ${Math.round((endedSession.endTime! - endedSession.startTime) / 1000)}s`);
    }
    
    console.log('✅ Shutdown complete');
    process.exit(0);
  });

  console.log('\n🎯 Pre-filter testing complete. Press Ctrl+C to stop.');
  console.log('📁 Logs are saved in: ./logs/sessions/');
  console.log('🔗 Current session logs: ./logs/current_session_*.log');
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

main().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
