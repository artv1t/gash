import { SessionManager } from './logger/index';
import { UnifiedPreFilter } from './prefilter/unifiedPreFilter';
import { TokenDetector } from './detector/tokenDetector';
import { EventBus } from './core/eventBus';
import { RPCFilterPipeline } from './rpc-filters/index';

async function main(): Promise<void> {
  console.log('🚀 Starting Solana Sniper Bot v2...');
  console.log('─'.repeat(50));

  const sessionManager = SessionManager.getInstance();
  const session = sessionManager.startNewSession();
  
  console.log(`📋 Session started: ${session.sessionId}`);
  console.log(`⏰ Start time: ${new Date(session.startTime).toLocaleString()}`);

  const preFilter = new UnifiedPreFilter();
  const logger = preFilter.getLogger();
  const tokenDetector = new TokenDetector();
  const eventBus = EventBus.getInstance();
  const rpcFilters = new RPCFilterPipeline();

  console.log('✅ Logging system initialized');
  console.log('✅ Session isolation active');
  console.log('✅ Unified pre-filter ready');
  console.log('✅ RPC filters ready');
  console.log('✅ Token detector ready');

  eventBus.onTokenDetected(async (tokenEvent) => {
    const preFilterResult = await preFilter.processToken(tokenEvent.mintAddress);
    const status = preFilterResult.passed ? '✅ PASSED' : '❌ REJECTED';
    console.log(`📊 PRE-FILTER EXIT: ${status} ${tokenEvent.mintAddress} (${preFilterResult.checksPassed}/${preFilterResult.checksTotal} checks)`);
    
    if (!preFilterResult.passed) {
      console.log(`  └─ Failed at: ${preFilterResult.failedAt} - ${preFilterResult.reason}`);
      return;
    }

    console.log(`🔄 STAGE 2→3 TRANSITION: Processing ${tokenEvent.mintAddress} through RPC filters...`);
    
    const rpcResult = await rpcFilters.processToken(tokenEvent.mintAddress);
    const rpcStatus = rpcResult.passed ? '✅ PASSED' : '❌ REJECTED';
    console.log(`📊 RPC-FILTER EXIT: ${rpcStatus} ${tokenEvent.mintAddress} (Score: ${rpcResult.score.toFixed(2)}, Latency: ${rpcResult.latency}ms)`);
    
    if (!rpcResult.passed) {
      console.log(`  └─ Failed: ${rpcResult.reason}`);
    } else {
      console.log(`  └─ Ready for trading: ${tokenEvent.mintAddress}`);
    }
  });

  tokenDetector.start();
  console.log('🔍 Real token detection started - processing live blockchain data...');

  setInterval(() => {
    logger.saveCounters();
    logger.printSummary();
  }, 30000);

  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    tokenDetector.stop();
    logger.saveCounters();
    
    const endedSession = sessionManager.endCurrentSession();
    if (endedSession) {
      console.log(`📋 Session ended: ${endedSession.sessionId}`);
      console.log(`⏰ Duration: ${Math.round((endedSession.endTime! - endedSession.startTime) / 1000)}s`);
    }
    
    eventBus.destroy();
    console.log('✅ Shutdown complete');
    process.exit(0);
  });

  console.log('\n🎯 Bot running continuously. Press Ctrl+C to stop.');
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
