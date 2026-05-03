import { z } from "npm:zod@3.23.8";
import { macd, rsi, sma } from "./indicators.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Curated map of common TradingView symbols → Yahoo tickers.
 * For anything not in this map we attempt a sensible fallback (see resolveYahoo).
 */
const TV_TO_YAHOO: Record<string, { yahoo: string; name: string }> = {
  "TVC:GOLD": { yahoo: "GC=F", name: "Gold" },
  "TVC:SILVER": { yahoo: "SI=F", name: "Silver" },
  "TVC:USOIL": { yahoo: "CL=F", name: "Crude Oil WTI" },
  "TVC:UKOIL": { yahoo: "BZ=F", name: "Brent Crude" },
  "NYMEX:NG1!": { yahoo: "NG=F", name: "Natural Gas" },
  "COMEX:HG1!": { yahoo: "HG=F", name: "Copper" },
  "TVC:DXY": { yahoo: "DX-Y.NYB", name: "US Dollar Index" },
  "TVC:SPX": { yahoo: "^GSPC", name: "S&P 500" },
  "TVC:NDX": { yahoo: "^NDX", name: "Nasdaq 100" },
};

function resolveYahoo(tvSymbol: string): { yahoo: string; name: string } {
  if (TV_TO_YAHOO[tvSymbol]) return TV_TO_YAHOO[tvSymbol];
  const [exchange, raw] = tvSymbol.includes(":") ? tvSymbol.split(":", 2) : ["", tvSymbol];
  const sym = raw.replace(/!$/, "");
  // Spot metals (XAUUSD, XAGUSD, XPTUSD, XPDUSD) — Yahoo has no FX pair, use futures
  const METALS: Record<string, { yahoo: string; name: string }> = {
    XAUUSD: { yahoo: "GC=F", name: "Gold (Spot)" },
    XAGUSD: { yahoo: "SI=F", name: "Silver (Spot)" },
    XPTUSD: { yahoo: "PL=F", name: "Platinum (Spot)" },
    XPDUSD: { yahoo: "PA=F", name: "Palladium (Spot)" },
  };
  if (METALS[sym.toUpperCase()]) return METALS[sym.toUpperCase()];
  // Crypto: BINANCE:BTCUSDT → BTC-USD
  if (/^(BINANCE|COINBASE|BITSTAMP|KRAKEN|BYBIT)$/i.test(exchange)) {
    const m = sym.match(/^([A-Z]+?)(USDT|USD|USDC|BUSD)$/i);
    if (m) return { yahoo: `${m[1].toUpperCase()}-USD`, name: sym };
  }
  // Forex: FX:EURUSD or OANDA:EURUSD → EURUSD=X
  if (/^(FX|FX_IDC|OANDA|FOREXCOM)$/i.test(exchange) && /^[A-Z]{6}$/i.test(sym)) {
    return { yahoo: `${sym.toUpperCase()}=X`, name: sym };
  }
  // Indices
  if (sym === "SPX") return { yahoo: "^GSPC", name: "S&P 500" };
  if (sym === "NDX") return { yahoo: "^NDX", name: "Nasdaq 100" };
  if (sym === "DJI") return { yahoo: "^DJI", name: "Dow Jones" };
  // Default — assume equity ticker (works for NASDAQ:AAPL, NYSE:MSFT, etc.)
  return { yahoo: sym.toUpperCase(), name: sym };
}

const INTERVAL_MAP: Record<string, { yahoo: string; range: string; secondsPer: number }> = {
  "1m": { yahoo: "1m", range: "1d", secondsPer: 60 },
  "5m": { yahoo: "5m", range: "5d", secondsPer: 300 },
  "15m": { yahoo: "15m", range: "5d", secondsPer: 900 },
  "1h": { yahoo: "60m", range: "1mo", secondsPer: 3600 },
  "1d": { yahoo: "1d", range: "6mo", secondsPer: 86400 },
};

