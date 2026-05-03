export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Indicators {
  rsi14: number;
  sma20: number;
  sma50: number;
  macd: { macd: number; signal: number; histogram: number };
  lastClose: number;
  prevClose: number;
  changePct: number;
  high60: number;
  low60: number;
}

export interface AISignal {
  direction: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
  rationale: string;
  key_levels: { support: number; resistance: number };
  trade_plan: {
    valid: boolean;
    entry: number;
    stop_loss: number;
    take_profit: number;
  };
  htf_alignment: "aligned" | "conflicting" | "neutral";
  patterns?: string[];
  timeframe_outlook?: {
    short: string; // "next 3 candles"
    medium: string; // "next 10 candles"
    long: string; // "next 30 candles"
  };
  projected_path?: Array<{ candle: number; price: number; note?: string }>;
}

export interface PreviewResult {
  action: "preview";
  symbol: string;
  name: string;
  interval: string;
  source: string;
  candleCount: number;
  firstCandleTime: string;
  lastCandleTime: string;
  lastCandle: Candle;
  recentCandles: Candle[];
  indicators: Indicators;
  fetchedAt: string;
}

export interface AnalyzeResult {
  action: "analyze";
  symbol: string;
  name: string;
  interval: string;
  htfInterval: string;
  source: string;
  candleCount: number;
  indicators: Indicators;
  htfIndicators: Indicators;
  lastCandle: Candle;
  recentCandles: Candle[];
  signal: AISignal;
  generatedAt: string;
}

export interface BacktestResult {
  action: "backtest";
  symbol: string;
  name: string;
  interval: string;
  points: number;
  decided: number;
  wins: number;
  winRate: number | null;
  avgChange: number | null;
  results: Array<{
    atTime: string;
    atClose: number;
    direction: string;
    confidence: number;
    nextClose: number;
    nextChangePct: number;
    correct: boolean | null;
  }>;
  generatedAt: string;
}