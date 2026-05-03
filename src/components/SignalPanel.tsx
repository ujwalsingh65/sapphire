import type { ComponentType } from "react";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  Loader2,
  Sparkles,
  Target,
  Shield,
  Flag,
  FileDown,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyzeResult, BacktestResult, PreviewResult } from "@/lib/signal-types";

// Backwards-compat alias used by ChartLevelsOverlay
export type SignalResult = AnalyzeResult;

interface Props {
  preview: PreviewResult | null;
  data: AnalyzeResult | null;
  backtest: BacktestResult | null;
  loading: boolean;
  loadingAction: "preview" | "analyze" | "backtest" | null;
  error: string | null;
  onPreview: () => void;
  onConfirmAnalyze: () => void;
  onCancelPreview: () => void;
  onBacktest: () => void;
  onExportPdf: () => void;
  confirmed: boolean;
}

const directionStyles = {
  BUY: { grad: "gradient-bull", text: "text-bull", icon: ArrowUp, label: "BUY" },
  SELL: { grad: "gradient-bear", text: "text-bear", icon: ArrowDown, label: "SELL" },
  NEUTRAL: {
    grad: "gradient-neutral",
    text: "text-neutral-signal",
    icon: Minus,
    label: "NEUTRAL",
  },
} as const;

export const SignalPanel = ({
  preview,
  data,
  backtest,
  loading,
  loadingAction,
  error,
  onPreview,
  onConfirmAnalyze,
  onCancelPreview,
  onBacktest,
  onExportPdf,
  confirmed,
}: Props) => {
  return (
    <aside className="flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            AI Signal
          </h2>
          <p className="text-xs text-muted-foreground/70">Multi-TF · Powered by Gemini</p>
        </div>
        {!preview && !data && (
          <Button
            onClick={onPreview}
            disabled={loading}
            size="sm"
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Analyze
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {!preview && !data && !loading && !error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <Sparkles className="h-8 w-8 opacity-50" />
          <p>
            Click <span className="font-medium text-foreground">Analyze</span> to fetch live data.
          </p>
          <p className="text-xs opacity-70 max-w-[220px]">
            Step 1: review the raw data. Step 2: confirm to run the AI signal.
          </p>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {loadingAction === "preview"
              ? "Fetching market data…"
              : loadingAction === "backtest"
              ? "Running backtest (this can take a moment)…"
              : "Analyzing with AI…"}
          </p>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}

      {preview && !data && !loading && (
        <PreviewBlock
          preview={preview}
          onConfirm={onConfirmAnalyze}
          onCancel={onCancelPreview}
        />
      )}

      {data && !loading && (
        <div className="flex flex-1 flex-col gap-4">
          {(() => {
            const s = directionStyles[data.signal.direction];
            const Icon = s.icon;
            return (
              <div className={`relative overflow-hidden rounded-xl p-5 ${s.grad}`}>
                <div className="absolute inset-0 bg-background/10" />
                <div className="relative flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-background">
                      <Icon className="h-6 w-6" strokeWidth={2.5} />
                      <span className="text-2xl font-bold tracking-tight">{s.label}</span>
                    </div>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wider text-background/80">
                      Next 3 candles · {data.interval}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-mono-tab text-3xl font-bold text-background">
                      {Math.round(data.signal.confidence)}
                      <span className="text-lg">%</span>
                    </div>
                    <p className="text-xs uppercase tracking-wider text-background/80">
                      Confidence
                    </p>
                  </div>
                </div>
                <div className="relative mt-3 inline-flex items-center gap-1 rounded-md bg-background/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">
                  HTF ({data.htfInterval}): {data.signal.htf_alignment}
                </div>
              </div>
            );
          })()}

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Rationale
            </p>
            <p className="text-sm leading-relaxed text-foreground/90">
              {data.signal.rationale}
            </p>
          </div>

          {data.signal.patterns && data.signal.patterns.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Patterns detected
              </p>
              <div className="flex flex-wrap gap-1">
                {data.signal.patterns.map((p) => (
                  <span
                    key={p}
                    className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-medium"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.signal.timeframe_outlook && (
            <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3 w-3" /> Timeframe outlook
              </p>
              <Outlook label="Short · next 3" text={data.signal.timeframe_outlook.short} />
              <Outlook label="Medium · next 10" text={data.signal.timeframe_outlook.medium} />
              <Outlook label="Long · next 30" text={data.signal.timeframe_outlook.long} />
            </div>
          )}

          {data.signal.projected_path && data.signal.projected_path.length > 0 && (
            <div className="space-y-1 rounded-lg border border-border bg-secondary/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <TrendingUp className="h-3 w-3" /> Projected path
              </p>
              <div className="grid grid-cols-3 gap-2">
                {data.signal.projected_path.map((p) => (
                  <div key={p.candle} className="rounded-md border border-border/60 bg-card/50 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      +{p.candle} candles
                    </p>
                    <p className="font-mono-tab text-sm font-bold">
                      {p.price.toFixed(2)}
                    </p>
                    {p.note && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">
                        {p.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.signal.trade_plan?.valid && (
            <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Trade Plan
              </p>
              <div className="grid grid-cols-3 gap-2">
                <PlanStat icon={Target} label="Entry" value={data.signal.trade_plan.entry} tone="neutral" />
                <PlanStat icon={Shield} label="SL" value={data.signal.trade_plan.stop_loss} tone="bear" />
                <PlanStat icon={Flag} label="TP" value={data.signal.trade_plan.take_profit} tone="bull" />
              </div>
              <RiskReward
                entry={data.signal.trade_plan.entry}
                sl={data.signal.trade_plan.stop_loss}
                tp={data.signal.trade_plan.take_profit}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/40 p-3">
            <Stat label="Last" value={data.indicators.lastClose.toFixed(2)} />
            <Stat
              label="Change"
              value={`${data.indicators.changePct >= 0 ? "+" : ""}${data.indicators.changePct.toFixed(2)}%`}
              tone={data.indicators.changePct >= 0 ? "bull" : "bear"}
            />
            <Stat label="RSI(14)" value={data.indicators.rsi14.toFixed(1)} />
            <Stat
              label="MACD hist"
              value={data.indicators.macd.histogram.toFixed(3)}
              tone={data.indicators.macd.histogram >= 0 ? "bull" : "bear"}
            />
            <Stat
              label="Support"
              value={data.signal.key_levels.support.toFixed(2)}
              tone="bull"
            />
            <Stat
              label="Resistance"
              value={data.signal.key_levels.resistance.toFixed(2)}
              tone="bear"
            />
          </div>

          {backtest && (
            <div className="rounded-lg border border-border bg-secondary/40 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Backtest ({backtest.decided}/{backtest.points} points)
              </p>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Win-rate</span>
                <span
                  className={`font-mono-tab text-lg font-bold ${
                    (backtest.winRate ?? 0) >= 0.6
                      ? "text-bull"
                      : (backtest.winRate ?? 0) >= 0.45
                      ? "text-foreground"
                      : "text-bear"
                  }`}
                >
                  {backtest.winRate != null ? `${(backtest.winRate * 100).toFixed(0)}%` : "—"}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                Avg |Δ| over 3 candles: {backtest.avgChange != null ? `${backtest.avgChange}%` : "—"}
              </p>
            </div>
          )}

          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Signal strength</span>
              <span>{Math.round(data.signal.confidence)}%</span>
            </div>
            <Progress value={data.signal.confidence} className="h-1.5" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={onBacktest}
              disabled={loading}
              className="gap-1"
            >
              {loadingAction === "backtest" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Backtest
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onExportPdf}
              className="gap-1"
            >
              <FileDown className="h-3.5 w-3.5" />
              PDF
            </Button>
            <Button
              size="sm"
              onClick={onPreview}
              disabled={loading}
              className="gap-1"
            >
              <Sparkles className="h-3.5 w-3.5" />
              New
            </Button>
          </div>

          {confirmed && (
            <div className="flex items-center gap-1.5 text-[10px] text-bull">
              <CheckCircle2 className="h-3 w-3" />
              Saved to history
            </div>
          )}

          <p className="mt-auto text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Generated {new Date(data.generatedAt).toLocaleTimeString()} · Educational only, not financial advice.
          </p>
        </div>
      )}
    </aside>
  );
};

const PreviewBlock = ({
  preview,
  onConfirm,
  onCancel,
}: {
  preview: PreviewResult;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const ageSec = Math.round((Date.now() - new Date(preview.lastCandleTime).getTime()) / 1000);
  const fresh = ageSec < 600; // < 10 min
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Step 1 · Verify data
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Confirm the live data below looks correct before paying for an AI call.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/40 p-3 text-xs">
        <Stat label="Source" value={preview.source} />
        <Stat label="Candles" value={String(preview.candleCount)} />
        <Stat label="Last close" value={preview.indicators.lastClose.toFixed(2)} />
        <Stat
          label="Last candle"
          value={new Date(preview.lastCandleTime).toLocaleTimeString()}
          tone={fresh ? "bull" : "bear"}
        />
        <Stat label="RSI(14)" value={preview.indicators.rsi14.toFixed(1)} />
        <Stat
          label="MACD hist"
          value={preview.indicators.macd.histogram.toFixed(3)}
          tone={preview.indicators.macd.histogram >= 0 ? "bull" : "bear"}
        />
      </div>

      {!fresh && (
        <div className="flex items-start gap-2 rounded-md border border-neutral-signal/40 bg-neutral-signal/10 p-2 text-[11px] text-neutral-signal">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Last candle is {Math.floor(ageSec / 60)} min old — markets may be closed.
        </div>
      )}

      <div className="rounded-md border border-border bg-background/40 p-2">
        <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Last 5 candles (OHLC)
        </p>
        <div className="font-mono-tab text-[10px] leading-tight text-foreground/80">
          {preview.recentCandles.slice(-5).map((c) => (
            <div key={c.time} className="flex justify-between">
              <span>{new Date(c.time * 1000).toISOString().slice(11, 16)}</span>
              <span>O {c.open.toFixed(2)}</span>
              <span>H {c.high.toFixed(2)}</span>
              <span>L {c.low.toFixed(2)}</span>
              <span>C {c.close.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="gap-1">
          <X className="h-4 w-4" /> Cancel
        </Button>
        <Button size="sm" onClick={onConfirm} className="gap-1 shadow-glow">
          <Check className="h-4 w-4" /> Confirm & Run AI
        </Button>
      </div>
    </div>
  );
};

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bull" | "bear";
}) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p
      className={`font-mono-tab text-sm font-semibold ${
        tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-foreground"
      }`}
    >
      {value}
    </p>
  </div>
);

const PlanStat = ({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "bull" | "bear" | "neutral";
}) => {
  const toneClass =
    tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-card/50 p-2">
      <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wider ${toneClass}`}>
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={`font-mono-tab text-sm font-bold ${toneClass}`}>{value.toFixed(2)}</p>
    </div>
  );
};

const RiskReward = ({ entry, sl, tp }: { entry: number; sl: number; tp: number }) => {
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  const rr = risk > 0 ? reward / risk : 0;
  const good = rr >= 1.5;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">Risk / Reward</span>
      <span className={`font-mono-tab font-semibold ${good ? "text-bull" : "text-neutral-signal"}`}>
        1 : {rr.toFixed(2)}
      </span>
    </div>
  );
};

const Outlook = ({ label, text }: { label: string; text: string }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="text-xs leading-relaxed text-foreground/90">{text}</p>
  </div>
);