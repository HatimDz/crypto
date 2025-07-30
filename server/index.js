// Minimal Express backend for crypto data proxy
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());

// Symbol mapping for CoinGecko/Binance
const symbolMapping = {
  'BTCUSDT': { coinGecko: 'bitcoin', binance: 'BTCUSDT' },
  'ETHUSDT': { coinGecko: 'ethereum', binance: 'ETHUSDT' },
  'BNBUSDT': { coinGecko: 'binancecoin', binance: 'BNBUSDT' },
  'ADAUSDT': { coinGecko: 'cardano', binance: 'ADAUSDT' },
  'SOLUSDT': { coinGecko: 'solana', binance: 'SOLUSDT' },
  'XRPUSDT': { coinGecko: 'ripple', binance: 'XRPUSDT' },
  'DOTUSDT': { coinGecko: 'polkadot', binance: 'DOTUSDT' },
  'LINKUSDT': { coinGecko: 'chainlink', binance: 'LINKUSDT' },
  'IDUSDT': { coinGecko: 'space-id', binance: 'IDUSDT' },
  'RADUSDT': { coinGecko: 'radicle', binance: 'RADUSDT' }
};

// Real-time price endpoint
app.get('/api/price', async (req, res) => {
  const { symbol } = req.query;
  const mapping = symbolMapping[symbol];
  if (!mapping) return res.status(400).json({ error: 'Unsupported symbol' });

  // Try Binance first for real-time price
  try {
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${mapping.binance}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return res.json({
        symbol: data.symbol,
        price: parseFloat(data.lastPrice),
        change24h: parseFloat(data.priceChangePercent),
        volume24h: parseFloat(data.volume),
        marketCap: null,
        lastUpdated: new Date().toISOString()
      });
    }
  } catch (e) {}

  // Fallback to CoinGecko
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${mapping.coinGecko}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const cg = data[mapping.coinGecko];
      return res.json({
        symbol,
        price: cg.usd,
        change24h: cg.usd_24h_change,
        volume24h: cg.usd_24h_vol,
        marketCap: cg.usd_market_cap,
        lastUpdated: new Date().toISOString()
      });
    }
  } catch (e) {}

  return res.status(502).json({ error: 'Failed to fetch real-time price' });
});

// Historical OHLCV endpoint
app.get('/api/historical', async (req, res) => {
  const { symbol, days } = req.query;
  const mapping = symbolMapping[symbol];
  if (!mapping) return res.status(400).json({ error: 'Unsupported symbol' });
  const nDays = Math.max(1, Math.min(parseInt(days) || 90, 365));

  // Try Binance first
  try {
    const end = Date.now();
    const start = end - nDays * 24 * 60 * 60 * 1000;
    const url = `https://api.binance.com/api/v3/klines?symbol=${mapping.binance}&interval=1d&startTime=${start}&endTime=${end}`;
    const response = await fetch(url);
    if (response.ok) {
      const klines = await response.json();
      // Format to frontend HistoricalPriceData
      const data = klines.map(k => ({
        date: new Date(k[0]).toISOString().split('T')[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));
      return res.json(data);
    }
  } catch (e) {}

  // Fallback to CoinGecko
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${mapping.coinGecko}/market_chart?vs_currency=usd&days=${nDays}&interval=daily`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const prices = data.prices || [];
      const volumes = data.total_volumes || [];
      const hist = prices.map((p, i) => {
        const [timestamp, price] = p;
        const volume = volumes[i]?.[1] || 0;
        return {
          date: new Date(timestamp).toISOString().split('T')[0],
          open: price,
          high: price * 1.02,
          low: price * 0.98,
          close: price,
          volume
        };
      });
      return res.json(hist);
    }
  } catch (e) {}

  return res.status(502).json({ error: 'Failed to fetch historical data' });
});

app.listen(PORT, () => {
  console.log(`Crypto proxy server running on http://localhost:${PORT}`);
});
