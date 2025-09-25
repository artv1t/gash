import { SessionManager } from './logger/index';
import { TokenDetector } from './detector/tokenDetector';
import { EventBus } from './core/eventBus';
import { RPCFilterPipeline } from './rpc-filters/index';
import { TokenJourneyLogger } from './logger/tokenJourneyLogger';

async function main(): Promise<void> {
  console.log('🚀 Starting Solana Sniper Bot v2 - DEX Pool Edition...');
  console.log('─'.repeat(50));

  const sessionManager = SessionManager.getInstance();
  const session = sessionManager.startNewSession();
  
  console.log(`📋 Session started: ${session.sessionId}`);
  console.log(`⏰ Start time: ${new Date(session.startTime).toLocaleString()}`);

  const tokenDetector = new TokenDetector();
  const eventBus = EventBus.getInstance();
  const rpcFilters = new RPCFilterPipeline();
  const journeyLogger = new TokenJourneyLogger();

  console.log('✅ Logging system initialized');
  console.log('✅ Session isolation active');
  console.log('✅ Jupiter API token monitoring ready');
  console.log('✅ RPC filters ready');
  console.log('✅ Token detector ready');

  eventBus.onTokenDetected(async (tokenEvent) => {
    console.log(`🎯 TOKEN FROM DETECTOR: ${tokenEvent.mintAddress} (${tokenEvent.source})`);
    
    journeyLogger.logTokenJourney({
      tokenAddress: tokenEvent.mintAddress,
      timestamp: Date.now(),
      stage: 'detector_exit',
      status: 'PASSED',
      reason: `Token from ${tokenEvent.source} - direct from DEX pools`,
      data: {
        source: tokenEvent.source,
        detectorId: tokenEvent.id
      }
    });

    console.log(`🔄 DETECTOR→RPC TRANSITION: Processing ${tokenEvent.mintAddress} through RPC filters...`);
    
    const rpcResult = await rpcFilters.processToken(tokenEvent.mintAddress);
    
    if (!rpcResult.passed) {
      console.log(`❌ RPC-FILTER FINAL: REJECTED ${tokenEvent.mintAddress} - ${rpcResult.reason}`);
    } else {
      console.log(`✅ RPC-FILTER FINAL: PASSED ${tokenEvent.mintAddress} - Ready for trading!`);
    }
  });

  tokenDetector.start();
  console.log('🔍 Jupiter API token monitoring started - Recent tokens with liquidity...');

  setInterval(() => {
    const stats = tokenDetector.getStats();
    console.log(`📊 JUPITER DETECTOR STATUS: ${stats.queueSize}/${stats.maxQueueSize} queued, ${stats.processedTokens} processed`);
    console.log(`🔗 API: ${stats.apiEndpoint} | Running: ${stats.isRunning ? '✅' : '❌'}`);
    journeyLogger.printJourneySummary();
  }, 30000);

  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    tokenDetector.stop();
    
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
  console.log('📁 Jupiter TokenDetector logs: ./logs/token_detector/');
  console.log('📁 Journey logs: ./logs/sessions/');
  console.log('🔗 Jupiter API: https://lite-api.jup.ag/tokens/v2/recent');
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
