import { useEffect, useRef, useState } from "react";
import { History, Camera, Maximize2, Minimize2 } from "lucide-react";
import { TradingViewChart } from "@/components/TradingViewChart";
import { SignalPanel } from "@/components/SignalPanel";
import { ChartLevelsOverlay } from "@/components/ChartLevelsOverlay";
import { SignalHistoryDrawer } from "@/components/SignalHistoryDrawer";
import { SymbolSearch, type TVSymbol } from "@/components/SymbolSearch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  AnalyzeResult,
  BacktestResult,
  PreviewResult,
} from "@/lib/signal-types";
import { exportTradePlanPdf } from "@/lib/export-pdf";

const INTERVALS = [
  { id: "1m", tv: "1", label: "1m" },
  { id: "5m", tv: "5", label: "5m" },
  { id: "15m", tv: "15", label: "15m" },
  { id: "1h", tv: "60", label: "1h" },
  { id: "1d", tv: "D", label: "1D" },
] as const;

const DEFAULT_SYMBOL: TVSymbol = {
  symbol: "GOLD",
  description: "Gold",
  exchange: "TVC",
  type: "economic",
  full: "TVC:GOLD",
};

const Analysis = () => {
  const [symbol, setSymbol] = useState<TVSymbol>(DEFAULT_SYMBOL);
  const [intervalId, setIntervalId] = useState<string>("5m");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [data, setData] = useState<AnalyzeResult | null>(null);
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [loadingAction, setLoadingAction] =
    useState<"preview" | "analyze" | "backtest" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [chartFullscreen, setChartFullscreen] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const interval = INTERVALS.find((i) => i.id === intervalId)!;

  useEffect(() => {
    setPreview(null);
    setData(null);
    setBacktest(null);
    setError(null);
    setConfirmed(false);
  }, [symbol.full, intervalId]);

  const callFn = async (body: Record<string, unknown>) => {
    const { data: res, error: fnErr } = await supabase.functions.invoke(
      "analyze-signal",
      { body },
    );
    if (fnErr) {
      const ctx: any = (fnErr as any).context;
      let msg = fnErr.message;
      try {
        const txt = await ctx?.text?.();
        if (txt) {
          const j = JSON.parse(txt);
          if (j?.error) msg = j.error;
        }
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    if ((res as any)?.error) throw new Error((res as any).error);
    return res;
  };

  const captureChart = async (): Promise<string | null> => {
    // Try html2canvas dynamically — TradingView is in a same-origin iframe-less widget,
    // so we can capture the container. If it fails, we fall back to no-screenshot mode.
    try {
      const el = chartContainerRef.current;
      if (!el) return null;
      const mod = await import("html2canvas");
      const canvas = await mod.default(el, {
        backgroundColor: null,
        useCORS: true,
        scale: 1,
        logging: false,
      });
      // downscale to keep payload small
      const max = 1024;
      const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
      const out = document.createElement("canvas");
      out.width = Math.round(canvas.width * scale);
      out.height = Math.round(canvas.height * scale);
      const ctx = out.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(canvas, 0, 0, out.width, out.height);
      return out.toDataURL("image/jpeg", 0.78);
    } catch (e) {
      console.warn("chart capture failed", e);
      return null;
    }
  };

  const runPreview = async () => {
    setLoadingAction("preview");
    setError(null);
    setData(null);
    setBacktest(null);
    setConfirmed(false);
    try {
      const res = (await callFn({
        action: "preview",
        symbol: symbol.full,
        interval: intervalId,
      })) as PreviewResult;
      setPreview(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch data";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  const cancelPreview = () => {
    setPreview(null);
    setError(null);
  };

  const confirmAnalyze = async () => {
    setLoadingAction("analyze");
    setError(null);
    try {
      const screenshot = await captureChart();
      const res = (await callFn({
        action: "analyze",
        symbol: symbol.full,
        interval: intervalId,
        chartImage: screenshot,
      })) as AnalyzeResult;
      setData(res);
      setPreview(null);
      toast.success(`Signal: ${res.signal.direction}`);

      const tp = res.signal.trade_plan;
      const { error: insErr } = await supabase.from("signals").insert({
        symbol: res.symbol,
        symbol_name: res.name,
        interval: res.interval,
        direction: res.signal.direction,
        confidence: res.signal.confidence,
        rationale: res.signal.rationale,
        entry: tp?.valid ? tp.entry : null,
        stop_loss: tp?.valid ? tp.stop_loss : null,
        take_profit: tp?.valid ? tp.take_profit : null,
        support: res.signal.key_levels.support,
        resistance: res.signal.key_levels.resistance,
        indicators: res.indicators as any,
        candles: res.recentCandles as any,
        confirmed: true,
      });
      if (insErr) {
        console.error("history insert failed", insErr);
        toast.error("Saved locally only — history insert failed");
      } else {
        setConfirmed(true);
        setHistoryVersion((v) => v + 1);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to analyze";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  const runBacktest = async () => {
    setLoadingAction("backtest");
    setError(null);
    try {
      const res = (await callFn({
        action: "backtest",
        symbol: symbol.full,
        interval: intervalId,
        backtestPoints: 5,
      })) as BacktestResult;
      setBacktest(res);
      toast.success(
        res.winRate != null
          ? `Backtest: ${(res.winRate * 100).toFixed(0)}% win-rate (${res.wins}/${res.decided})`
          : "Backtest completed",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Backtest failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  const onExportPdf = () => {
    if (!data) return;
    try {
      exportTradePlanPdf(
        data,
        backtest
          ? { winRate: backtest.winRate, decided: backtest.decided, wins: backtest.wins }
          : null,
      );
      toast.success("PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export PDF");
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <SymbolSearch
            value={symbol.full}
            label={`${symbol.symbol} · ${symbol.description || symbol.exchange}`}
            onChange={setSymbol}
          />
          <Select value={intervalId} onValueChange={setIntervalId}>
            <SelectTrigger className="w-[100px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVALS.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Camera className="h-3.5 w-3.5" />
          AI uses chart screenshot for visual pattern recognition
          <Button
            variant="outline"
            size="icon"
            onClick={() => setChartFullscreen((v) => !v)}
            aria-label={chartFullscreen ? "Show signal panel" : "Expand chart"}
            title={chartFullscreen ? "Show signal panel" : "Expand chart"}
          >
            {chartFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setHistoryOpen(true)}
            aria-label="Open signal history"
          >
            <History className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className={`grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 ${
          chartFullscreen ? "" : "lg:grid-cols-[1fr_380px]"
        }`}
      >
        <div ref={chartContainerRef} className="relative h-full w-full">
          <TradingViewChart
            symbol={symbol.full}
            interval={interval.tv}
            onSymbolChange={(fullSymbol) => {
              // Sync symbol changes made inside the TradingView chart back to app state
              // so the AI always analyzes the market currently shown on screen.
              const parts = fullSymbol.includes(":") ? fullSymbol.split(":", 2) : ["", fullSymbol];
              const [exchange, sym] = parts;
              setSymbol({
                symbol: sym,
                description: sym,
                exchange,
                type: "unknown",
                full: fullSymbol,
              });
            }}
          />
          <ChartLevelsOverlay data={data} />
        </div>
        <div className={`overflow-y-auto ${chartFullscreen ? "hidden" : ""}`}>
          <SignalPanel
            preview={preview}
            data={data}
            backtest={backtest}
            loading={loadingAction !== null}
            loadingAction={loadingAction}
            error={error}
            onPreview={runPreview}
            onConfirmAnalyze={confirmAnalyze}
            onCancelPreview={cancelPreview}
            onBacktest={runBacktest}
            onExportPdf={onExportPdf}
            confirmed={confirmed}
          />
        </div>
      </div>

      <SignalHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        version={historyVersion}
      />
    </div>
  );
};

export default Analysis;