# Solana Sniper Bot v2

Advanced Solana sniper bot with unified pre-filters and session-isolated logging system.

## 🎯 Features

- **Unified Pre-Filter**: Single pre-filter with 16 validation points (no RPC usage)
- **Session Isolation**: Complete log separation per bot run
- **RPC Optimization**: Helius priority with backup RPC
- **Safe Trading**: Maximum 3-5 positions, emergency stop functionality
- **Real-time Monitoring**: Detailed metrics and performance tracking
- **Clean Architecture**: TypeScript with strict typing and modular design

## 🏗️ Architecture

```
src/
├── core/           # Core bot logic
├── detector/       # Token detection
├── prefilter/      # Unified pre-filter (NO RPC)
├── rpc-filters/    # RPC-based filters
├── trading/        # Trading engine
├── wallet/         # Wallet management
├── logger/         # Session-isolated logging
├── config/         # Configuration
├── types/          # TypeScript types
└── utils/          # Utilities
```

## 📊 Logging System

### Session Isolation
Each bot run gets a unique session ID with isolated logs:
```
logs/sessions/
├── session_1727206588_abc123/
│   ├── prefilter_counters.log    # Counters only
│   └── ...
└── session_1727206650_def456/
    ├── prefilter_counters.log
    └── ...
```

## 🚀 Quick Start

### 1. Installation
```bash
git clone <repository-url>
cd solana-sniper-v2
npm install
```

### 2. Configuration
```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Build and Run
```bash
npm run build
npm start

# Or for development
npm run dev
```

## 📋 Verification Commands

### Check Project Structure
```bash
ls -la src/
tree src/ -I node_modules
npm run type-check
npm run build
```

### Test Pre-Filter
```bash
npm run dev
ls -la logs/sessions/
cat logs/current_session_*.log
```

## 🛡️ Safety Features

- **Emergency Stop**: Instant halt of all operations
- **Position Limits**: Maximum 3-5 concurrent positions
- **Trade Limits**: Maximum 0.01 SOL per trade
- **Session Isolation**: Complete separation of runs

---

**⚠️ Warning**: This bot trades with real money. Always test thoroughly.
