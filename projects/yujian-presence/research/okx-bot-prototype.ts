// OKX Trading Bot Prototype
// Runtime: Bun
// Usage: bun run okx-bot-prototype.ts

import { hmac } from "bun";

// Configuration (should be moved to environment variables)
const config = {
  baseUrl: "https://www.okx.com/api/v5",
  apiKey: process.env.OKX_API_KEY || "",
  secretKey: process.env.OKX_SECRET_KEY || "",
  passphrase: process.env.OKX_PASSPHRASE || "",
  // Trading settings
  symbol: "BTC-USDT-SWAP", // BTC perpetual swap
  gridSize: 100, // Grid interval in USD
  orderSize: 0.01, // Order size in BTC
};

// Generate signature for OKX API
async function generateSignature(
  timestamp: string,
  method: string,
  requestPath: string,
  body: string = ""
): Promise<string> {
  const message = timestamp + method.toUpperCase() + requestPath + body;
  const signature = await hmac("SHA-256", config.secretKey, message);
  return Buffer.from(signature).toString("base64");
}

// Make authenticated request to OKX
async function okxRequest(
  method: string,
  endpoint: string,
  body?: object
): Promise<any> {
  const timestamp = new Date().toISOString();
  const requestPath = "/api/v5" + endpoint;
  const bodyString = body ? JSON.stringify(body) : "";
  
  const signature = await generateSignature(timestamp, method, requestPath, bodyString);
  
  const headers = {
    "OK-ACCESS-KEY": config.apiKey,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": config.passphrase,
    "Content-Type": "application/json",
  };
  
  const url = config.baseUrl + endpoint;
  const response = await fetch(url, {
    method,
    headers,
    body: bodyString || undefined,
  });
  
  if (!response.ok) {
    throw new Error(`OKX API error: ${response.status} ${await response.text()}`);
  }
  
  return response.json();
}

// Get account balance
async function getBalance() {
  const data = await okxRequest("GET", "/account/balance");
  console.log("Account Balance:", JSON.stringify(data, null, 2));
  return data;
}

// Get current market price
async function getTicker(symbol: string) {
  const data = await okxRequest("GET", `/market/ticker?instId=${symbol}`);
  const lastPrice = parseFloat(data.data[0].last);
  console.log(`${symbol} Current Price: $${lastPrice}`);
  return lastPrice;
}

// Place a limit order
async function placeOrder(
  symbol: string,
  side: "buy" | "sell",
  price: number,
  size: number
) {
  const order = {
    instId: symbol,
    tdMode: "cross", // Cross margin mode
    side: side,
    ordType: "limit",
    sz: size.toString(),
    px: price.toString(),
  };
  
  console.log(`Placing ${side} order: ${size} ${symbol} @ $${price}`);
  const data = await okxRequest("POST", "/trade/order", order);
  console.log("Order placed:", data.data[0].ordId);
  return data;
}

// Simple Grid Trading Strategy
class GridTrader {
  private upperPrice: number;
  private lowerPrice: number;
  private gridLevels: number[] = [];
  private activeOrders: Map<number, string> = new Map(); // price -> orderId
  
  constructor(
    private centerPrice: number,
    private range: number, // +/- range from center
    private grids: number, // number of grid lines
    private orderSize: number
  ) {
    this.upperPrice = centerPrice + range;
    this.lowerPrice = centerPrice - range;
    this.calculateGridLevels();
  }
  
  private calculateGridLevels() {
    const step = (this.upperPrice - this.lowerPrice) / (this.grids - 1);
    for (let i = 0; i < this.grids; i++) {
      this.gridLevels.push(this.lowerPrice + step * i);
    }
    console.log("Grid levels:", this.gridLevels.map(p => `$${p.toFixed(2)}`).join(", "));
  }
  
  async initialize() {
    const currentPrice = await getTicker(config.symbol);
    
    // Place buy orders below current price
    for (const level of this.gridLevels) {
      if (level < currentPrice) {
        try {
          const result = await placeOrder(config.symbol, "buy", level, this.orderSize);
          this.activeOrders.set(level, result.data[0].ordId);
        } catch (e) {
          console.error(`Failed to place buy order at $${level}:`, e);
        }
      }
    }
    
    console.log(`Grid initialized with ${this.activeOrders.size} buy orders`);
  }
  
  // Monitor and rebalance (would be called in a loop)
  async monitor() {
    // TODO: Implement order fill detection and rebalancing
    // 1. Check which orders were filled
    // 2. Place corresponding sell orders at next grid level up
    // 3. Replace filled buy orders
  }
}

// Main execution
async function main() {
  console.log("🤖 OKX Trading Bot Prototype");
  console.log("============================");
  
  // Check configuration
  if (!config.apiKey || !config.secretKey || !config.passphrase) {
    console.error("❌ Missing API credentials. Please set environment variables:");
    console.error("   OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE");
    process.exit(1);
  }
  
  try {
    // Get account info
    await getBalance();
    
    // Get current market price
    const currentPrice = await getTicker(config.symbol);
    
    // Initialize grid trader
    // Range: +/- $500 from current price, 5 grid levels
    const trader = new GridTrader(currentPrice, 500, 5, config.orderSize);
    await trader.initialize();
    
    console.log("\n✅ Bot initialized successfully!");
    console.log("⚠️  This is a prototype. Use with caution and small amounts.");
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

export { okxRequest, getBalance, getTicker, placeOrder, GridTrader };
