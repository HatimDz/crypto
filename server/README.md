# Crypto Proxy Server

This is a minimal Node.js Express backend that acts as a proxy for real-time and historical cryptocurrency data.

## Why?
- **Bypasses browser CORS restrictions** for CoinGecko and Binance APIs
- Enables genuine real-time and historical data in your crypto trading app

## Endpoints
- `/api/price?symbol=BTCUSDT` — Real-time price and stats (Binance primary, CoinGecko fallback)
- `/api/historical?symbol=BTCUSDT&days=90` — Historical OHLCV data (Binance primary, CoinGecko fallback)

## Supported Symbols
BTCUSDT, ETHUSDT, BNBUSDT, ADAUSDT, SOLUSDT, XRPUSDT, DOTUSDT, LINKUSDT, IDUSDT, RADUSDT

## Usage

1. Install dependencies:
   ```sh
   npm install
   ```
2. Start the server:
   ```sh
   npm start
   ```
   The server will run on `http://localhost:3001`

## Frontend Integration
- The frontend will automatically use this backend as the primary data source
- If the backend is unreachable, it will gracefully fall back to simulated/mock data

---

**Note:**
- This server is for development/testing. For production, deploy securely and consider API key management and rate limiting.