// Higher-timeframe context for multi-TF analysis
const HIGHER_TF: Record<string, string> = {
  "1m": "15m",
  "5m": "1h",
  "15m": "1h",
  "1h": "1d",
  "1d": "1d",
};

export async function fetchCandles(yahooSymbol: string, interval: string): Promise<Candle[]> {
  const cfg = INTERVAL_MAP[interval] ?? INTERVAL_MAP["5m"];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol,
  )}?interval=${cfg.yahoo}&range=${cfg.range}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });
  if (!res.ok) throw new Error(`Yahoo fetch failed (${res.status}) for ${yahooSymbol}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    const err = json?.chart?.error?.description || "No chart data returned";
    throw new Error(err);
  }
  const ts: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    const v = q.volume?.[i] ?? 0;
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({ time: ts[i], open: o, high: h, low: l, close: c, volume: v });
  }
  return candles;
}

function buildIndicators(recent: Candle[]) {
  const closes = recent.map((c) => c.close);
  const last = recent[recent.length - 1];
  const prev = recent[recent.length - 2];
  return {
    rsi14: +rsi(closes, 14).toFixed(2),
    sma20: +sma(closes, 20).toFixed(4),
    sma50: +sma(closes, 50).toFixed(4),
    macd: macd(closes),
    lastClose: last.close,
    prevClose: prev.close,
    changePct: +(((last.close - prev.close) / prev.close) * 100).toFixed(3),
    high60: Math.max(...recent.map((c) => c.high)),
    low60: Math.min(...recent.map((c) => c.low)),
  };
}

const PATTERN_CATALOG = `Reference pattern catalog (use these exact terms when present):
REVERSAL: Head & Shoulders, Inverse Head & Shoulders, Double Top, Double Bottom, Triple Top, Triple Bottom, Rounding Bottom, Rounding Top, Diamond Top, Diamond Bottom, V-Top, V-Bottom.
CONTINUATION: Bull Flag, Bear Flag, Bull Pennant, Bear Pennant, Ascending Triangle, Descending Triangle, Symmetrical Triangle, Rising Wedge, Falling Wedge, Rectangle, Cup and Handle, Inverse Cup and Handle.
CANDLESTICKS: Bullish Engulfing, Bearish Engulfing, Hammer, Inverted Hammer, Shooting Star, Hanging Man, Doji, Dragonfly Doji, Gravestone Doji, Morning Star, Evening Star, Three White Soldiers, Three Black Crows, Piercing Line, Dark Cloud Cover, Tweezer Top, Tweezer Bottom, Marubozu.
STRUCTURE: Higher High, Higher Low, Lower High, Lower Low, Break of Structure, Change of Character, Liquidity Sweep, Fair Value Gap, Order Block.`;

const STRATEGY_PLAYBOOK = `Strategy playbook (apply the one matching current context; cite by name in rationale):

TREND-FOLLOWING
- MA Crossover: Long when fast EMA (e.g. 20) crosses above slow EMA (50) AND price is above 200 SMA. SL = swing low or 2×ATR. Trail with slow MA. Best on 4H/D.
- Supertrend+RSI: Long when Supertrend(10,3) flips green AND RSI > 50. Short on opposite. SL = Supertrend line. Avoid in ranges (ADX < 20).

MOMENTUM / BREAKOUT
- Volume-Confirmed Breakout: Close beyond consolidation (rect/triangle/flag) with volume > 1.5× 20-bar avg. Entry on close OR retest. SL just inside the range. Target = pattern height projected.
- Opening Range Breakout (ORB): Mark high/low of first 15-30 min. Long above, short below, with volume. SL = opposite side. Target 1:2-1:3 RRR.

MEAN REVERSION (only when ADX < 25)
- Bollinger Reversal: Tag of band + RSI < 30 (long) or > 70 (short) + reversal candle. SL beyond band close. Target = mid band (20 SMA) or opposite band.
- RSI Divergence: Price LL with RSI HL (bullish) or price HH with RSI LH (bearish). Wait for confirmation candle (engulfing/hammer). SL beyond swing. Target prior swing.

SCALPING (1m-5m)
- VWAP Pullback: Pullback to VWAP from above (long) / below (short) with volume spike + reversal candle. First 3 touches most reliable. SL 0.5-1 ATR. Target prior HoD/LoD.

SMART MONEY CONCEPTS (SMC)
- Trade with the HTF bias. Identify Order Blocks (last opposite candle before strong impulse), Break of Structure (BOS) for trend continuation, Change of Character (CHoCH) for reversal.
- Fair Value Gap (FVG): expect price to retrace and fill the imbalance. Use as entry zone.
- Liquidity Sweep: stop-hunts above prior highs / below prior lows often precede reversals — wait for displacement back into range, then enter.

WYCKOFF
- Accumulation (sideways with Spring = false breakdown) → Markup. Distribution (sideways with Upthrust = false breakout) → Markdown.`;

const RISK_FRAMEWORK = `Risk & quality framework (must apply to every trade plan):
- Risk per trade: 1-2% of account (assume 1% when sizing rationale).
- Minimum acceptable R:R = 1.5; prefer 1:2 to 1:3. Reject setups with worse RR by going NEUTRAL.
- Stop placement: prefer structure-based (swing low/high) or 1.5×ATR — never arbitrary.
- Avoid mean-reversion in strong trends; avoid trend-continuation in tight ranges.
- Require confluence: at least 2 of {HTF alignment, key S/R level, candlestick confirmation, indicator signal, pattern}.
- Behavioural filters: no FOMO chasing extended moves, no counter-trend without divergence, no entries on the very last candle of an exhausted impulse.`;

const PRE_TRADE_CHECKLIST = `Pre-trade checklist (mentally tick before BUY/SELL — if any fail, prefer NEUTRAL):
1. Is the higher-timeframe trend in my favour (or am I clearly counter-trend with a divergence/CHoCH)?
2. Is there a clear key level (S/R, OB, FVG, VWAP, prior HoD/LoD) within 1×ATR of entry?
3. Is there candlestick confirmation in the last 1-2 closes?
4. Does at least one indicator (RSI, MACD, MA) support the direction?
5. Is R:R ≥ 1.5 with realistic SL/TP based on structure or ATR?`;

async function callGemini(payload: {
  symbol: string;
  name: string;
  interval: string;
  htfInterval: string;
  indicators: ReturnType<typeof buildIndicators>;
  htfIndicators: ReturnType<typeof buildIndicators>;
  ohlcSummary: string;
  chartImage: string | null;
  apiKey: string;
}) {
  const systemPrompt = `You are a disciplined visual + quantitative technical-analysis assistant.
You analyze price action using multi-timeframe OHLC, indicators (RSI/SMA/MACD), AND when provided, a chart screenshot for visual pattern recognition.
You ALWAYS respond by calling the provided function. Never write prose.
Identify any classical chart patterns and candlestick formations you see in the screenshot.
Be conservative: prefer NEUTRAL when LTF and HTF disagree. Confidence is 0-100.
You MUST always include a multi-timeframe outlook (short = next 3 candles, medium = next 10, long = next 30) and a projected_path with at least 3 future price points.
This is educational analysis, NOT financial advice.

${PATTERN_CATALOG}

${STRATEGY_PLAYBOOK}

${RISK_FRAMEWORK}

${PRE_TRADE_CHECKLIST}

In the rationale, explicitly cite (a) which strategy from the playbook fits, (b) which checklist items pass/fail, and (c) the confluence factors observed.`;

  const userText = `Asset: ${payload.name} (${payload.symbol})
Lower timeframe: ${payload.interval}
Higher timeframe (context): ${payload.htfInterval}

LTF indicators:
- Last close: ${payload.indicators.lastClose}
- Change vs prev: ${payload.indicators.changePct}%
- RSI(14): ${payload.indicators.rsi14}
- SMA20/SMA50: ${payload.indicators.sma20} / ${payload.indicators.sma50}
- MACD: ${payload.indicators.macd.macd.toFixed(4)} / Sig: ${payload.indicators.macd.signal.toFixed(4)} / Hist: ${payload.indicators.macd.histogram.toFixed(4)}
- 60-candle range: ${payload.indicators.low60.toFixed(2)} – ${payload.indicators.high60.toFixed(2)}

HTF indicators (${payload.htfInterval}):
- RSI(14): ${payload.htfIndicators.rsi14}
- SMA20/SMA50: ${payload.htfIndicators.sma20} / ${payload.htfIndicators.sma50}
- MACD hist: ${payload.htfIndicators.macd.histogram.toFixed(4)}
- Range: ${payload.htfIndicators.low60.toFixed(2)} – ${payload.htfIndicators.high60.toFixed(2)}

Last 20 LTF candles (UTC):
${payload.ohlcSummary}

If a chart image is attached, examine it visually for patterns and key levels.

Predict direction over the NEXT 3 LTF candles. Only call BUY/SELL when LTF and HTF align. Otherwise NEUTRAL.

Always populate timeframe_outlook with concrete guidance for short / medium / long horizons (mention expected price range or behavior).
Always populate projected_path with 3 future points: candle 3, candle 10, candle 30 — each with a realistic price.
List any chart/candlestick patterns you identified in 'patterns' (use names from the catalog).

Propose a concrete trade_plan:
- entry MUST be within 0.3% of the LAST CLOSE (${payload.indicators.lastClose}). Do NOT invent a different price.
- BUY: stop_loss strictly BELOW entry (recent swing low), take_profit strictly ABOVE entry (near resistance), R:R between 1.5 and 3.
- SELL: stop_loss strictly ABOVE entry (recent swing high), take_profit strictly BELOW entry (near support), R:R between 1.5 and 3.
- NEUTRAL: valid=false, entry=stop_loss=take_profit=${payload.indicators.lastClose}.
- All prices MUST stay inside the 60-candle range ${payload.indicators.low60.toFixed(2)}–${payload.indicators.high60.toFixed(2)} and within ~3x recent volatility of the last close.`;

  // Use Pro for vision when image provided, Flash otherwise
  const model = payload.chartImage
    ? "google/gemini-2.5-pro"
    : "google/gemini-2.5-flash";

  const userContent: any = payload.chartImage
    ? [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: payload.chartImage } },
      ]
    : userText;

  const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${payload.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "emit_signal",
            description: "Emit a trading signal with rationale.",
            parameters: {
              type: "object",
              properties: {
                direction: { type: "string", enum: ["BUY", "SELL", "NEUTRAL"] },
                confidence: { type: "number" },
                rationale: { type: "string" },
                key_levels: {
                  type: "object",
                  properties: {
                    support: { type: "number" },
                    resistance: { type: "number" },
                  },
                  required: ["support", "resistance"],
                  additionalProperties: false,
                },
                trade_plan: {
                  type: "object",
                  properties: {
                    valid: { type: "boolean" },
                    entry: { type: "number" },
                    stop_loss: { type: "number" },
                    take_profit: { type: "number" },
                  },
                  required: ["valid", "entry", "stop_loss", "take_profit"],
                  additionalProperties: false,
                },
                htf_alignment: {
                  type: "string",
                  enum: ["aligned", "conflicting", "neutral"],
                },
                patterns: {
                  type: "array",
                  items: { type: "string" },
                  description: "Names of identified chart/candlestick patterns",
                },
                timeframe_outlook: {
                  type: "object",
                  properties: {
                    short: { type: "string", description: "Outlook for next ~3 candles" },
                    medium: { type: "string", description: "Outlook for next ~10 candles" },
                    long: { type: "string", description: "Outlook for next ~30 candles" },
                  },
                  required: ["short", "medium", "long"],
                  additionalProperties: false,
                },
                projected_path: {
                  type: "array",
                  description: "Future price projection points (at least 3).",
                  items: {
                    type: "object",
                    properties: {
                      candle: { type: "number", description: "Candles ahead (e.g. 3, 10, 30)" },
                      price: { type: "number" },
                      note: { type: "string" },
                    },
                    required: ["candle", "price"],
                    additionalProperties: false,
                  },
                },
              },
              required: [
                "direction",
                "confidence",
                "rationale",
                "key_levels",
                "trade_plan",
                "htf_alignment",
                "patterns",
                "timeframe_outlook",
                "projected_path",
              ],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "emit_signal" } },
    }),
  });

  if (!aiRes.ok) {
    const t = await aiRes.text().catch(() => "");
    if (aiRes.status === 429) throw Object.assign(new Error("Rate limit exceeded. Try again shortly."), { status: 429 });
    if (aiRes.status === 402) throw Object.assign(new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage."), { status: 402 });
    console.error("AI gateway error:", aiRes.status, t);
    throw Object.assign(new Error(`AI gateway error ${aiRes.status}`), { status: 502 });
  }

  const aiJson = await aiRes.json();
  const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("AI returned no tool call");
  return JSON.parse(toolCall.function.arguments);
}

const RequestSchema = z.object({
  action: z.enum(["preview", "analyze", "backtest"]).default("analyze"),
  symbol: z.string().min(1).max(64),
  interval: z.enum(["1m", "5m", "15m", "1h", "1d"]).default("5m"),
  backtestPoints: z.number().int().min(3).max(15).optional(),
  // Optional base64 data URL of the chart screenshot for vision analysis
  chartImage: z.string().optional().nullable(),
});

function ohlcSummary(recent: Candle[], n = 20): string {
  return recent
    .slice(-n)
    .map(
      (c) =>
        `${new Date(c.time * 1000).toISOString().slice(5, 16)} O:${c.open.toFixed(
          2,
        )} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)}`,
    )
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonRes(400, { error: "Invalid request", details: parsed.error.flatten().fieldErrors });
    }
    const { action, symbol, interval, backtestPoints, chartImage } = parsed.data;
    const meta = resolveYahoo(symbol);
    const candles = await fetchCandles(meta.yahoo, interval);
    if (candles.length < 30) return jsonRes(422, { error: `Not enough candle data (got ${candles.length})` });

    const recent = candles.slice(-60);
    const indicators = buildIndicators(recent);

    // PREVIEW: return raw data for user verification, no AI call
    if (action === "preview") {
      return jsonRes(200, {
        action: "preview",
        symbol,
        name: meta.name,
        interval,
        source: "Yahoo Finance",
        candleCount: candles.length,
        firstCandleTime: new Date(candles[0].time * 1000).toISOString(),
        lastCandleTime: new Date(candles[candles.length - 1].time * 1000).toISOString(),
        lastCandle: recent[recent.length - 1],
        recentCandles: recent.slice(-10),
        indicators,
        fetchedAt: new Date().toISOString(),
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return jsonRes(500, { error: "GEMINI_API_KEY not configured" });

    // Fetch higher-timeframe context for multi-TF analysis
    const htfInterval = HIGHER_TF[interval];
    let htfIndicators = indicators;
    try {
      const htfCandles = await fetchCandles(meta.yahoo, htfInterval);
      if (htfCandles.length >= 30) htfIndicators = buildIndicators(htfCandles.slice(-60));
    } catch (e) {
      console.warn("HTF fetch failed, falling back to LTF:", e);
    }

    // BACKTEST: replay AI on past candles
    if (action === "backtest") {
      const points = backtestPoints ?? 5;
      // Pre-fetch full HTF series so we can compute HTF context AS-OF each backtest cutoff
      // (eliminates lookahead bias from using current HTF indicators on past LTF points).
      let htfSeries: Candle[] = [];
      try {
        htfSeries = await fetchCandles(meta.yahoo, htfInterval);
      } catch (e) {
        console.warn("HTF series fetch failed, backtest will fall back to LTF context:", e);
      }
      const HORIZON = 3; // candles ahead to evaluate
      const results: Array<{
        atTime: string;
        atClose: number;
        direction: string;
        confidence: number;
        nextClose: number;
        nextChangePct: number;
        correct: boolean | null;
      }> = [];
      // Step backwards using a HORIZON-candle window, leaving room to verify outcomes
      for (let i = 0; i < points; i++) {
        const cutoff = candles.length - HORIZON - i * HORIZON;
        if (cutoff < 60) break;
        const window = candles.slice(0, cutoff);
        const winRecent = window.slice(-60);
        const winInd = buildIndicators(winRecent);
        // Build HTF indicators using only candles available at cutoff time
        let winHtfInd = winInd;
        if (htfSeries.length) {
          const cutoffTime = winRecent[winRecent.length - 1].time;
          const htfPast = htfSeries.filter((c) => c.time <= cutoffTime);
          if (htfPast.length >= 30) winHtfInd = buildIndicators(htfPast.slice(-60));
        }
        try {
          const ai = await callGemini({
            symbol,
            name: meta.name,
            interval,
            htfInterval,
            indicators: winInd,
            htfIndicators: winHtfInd,
            ohlcSummary: ohlcSummary(winRecent),
            chartImage: null,
            apiKey: GEMINI_API_KEY,
          });
          // Evaluate over the full HORIZON window (not just last candle) using the
          // proposed trade plan when valid: a BUY/SELL is correct if TP is touched
          // before SL within the horizon. Falls back to directional close-vs-close
          // when no valid trade plan was proposed.
          const future = candles.slice(cutoff, cutoff + HORIZON);
          const lastFuture = future[future.length - 1] ?? candles[cutoff];
          const nextClose = lastFuture.close;
          const changePct = ((nextClose - winInd.lastClose) / winInd.lastClose) * 100;
          let correct: boolean | null = null;
          const tp = ai.trade_plan;
          if (ai.direction === "NEUTRAL") {
            // Neutral is "correct" when price stays within +/-0.5% over horizon
            correct = Math.abs(changePct) < 0.5;
          } else if (tp?.valid) {
            // Walk candle-by-candle to see whether TP or SL is hit first
            let hitTp = false;
            let hitSl = false;
            for (const c of future) {
              if (ai.direction === "BUY") {
                if (c.low <= tp.stop_loss) { hitSl = true; break; }
                if (c.high >= tp.take_profit) { hitTp = true; break; }
              } else {
                if (c.high >= tp.stop_loss) { hitSl = true; break; }
                if (c.low <= tp.take_profit) { hitTp = true; break; }
              }
            }
            if (hitTp) correct = true;
            else if (hitSl) correct = false;
            else correct = ai.direction === "BUY" ? changePct > 0 : changePct < 0;
          } else {
            if (ai.direction === "BUY") correct = changePct > 0;
            else if (ai.direction === "SELL") correct = changePct < 0;
          }
          results.push({
            atTime: new Date(winRecent[winRecent.length - 1].time * 1000).toISOString(),
            atClose: winInd.lastClose,
            direction: ai.direction,
            confidence: ai.confidence,
            nextClose,
            nextChangePct: +changePct.toFixed(3),
            correct,
          });
        } catch (e: any) {
          if (e?.status === 429 || e?.status === 402) throw e;
          console.warn("Backtest point failed:", e?.message);
        }
      }
      const decided = results.filter((r) => r.correct !== null);
      const wins = decided.filter((r) => r.correct).length;
      return jsonRes(200, {
        action: "backtest",
        symbol,
        name: meta.name,
        interval,
        points: results.length,
        decided: decided.length,
        wins,
        winRate: decided.length ? +(wins / decided.length).toFixed(3) : null,
        avgChange: decided.length
          ? +(decided.reduce((a, b) => a + Math.abs(b.nextChangePct), 0) / decided.length).toFixed(3)
          : null,
        results,
        generatedAt: new Date().toISOString(),
      });
    }

    // ANALYZE: full AI signal
    const ai = await callGemini({
      symbol,
      name: meta.name,
      interval,
      htfInterval,
      indicators,
      htfIndicators,
      ohlcSummary: ohlcSummary(recent),
      chartImage: chartImage ?? null,
      apiKey: GEMINI_API_KEY,
    });
    sanitizeTradePlan(ai, indicators, recent);

    return jsonRes(200, {
      action: "analyze",
      symbol,
      name: meta.name,
      interval,
      htfInterval,
      indicators,
      htfIndicators,
      lastCandle: recent[recent.length - 1],
      recentCandles: recent.slice(-10),
      candleCount: candles.length,
      source: "Yahoo Finance",
      signal: ai,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("analyze-signal error:", e);
    const status = e?.status && Number.isInteger(e.status) ? e.status : 500;
    return jsonRes(status, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Validate & repair the AI-proposed trade plan against the actual last price
 * and recent volatility. Prevents absurd entries / SL / TP values.
 */
function sanitizeTradePlan(
  ai: any,
  ind: ReturnType<typeof buildIndicators>,
  recent: Candle[],
) {
  const last = ind.lastClose;
  if (!ai || !ai.trade_plan) return;
  const tp = ai.trade_plan;

  if (ai.direction === "NEUTRAL") {
    tp.valid = false;
    tp.entry = last;
    tp.stop_loss = last;
    tp.take_profit = last;
    return;
  }

  // ATR-ish: average true range over last 14 candles
  const n = Math.min(14, recent.length - 1);
  let atr = 0;
  for (let i = recent.length - n; i < recent.length; i++) {
    const c = recent[i];
    const p = recent[i - 1];
    atr += Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
  }
  atr = atr / n;
  if (!isFinite(atr) || atr <= 0) atr = Math.abs(last) * 0.005;

  // 1) Entry must be within 0.5*ATR of current price — otherwise clamp to last
  if (!isFinite(tp.entry) || Math.abs(tp.entry - last) > atr * 0.75) {
    tp.entry = last;
  }

  const sup = ai.key_levels?.support ?? last - atr * 3;
  const res = ai.key_levels?.resistance ?? last + atr * 3;

  const fix = (dir: "BUY" | "SELL") => {
    const entry = tp.entry;
    const slDist = atr * 1.5;
    const tpDist = atr * 3; // R:R = 2
    if (dir === "BUY") {
      // SL must be BELOW entry, TP ABOVE entry
      if (!isFinite(tp.stop_loss) || tp.stop_loss >= entry || entry - tp.stop_loss > atr * 5) {
        tp.stop_loss = entry - slDist;
      }
      if (!isFinite(tp.take_profit) || tp.take_profit <= entry || tp.take_profit - entry > atr * 8) {
        tp.take_profit = Math.min(entry + tpDist, res > entry ? res : entry + tpDist);
      }
    } else {
      // SELL: SL above entry, TP below entry
      if (!isFinite(tp.stop_loss) || tp.stop_loss <= entry || tp.stop_loss - entry > atr * 5) {
        tp.stop_loss = entry + slDist;
      }
      if (!isFinite(tp.take_profit) || tp.take_profit >= entry || entry - tp.take_profit > atr * 8) {
        tp.take_profit = Math.max(entry - tpDist, sup < entry ? sup : entry - tpDist);
      }
    }
  };

  fix(ai.direction);

  // Round to a sensible precision based on price magnitude
  const decimals = last >= 100 ? 2 : last >= 1 ? 3 : 5;
  tp.entry = +tp.entry.toFixed(decimals);
  tp.stop_loss = +tp.stop_loss.toFixed(decimals);
  tp.take_profit = +tp.take_profit.toFixed(decimals);
  tp.valid = true;
}